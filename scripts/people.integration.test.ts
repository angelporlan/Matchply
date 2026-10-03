import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const testUrl = process.env.PEOPLE_TEST_DATABASE_URL;
test('People persistence, isolation, queue, literal imports and additive capture', { skip: !testUrl }, async t => {
  const target = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && target.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const schema = await import('@/db/schema');
  const { users, people, companies, userCompanies, jobOffers, personCompanies, personOffers, personThreads, personImports, personMessages, personAiResults, aiJobs } = schema;
  const { eq, and, inArray } = await import('drizzle-orm');
  const crm = await import('@/lib/people/service');
  const ai = await import('@/lib/people/ai');
  const queue = await import('@/lib/ai-jobs/queue');
  const context = await import('@/lib/people/context');
  const [u1, u2] = [randomUUID(), randomUUID()];
  const companyIds = [randomUUID(), randomUUID()];
  const offerIds = [randomUUID(), randomUUID()];
  const originalFetch = globalThis.fetch, originalKey = process.env.OPENAI_API_KEY;
  const advice = { facts: ['Contact role is recruiter'], hypotheses: [], recommendations: ['Ask one professional question'], drafts: [{ title: 'Opening 1', text: 'Hello' }, { title: 'Opening 2', text: 'Good morning' }, { title: 'Opening 3', text: 'Hi' }], hooks: [], questions: ['What is the team working on?'], nextAction: 'Ask about the role', followupDate: '2026-10-10' };
  let responseValue: unknown = advice, beforeResponse: (() => Promise<void>) | null = null, calls = 0;
  process.env.OPENAI_API_KEY = 'test-only-networking-key';
  globalThis.fetch = async (_url, init) => {
    calls++; const body = JSON.parse(String(init?.body)); assert.equal(body.store, false); assert.equal(body.model, 'gpt-6-luna'); assert.equal(body.text.format.strict, true);
    if (beforeResponse) await beforeResponse();
    return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 10, output_tokens: 20 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(responseValue) }] }] }), { status: 200 });
  };
  await db.insert(users).values([u1, u2].map(id => ({ id, name: 'Candidate', email: `people-${id}@example.test`, subscriptionStatus: 'none' })));
  await db.insert(companies).values(companyIds.map((id, i) => ({ id, name: `People test ${i} ${id}`, nameNormalized: `people test ${i} ${id}` })));
  await db.insert(userCompanies).values(companyIds.map(companyId => ({ userId: u1, companyId })));
  await db.insert(jobOffers).values([{ id: offerIds[0], userId: u1, title: 'Engineer', company: 'Client', companyId: companyIds[0], externalSource: 'linkedin', externalId: 'people-test-job', scoreOverall: 87, rawReport: 'REPORT_SENTINEL', description: 'DESCRIPTION_SENTINEL', coverLetter: 'LETTER_SENTINEL' }, { id: offerIds[1], userId: u2, title: 'Private offer', company: 'Other' }]);
  let p1: Awaited<ReturnType<typeof crm.savePerson>>;
  try {
    await t.test('the same profile remains private per user; null URLs do not merge by name', async () => {
      p1 = await crm.savePerson(u1, { name: 'Ana', linkedinUrl: 'https://es.linkedin.com/in/ANA/?x=1', role: 'Recruiter', notes: 'PRIVATE_NOTE_SENTINEL' });
      const p2 = await crm.savePerson(u2, { name: 'Ana', linkedinUrl: 'https://www.linkedin.com/in/ana' });
      assert.notEqual(p1.id, p2.id);
      await assert.rejects(crm.getPerson(u2, p1.id), /PEOPLE_NOT_FOUND/);
      await assert.rejects(crm.savePerson(u1, { name: 'Duplicate', linkedinUrl: p1.linkedinUrl }), /PEOPLE_PROFILE_EXISTS/);
      const a = await crm.savePerson(u1, { name: 'Same' }), b = await crm.savePerson(u1, { name: 'Same' }); assert.notEqual(a.id, b.id);
      await crm.linkCompany(u1, p1.id, companyIds[0], 'recruits_for'); await crm.linkCompany(u1, p1.id, companyIds[1], 'works_at'); await crm.linkOffer(u1, p1.id, offerIds[0]);
      await assert.rejects(crm.linkOffer(u1, p1.id, offerIds[1]), /PEOPLE_OFFER_NOT_FOUND/);
      await assert.rejects(db.insert(personOffers).values({ userId: u2, personId: p1.id, offerId: offerIds[1] }));
      assert.equal((await crm.personLinks(u1, p1.id)).companies.length, 2);
      const list = await crm.listPeople(u1); assert.ok(!JSON.stringify(list).includes('PRIVATE_NOTE_SENTINEL')); assert.ok(!JSON.stringify(list).includes('DESCRIPTION_SENTINEL'));
      for (let i = 0; i < 27; i++) await crm.savePerson(u1, { name: `Page ${i}` });
      assert.equal((await crm.listPeople(u1)).items.length, 25); assert.equal((await crm.listPeople(u1, { page: 2 })).items.length, 5);
    });
    await t.test('queue deduplicates a request, serializes a person and publishes advice without a CV', async () => {
      const payload = { personId: p1.id, action: 'first_contact' as const, requestId: randomUUID() };
      const [a, b] = await Promise.all([ai.enqueueNetworking(u1, payload, u1), ai.enqueueNetworking(u1, payload, u1)]); assert.equal(a.id, b.id);
      await assert.rejects(ai.enqueueNetworking(u1, { ...payload, requestId: randomUUID() }, u1), /NETWORKING_BUSY/);
      await assert.rejects(ai.enqueueNetworking(u1, { ...payload, action: 'next_step' }, u1), /NETWORKING_REQUEST_CONFLICT/);
      assert.equal(await queue.getAiJobForUser(u2, a.id), null);
      assert.ok(!JSON.stringify(a.payload).includes('PRIVATE_NOTE_SENTINEL'));
      const owner = await queue.claimAiJobById(a.id); assert.ok(owner);
      const result = await ai.processNetworking(owner, new AbortController().signal); assert.ok('resultId' in result);
      await queue.completeAiJob(a.id, result, owner);
      const rows = await context.listAdvice(u1, p1.id); assert.equal(rows.length, 1); assert.equal(rows[0].stale, false);
      assert.equal((await context.loadNetworkingContext(u1, p1.id, {})).context.candidate, null);
      await crm.acceptFollowup(u1, p1.id, rows[0].id); assert.equal((await crm.getPerson(u1, p1.id)).nextAction, advice.nextAction);
      assert.equal((await context.listAdvice(u1, p1.id))[0].stale, true);
      await assert.rejects(crm.acceptFollowup(u2, p1.id, rows[0].id), /PEOPLE_NOT_FOUND/);
    });
    await t.test('literal import is reviewed, confirmed once, and preserves repeated legitimate messages', async () => {
      const thread = await crm.createThread(u1, p1.id, 'LinkedIn chat', 'linkedin');
      const raw = 'Ana\nHello  candidate\nCandidate\nThanks\nAna\nThanks';
      const a = await crm.saveImport(u1, p1.id, thread.id, raw), b = await crm.saveImport(u1, p1.id, thread.id, raw); assert.equal(a.id, b.id);
      assert.equal((await crm.readConversation(u1, p1.id, thread.id)).messages.length, 0);
      responseValue = { messages: [{ startLine: 2, endLine: 2, author: 'contact', sentAt: null, uncertain: true }, { startLine: 4, endLine: 4, author: 'self', sentAt: null, uncertain: true }, { startLine: 6, endLine: 6, author: 'contact', sentAt: null, uncertain: true }] };
      const payload = { personId: p1.id, threadId: thread.id, importId: a.id, action: 'parse_conversation' as const, requestId: randomUUID() };
      const job = await ai.enqueueNetworking(u1, payload, u1), owner = await queue.claimAiJobById(job.id); assert.ok(owner);
      const result = await ai.processNetworking(owner, new AbortController().signal); await queue.completeAiJob(job.id, result, owner);
      assert.equal((await ai.enqueueNetworking(u1, payload, u1)).id, job.id);
      const imported = await crm.getImport(u1, p1.id, a.id); assert.equal(imported.rawText, raw); assert.equal(imported.status, 'review'); assert.equal(imported.proposed[0].content, 'Hello  candidate');
      const [confirmed, repeated] = await Promise.all([crm.confirmImport(u1, p1.id, a.id, imported.proposed), crm.confirmImport(u1, p1.id, a.id, imported.proposed)]); assert.notEqual(confirmed.alreadyConfirmed, repeated.alreadyConfirmed);
      const messages = (await crm.readConversation(u1, p1.id, thread.id)).messages; assert.equal(messages.length, 3); assert.equal(messages[1].content, messages[2].content);
      await crm.saveMessage(u1, p1.id, thread.id, { author: 'self', content: 'Edited', sentAt: null }, messages[1].id); await crm.deleteMessage(u1, p1.id, messages[2].id);
      await assert.rejects(crm.readConversation(u2, p1.id, thread.id), /PEOPLE_NOT_FOUND/);
    });
    await t.test('late capture preserves offer results and manual contact edits without invoking AI', async () => {
      const previousCalls = calls;
      const { ingestLinkedInOffer } = await import('@/lib/extension-service');
      // Legacy extension payloads remain valid; recapture never clears saved analysis.
      const legacy = await ingestLinkedInOffer(u1, randomUUID(), { sourceJobId: 'people-test-job', canonicalUrl: 'https://www.linkedin.com/jobs/view/123/', title: 'Legacy capture', company: 'Client', description: 'Different incoming description' });
      assert.equal(legacy.application.id, offerIds[0]); assert.equal(legacy.created, false);
      const capture = { name: 'Captured name', profileUrl: 'https://www.linkedin.com/in/ana', headline: 'Recruiter at Agency', source: 'hiring_team' as const };
      await crm.capturePeople(u1, 'people-test-job', [capture]); await crm.capturePeople(u1, 'people-test-job', [capture]);
      const person = await crm.getPerson(u1, p1.id); assert.equal(person.name, 'Ana'); assert.equal(person.role, 'Recruiter'); assert.equal(person.headline, capture.headline);
      const [offer] = await db.select().from(jobOffers).where(eq(jobOffers.id, offerIds[0])); assert.equal(offer.rawReport, 'REPORT_SENTINEL'); assert.equal(offer.coverLetter, 'LETTER_SENTINEL'); assert.equal(offer.scoreOverall, 87); assert.equal(calls, previousCalls);
      await assert.rejects(crm.capturePeople(u2, 'people-test-job', [capture]), /PEOPLE_OFFER_NOT_FOUND/);
      assert.equal((await crm.personLinks(u1, p1.id)).companies.filter(c => c.relation === 'recruits_for').length, 1);
    });
    await t.test('invalid output and a missing key leave originals and history intact; failures are retryable only when transient', async () => {
      responseValue = {};
      const job = await ai.enqueueNetworking(u1, { personId: p1.id, action: 'next_step', requestId: randomUUID() }, u1), owner = await queue.claimAiJobById(job.id); assert.ok(owner);
      await assert.rejects(ai.processNetworking(owner, new AbortController().signal), /NETWORKING_INVALID_RESPONSE/); await queue.failAiJob(owner, new ai.NetworkingError('NETWORKING_INVALID_RESPONSE')); assert.equal((await queue.getAiJob(job.id))?.status, 'failed');
      delete process.env.OPENAI_API_KEY;
      const noKey = await ai.enqueueNetworking(u1, { personId: p1.id, action: 'next_step', requestId: randomUUID() }, u1), noKeyOwner = await queue.claimAiJobById(noKey.id); assert.ok(noKeyOwner);
      await assert.rejects(ai.processNetworking(noKeyOwner, new AbortController().signal), /NETWORKING_NOT_CONFIGURED/); await queue.failAiJob(noKeyOwner, new ai.NetworkingError('NETWORKING_NOT_CONFIGURED'));
      process.env.OPENAI_API_KEY = 'test-only-networking-key';
      const retry = await ai.enqueueNetworking(u1, { personId: p1.id, action: 'next_step', requestId: randomUUID() }, u1), retryOwner = await queue.claimAiJobById(retry.id); assert.ok(retryOwner);
      await queue.failAiJob(retryOwner, new ai.NetworkingError('NETWORKING_HTTP_429', true)); assert.equal((await queue.getAiJob(retry.id))?.status, 'queued');
      await db.update(aiJobs).set({ nextAttemptAt: new Date(0) }).where(eq(aiJobs.id, retry.id)); const current = await queue.claimAiJobById(retry.id); assert.ok(current);
      assert.equal(await queue.completeAiJob(retry.id, {}, retryOwner), undefined); await queue.failAiJob(current, new ai.NetworkingError('done'));
      assert.equal((await db.select().from(personImports).where(eq(personImports.userId, u1))).length, 1); assert.equal((await db.select().from(personMessages).where(eq(personMessages.userId, u1))).length, 2);
    });
    await t.test('an expired lease cannot publish AI output or replace newer results', async () => {
      responseValue = advice;
      const job = await ai.enqueueNetworking(u1, { personId: p1.id, action: 'next_step', requestId: randomUUID() }, u1), owner = await queue.claimAiJobById(job.id); assert.ok(owner);
      beforeResponse = async () => { await db.update(aiJobs).set({ leaseUntil: new Date(0) }).where(eq(aiJobs.id, job.id)); };
      const before = (await context.listAdvice(u1, p1.id)).length;
      await assert.rejects(ai.processNetworking(owner, new AbortController().signal), /NETWORKING_LEASE_LOST/); beforeResponse = null;
      assert.equal((await context.listAdvice(u1, p1.id)).length, before);
      const reclaimed = await queue.claimAiJobById(job.id); assert.ok(reclaimed); await queue.failAiJob(reclaimed, new ai.NetworkingError('done'));
    });
    await t.test('a selected offer deleted while generating prevents publication', async () => {
      responseValue = advice;
      const offerId = randomUUID(); await db.insert(jobOffers).values({ id: offerId, userId: u1, title: 'Transient offer', company: 'Client' });
      const job = await ai.enqueueNetworking(u1, { personId: p1.id, offerId, action: 'next_step', requestId: randomUUID() }, u1), owner = await queue.claimAiJobById(job.id); assert.ok(owner);
      beforeResponse = async () => { await db.delete(jobOffers).where(eq(jobOffers.id, offerId)); };
      const before = (await context.listAdvice(u1, p1.id)).length;
      await assert.rejects(ai.processNetworking(owner, new AbortController().signal), /PEOPLE_OFFER_NOT_FOUND/); beforeResponse = null;
      assert.equal((await context.listAdvice(u1, p1.id)).length, before);
      await queue.failAiJob(owner, new ai.NetworkingError('PEOPLE_OFFER_NOT_FOUND'));
    });
    await t.test('deletion detaches companies/offers, and deletion during processing prevents publishing', async () => {
      await db.delete(userCompanies).where(and(eq(userCompanies.userId, u1), eq(userCompanies.companyId, companyIds[1]))); assert.ok(await crm.getPerson(u1, p1.id)); assert.equal((await crm.personLinks(u1, p1.id)).companies.length, 1);
      await db.delete(jobOffers).where(eq(jobOffers.id, offerIds[0])); assert.ok(await crm.getPerson(u1, p1.id)); assert.equal((await crm.personLinks(u1, p1.id)).offers.length, 0);
      responseValue = advice;
      const job = await ai.enqueueNetworking(u1, { personId: p1.id, action: 'next_step', requestId: randomUUID() }, u1), owner = await queue.claimAiJobById(job.id); assert.ok(owner);
      beforeResponse = () => crm.deletePerson(u1, p1.id);
      await assert.rejects(ai.processNetworking(owner, new AbortController().signal), /NETWORKING_LEASE_LOST|PEOPLE_NOT_FOUND/); beforeResponse = null;
      for (const table of [personThreads, personMessages, personImports, personCompanies, personOffers, personAiResults]) assert.equal((await db.select().from(table).where(eq(table.personId, p1.id))).length, 0);
      assert.equal(await queue.getAiJob(job.id), null);
    });
  } finally {
    globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    await db.delete(users).where(inArray(users.id, [u1, u2])); await db.delete(companies).where(inArray(companies.id, companyIds)); await pool.end();
  }
});
