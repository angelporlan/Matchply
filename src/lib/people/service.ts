import { and, asc, desc, eq, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, companies, jobOffers, people, personAiResults, personCompanies, personImports, personMessages, personOffers, personThreads } from '@/db/schema';
import { findOrCreateCompany, getOwnedCompany } from '@/lib/company-service';
import { contentHash, conversationText, markOverlaps } from './conversations';
import { channelInput, id, messageInput, personInput, relationInput, text } from './validation';
import { PeopleError, type LinkedInPersonCapture, type MessageInput, type PersonInput } from './types';

export const personListColumns = {
  id: people.id, name: people.name, role: people.role, headline: people.headline, kind: people.kind, status: people.status,
  nextFollowupAt: people.nextFollowupAt, updatedAt: people.updatedAt, avatarHash: people.avatarHash,
};
const owned = (userId: string, personId: string) => and(eq(people.userId, userId), eq(people.id, id(personId)));
export async function getPerson(userId: string, personId: string) {
  const [person] = await db.select().from(people).where(owned(userId, personId)).limit(1);
  if (!person) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
  return person;
}
export async function listPeople(userId: string, input: { query?: string; companyId?: string; offerId?: string; status?: string; due?: boolean; page?: number } = {}) {
  const query = text(input.query, 240)?.replace(/[\\%_]/g, '\\$&');
  const filters = [eq(people.userId, userId)];
  if (query) filters.push(or(ilike(people.name, `%${query}%`), ilike(people.role, `%${query}%`))!);
  if (input.status) filters.push(eq(people.status, input.status));
  if (input.due) filters.push(lte(people.nextFollowupAt, new Date()));
  if (input.companyId) filters.push(inArray(people.id, db.select({ personId: personCompanies.personId }).from(personCompanies).where(and(eq(personCompanies.userId, userId), eq(personCompanies.companyId, id(input.companyId))))));
  if (input.offerId) filters.push(inArray(people.id, db.select({ personId: personOffers.personId }).from(personOffers).where(and(eq(personOffers.userId, userId), eq(personOffers.offerId, id(input.offerId))))));
  const where = and(...filters);
  const [count] = await db.select({ total: sql<number>`cast(count(*) as int)` }).from(people).where(where);
  const total = Number(count.total);
  const page = Math.min(Math.max(1, Math.floor(input.page || 1)), Math.max(1, Math.ceil(total / 25)));
  const items = await db.select({ ...personListColumns,
    lastContactAt: sql<Date | null>`(select max(coalesce(m."sentAt", m."createdAt")) from person_message m where m."personId" = ${people.id} and m."userId" = ${userId})`,
  }).from(people).where(where).orderBy(desc(people.updatedAt), asc(people.id)).limit(25).offset((page - 1) * 25);
  const links = items.length ? await db.select({ personId: personCompanies.personId, name: companies.name, companyId: companies.id, relation: personCompanies.relation })
    .from(personCompanies).innerJoin(companies, eq(companies.id, personCompanies.companyId)).where(and(eq(personCompanies.userId, userId), inArray(personCompanies.personId, items.map(p => p.id)))) : [];
  return { items: items.map(item => ({ ...item, companies: links.filter(link => link.personId === item.id) })), total, page };
}
export type PeopleList = Awaited<ReturnType<typeof listPeople>>;
export async function savePerson(userId: string, input: PersonInput, personId?: string) {
  const data = personInput(input);
  try {
    if (personId) {
      const [row] = await db.update(people).set({ ...data, updatedAt: new Date() }).where(owned(userId, personId)).returning();
      if (!row) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
      return row;
    }
    const [row] = await db.insert(people).values({ ...data, userId }).returning();
    return row;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new PeopleError('PEOPLE_PROFILE_EXISTS', 409);
    throw error;
  }
}
export async function deletePerson(userId: string, personId: string) {
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`networking:${userId}:${personId}`}))`);
    await tx.delete(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'networking'), sql`${aiJobs.payload}->>'personId' = ${personId}`));
    const [row] = await tx.delete(people).where(owned(userId, personId)).returning({ id: people.id });
    if (!row) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
    // Lock jobs before the contact, matching worker publication order.
  });
}
export async function linkCompany(userId: string, personId: string, companyId: string, relation: string) {
  await getPerson(userId, personId); await getOwnedCompany(userId, id(companyId));
  await db.insert(personCompanies).values({ userId, personId, companyId, relation: relationInput(relation) }).onConflictDoNothing();
  await touchPerson(userId, personId);
}
export async function linkOffer(userId: string, personId: string, offerId: string) {
  await getPerson(userId, personId);
  const [offer] = await db.select({ id: jobOffers.id }).from(jobOffers).where(and(eq(jobOffers.id, id(offerId)), eq(jobOffers.userId, userId))).limit(1);
  if (!offer) throw new PeopleError('PEOPLE_OFFER_NOT_FOUND', 404);
  await db.insert(personOffers).values({ userId, personId, offerId }).onConflictDoNothing();
  await touchPerson(userId, personId);
}
export async function unlinkPerson(userId: string, personId: string, target: { companyId?: string; offerId?: string; relation?: string }) {
  await getPerson(userId, personId);
  if (target.companyId) await db.delete(personCompanies).where(and(eq(personCompanies.userId, userId), eq(personCompanies.personId, personId), eq(personCompanies.companyId, id(target.companyId)), eq(personCompanies.relation, relationInput(target.relation))));
  if (target.offerId) await db.delete(personOffers).where(and(eq(personOffers.userId, userId), eq(personOffers.personId, personId), eq(personOffers.offerId, id(target.offerId))));
  await touchPerson(userId, personId);
}
export async function personLinks(userId: string, personId: string) {
  await getPerson(userId, personId);
  const [companyLinks, offerLinks] = await Promise.all([
    db.select({ companyId: companies.id, name: companies.name, relation: personCompanies.relation }).from(personCompanies).innerJoin(companies, eq(companies.id, personCompanies.companyId)).where(and(eq(personCompanies.userId, userId), eq(personCompanies.personId, personId))).orderBy(asc(companies.name)),
    db.select({ offerId: jobOffers.id, title: jobOffers.title, company: jobOffers.company }).from(personOffers).innerJoin(jobOffers, eq(jobOffers.id, personOffers.offerId)).where(and(eq(personOffers.userId, userId), eq(personOffers.personId, personId))).orderBy(desc(jobOffers.updatedAt)),
  ]);
  return { companies: companyLinks, offers: offerLinks };
}
export async function touchPerson(userId: string, personId: string) { await db.update(people).set({ updatedAt: new Date() }).where(owned(userId, personId)); }
export async function getThread(userId: string, personId: string, threadId: string) {
  await getPerson(userId, personId);
  const [thread] = await db.select().from(personThreads).where(and(eq(personThreads.id, id(threadId)), eq(personThreads.userId, userId), eq(personThreads.personId, personId))).limit(1);
  if (!thread) throw new PeopleError('PEOPLE_THREAD_NOT_FOUND', 404);
  return thread;
}
export async function createThread(userId: string, personId: string, title: string, channel: string) {
  await getPerson(userId, personId);
  const [thread] = await db.insert(personThreads).values({ userId, personId, title: text(title, 180, true)!, channel: channelInput(channel) }).returning();
  return thread;
}
export async function listThreads(userId: string, personId: string) {
  await getPerson(userId, personId);
  return db.select().from(personThreads).where(and(eq(personThreads.userId, userId), eq(personThreads.personId, personId))).orderBy(desc(personThreads.updatedAt));
}
export async function readConversation(userId: string, personId: string, threadId: string) {
  await getThread(userId, personId, threadId);
  const [messages, imports] = await Promise.all([
    db.select().from(personMessages).where(and(eq(personMessages.threadId, threadId), eq(personMessages.userId, userId))).orderBy(asc(personMessages.position)),
    db.select({ id: personImports.id, status: personImports.status, createdAt: personImports.createdAt }).from(personImports).where(and(eq(personImports.threadId, threadId), eq(personImports.userId, userId))).orderBy(desc(personImports.createdAt)),
  ]);
  return { messages, imports };
}
export async function saveImport(userId: string, personId: string, threadId: string, raw: string) {
  await getThread(userId, personId, threadId);
  const rawText = conversationText(raw), rawHash = contentHash(rawText.replace(/\r\n/g, '\n'));
  await db.insert(personImports).values({ userId, personId, threadId, rawText, rawHash }).onConflictDoNothing();
  const [record] = await db.select({ id: personImports.id, status: personImports.status }).from(personImports).where(and(eq(personImports.userId, userId), eq(personImports.threadId, threadId), eq(personImports.rawHash, rawHash))).limit(1);
  return record;
}
export async function getImport(userId: string, personId: string, importId: string) {
  await getPerson(userId, personId);
  const [record] = await db.select().from(personImports).where(and(eq(personImports.id, id(importId)), eq(personImports.personId, personId), eq(personImports.userId, userId))).limit(1);
  if (!record) throw new PeopleError('PEOPLE_IMPORT_NOT_FOUND', 404);
  const { messages } = await readConversation(userId, personId, record.threadId);
  return { ...record, proposed: markOverlaps(messages.map(m => ({ ...m, author: m.author as MessageInput['author'], sentAt: m.sentAt?.toISOString() || null })), record.proposed || []) };
}
async function appendMessages(tx: typeof db, userId: string, personId: string, threadId: string, inputs: MessageInput[], importId?: string) {
  await tx.execute(sql`select id from person where id = ${personId} and "userId" = ${userId} for update`);
  await tx.execute(sql`select id from person_thread where id = ${threadId} and "userId" = ${userId} for update`);
  const [last] = await tx.select({ position: sql<number>`coalesce(max(${personMessages.position}), 0)` }).from(personMessages).where(and(eq(personMessages.threadId, threadId), eq(personMessages.userId, userId)));
  if (inputs.length) await tx.insert(personMessages).values(inputs.map((input, i) => ({ ...messageInput(input), userId, personId, threadId, importId: importId || null, position: Number(last.position) + i + 1 })));
  await tx.update(personThreads).set({ updatedAt: new Date() }).where(and(eq(personThreads.id, threadId), eq(personThreads.userId, userId)));
  await tx.update(people).set({ updatedAt: new Date() }).where(owned(userId, personId));
}
export async function confirmImport(userId: string, personId: string, importId: string, messages: MessageInput[]) {
  if (!Array.isArray(messages) || messages.length > 2000 || JSON.stringify(messages).length > 500000) throw new PeopleError('PEOPLE_CONVERSATION_SIZE');
  messages.forEach(messageInput);
  await getPerson(userId, personId);
  return db.transaction(async tx => {
    await tx.execute(sql`select id from person where id = ${personId} and "userId" = ${userId} for update`);
    const rows = await tx.execute(sql`select id, "threadId", status from person_import where id = ${id(importId)} and "userId" = ${userId} and "personId" = ${personId} for update`);
    const record = rows.rows[0] as { threadId: string; status: string } | undefined;
    if (!record) throw new PeopleError('PEOPLE_IMPORT_NOT_FOUND', 404);
    if (record.status === 'confirmed') return { alreadyConfirmed: true };
    if (record.status !== 'review') throw new PeopleError('PEOPLE_IMPORT_NOT_READY', 409);
    await appendMessages(tx as typeof db, userId, personId, record.threadId, messages, importId);
    await tx.update(personImports).set({ status: 'confirmed' }).where(eq(personImports.id, importId));
    return { alreadyConfirmed: false };
  });
}
export async function saveMessage(userId: string, personId: string, threadId: string, input: MessageInput, messageId?: string) {
  await getThread(userId, personId, threadId);
  const data = messageInput(input);
  if (messageId) {
    const rows = await db.update(personMessages).set(data).where(and(eq(personMessages.id, id(messageId)), eq(personMessages.userId, userId), eq(personMessages.threadId, threadId))).returning({ id: personMessages.id });
    if (!rows.length) throw new PeopleError('PEOPLE_MESSAGE_NOT_FOUND', 404);
    await touchPerson(userId, personId);
  } else await db.transaction(tx => appendMessages(tx as typeof db, userId, personId, threadId, [input]));
}
export async function deleteMessage(userId: string, personId: string, messageId: string) {
  await getPerson(userId, personId);
  const rows = await db.delete(personMessages).where(and(eq(personMessages.id, id(messageId)), eq(personMessages.userId, userId), eq(personMessages.personId, personId))).returning({ id: personMessages.id });
  if (!rows.length) throw new PeopleError('PEOPLE_MESSAGE_NOT_FOUND', 404);
  await touchPerson(userId, personId);
}
export async function capturePeople(userId: string, sourceJobId: string, captures: LinkedInPersonCapture[]) {
  const [offer] = await db.select({ id: jobOffers.id, companyId: jobOffers.companyId }).from(jobOffers).where(and(eq(jobOffers.userId, userId), eq(jobOffers.externalSource, 'linkedin'), eq(jobOffers.externalId, sourceJobId))).limit(1);
  if (!offer) throw new PeopleError('PEOPLE_OFFER_NOT_FOUND', 404);
  let created = 0;
  for (const capture of captures) {
    const value = personInput({ name: capture.name, linkedinUrl: capture.profileUrl, headline: capture.headline, kind: capture.source === 'hiring_team' ? 'recruiter' : 'employee', connectionDegree: capture.connectionDegree, origin: 'LinkedIn' });
    const inserted = await db.insert(people).values({ ...value, userId }).onConflictDoNothing().returning({ id: people.id });
    if (inserted.length) created++;
    const [person] = await db.select({ id: people.id }).from(people).where(and(eq(people.userId, userId), eq(people.linkedinUrl, value.linkedinUrl!))).limit(1);
    if (!person) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
    // Fill blanks only: neither a recapture nor a different offer overwrites user edits.
    await db.update(people).set({ headline: sql`coalesce(${people.headline}, ${value.headline})`, connectionDegree: sql`coalesce(${people.connectionDegree}, ${value.connectionDegree})` }).where(owned(userId, person.id));
    await linkOffer(userId, person.id, offer.id);
    if (offer.companyId) await linkCompany(userId, person.id, offer.companyId, capture.source === 'hiring_team' ? 'recruits_for' : 'unconfirmed');
  }
  return { created, captured: captures.length };
}
export async function createAndLinkCompany(userId: string, personId: string, name: string, relation: string) {
  await getPerson(userId, personId);
  const company = await findOrCreateCompany(userId, text(name, 120, true)!);
  if (!company) throw new PeopleError('PEOPLE_REQUIRED');
  await linkCompany(userId, personId, company.id, relation);
}
export async function acceptFollowup(userId: string, personId: string, resultId: string) {
  await getPerson(userId, personId);
  const [result] = await db.select().from(personAiResults).where(and(eq(personAiResults.id, id(resultId)), eq(personAiResults.userId, userId), eq(personAiResults.personId, personId))).limit(1);
  if (!result) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
  const { loadNetworkingContext } = await import('./context');
  if ((await loadNetworkingContext(userId, personId, result.context)).hash !== result.inputHash) throw new PeopleError('PEOPLE_STALE_RESULT', 409);
  const { date } = await import('./validation');
  await db.update(people).set({ nextAction: result.advice.nextAction, ...(result.advice.followupDate ? { nextFollowupAt: date(result.advice.followupDate) } : {}), updatedAt: new Date() }).where(owned(userId, personId));
}
