import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = process.env.CRM_TEST_DATABASE_URL || process.env.PEOPLE_TEST_DATABASE_URL;
test('guest networking and registration preserve the private CRM graph', { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && target.pathname.includes('test'));
  process.env.DATABASE_URL = url;
  const { db, pool } = await import('@/db');
  const s = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const crm = await import('@/lib/people/service');
  const ai = await import('@/lib/people/ai');
  const queue = await import('@/lib/ai-jobs/queue');
  const { transferGuestCrm } = await import('@/lib/guest-crm-claim');
  const [guest, account, company, offer] = Array.from({ length: 4 }, () => randomUUID());
  const now = new Date('2026-10-03T12:00:00Z');
  const originalFetch = globalThis.fetch, originalKey = process.env.OPENAI_API_KEY;
  const advice = { facts: [], hypotheses: [], recommendations: [], drafts: [{ title: '1', text: 'Hello' }, { title: '2', text: 'Hi' }, { title: '3', text: 'Good morning' }], hooks: [], questions: [], nextAction: null, followupDate: null };
  try {
    await db.insert(s.users).values([
      { id: guest, email: `guest-crm-${guest}@example.test`, isGuest: true },
      { id: account, email: `account-crm-${account}@example.test` },
    ]);
    await db.insert(s.companies).values({ id: company, name: `Guest ${company}`, nameNormalized: `guest ${company}` });
    await db.insert(s.userCompanies).values([
      { userId: guest, companyId: company, isFavorite: true },
      { userId: account, companyId: company, isFavorite: false },
    ]);
    await db.insert(s.jobOffers).values({ id: offer, userId: guest, title: 'Guest offer', company: 'Guest', companyId: company, isFavorite: true, updatedAt: now });
    const person = await crm.savePerson(guest, { name: 'Guest contact', notes: 'Private guest note' });
    await db.update(s.people).set({ isFavorite: true, updatedAt: now }).where(eq(s.people.id, person.id));
    await crm.linkCompany(guest, person.id, company, 'works_at');
    await crm.linkOffer(guest, person.id, offer);
    const thread = await crm.createThread(guest, person.id, 'Guest conversation', 'linkedin');
    const imported = await crm.saveImport(guest, person.id, thread.id, 'Hello from the trial');
    await crm.saveMessage(guest, person.id, thread.id, { author: 'self', content: 'Hello from the trial', sentAt: null });
    await db.insert(s.personAvatars).values({ personId: person.id, userId: guest, mime: 'image/png', bytes: 'synthetic-test-thumbnail', byteSize: 24 });
    await db.insert(s.companyNotes).values({ userId: guest, companyId: company, content: 'Company trial note', updatedAt: now });
    const [view] = await db.insert(s.applicationViews).values({ userId: guest, entity: 'people', name: 'My favorites', isDefault: true, config: { filters: { favoritesOnly: true } } }).returning();
    await db.insert(s.applicationViews).values({ userId: account, entity: 'people', name: 'My favorites', isDefault: true, config: {} });

    // Guests use the real queue and validation path, with only the LLM transport mocked.
    process.env.OPENAI_API_KEY = 'test-only-guest-networking-key';
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, 'gpt-6-luna'); assert.equal(body.store, false);
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(advice) }] }] }), { status: 200 });
    };
    const job = await ai.enqueueNetworking(guest, { personId: person.id, action: 'first_contact', requestId: randomUUID() }, guest);
    const owner = await queue.claimAiJobById(job.id); assert.ok(owner);
    const result = await ai.processNetworking(owner, new AbortController().signal);
    await queue.completeAiJob(job.id, result, owner);

    await db.transaction(async tx => {
      await transferGuestCrm(tx, guest, account);
      await tx.delete(s.users).where(eq(s.users.id, guest));
    });
    assert.equal((await crm.getPerson(account, person.id)).notes, 'Private guest note');
    assert.equal((await crm.getPerson(account, person.id)).isFavorite, true);
    await assert.rejects(crm.getPerson(guest, person.id), /PEOPLE_NOT_FOUND/);
    const links = await crm.personLinks(account, person.id);
    assert.equal(links.companies.length, 1); assert.equal(links.offers.length, 1);
    const conversation = await crm.readConversation(account, person.id, thread.id);
    assert.equal(conversation.messages.length, 1);
    assert.equal((await crm.getImport(account, person.id, imported.id)).rawText, 'Hello from the trial');
    for (const table of [s.personAvatars, s.personAiResults, s.personImports, s.personMessages, s.personThreads, s.personCompanies, s.personOffers, s.companyNotes, s.aiJobs]) {
      const rows = await db.select({ userId: table.userId }).from(table).where(eq(table.userId, account));
      assert.equal(rows.length, 1);
    }
    const [moved] = await db.select().from(s.jobOffers).where(eq(s.jobOffers.id, offer));
    assert.equal(moved.userId, account); assert.equal(moved.updatedAt.valueOf(), now.valueOf()); assert.equal(moved.isFavorite, true);
    const [membership] = await db.select().from(s.userCompanies).where(eq(s.userCompanies.userId, account));
    assert.equal(membership.isFavorite, true);
    const views = await db.select().from(s.applicationViews).where(eq(s.applicationViews.userId, account));
    assert.equal(views.length, 2); assert.equal(views.filter(v => v.isDefault).length, 1);
    assert.ok(views.find(v => v.id === view.id)!.name.startsWith('My favorites (try '));
    // Ownership constraints still reject unrelated users after the transfer.
    await assert.rejects(db.update(s.personMessages).set({ userId: randomUUID() }).where(eq(s.personMessages.threadId, thread.id)));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    await db.delete(s.users).where(inArray(s.users.id, [guest, account]));
    await db.delete(s.companies).where(eq(s.companies.id, company));
    await pool.end();
  }
});
