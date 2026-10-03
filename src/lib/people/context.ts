import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, jobOffers, personAiResults, users } from '@/db/schema';
import { baseCvForAiColumns } from '@/lib/job-offer-queries';
import { getPerson, getThread, personLinks, readConversation } from './service';
import { contentHash } from './conversations';
import { id } from './validation';
import { PeopleError } from './types';

export async function loadNetworkingContext(userId: string, personId: string, selection: { threadId?: string; offerId?: string; includeCandidate?: boolean }) {
  const person = await getPerson(userId, personId);
  const { createdAt: _created, updatedAt: _updated, ...profile } = person;
  const links = await personLinks(userId, personId);
  let conversation: unknown = null, offer: unknown = null, candidate: unknown = null;
  if (selection.threadId) {
    const thread = await getThread(userId, personId, selection.threadId);
    const { messages } = await readConversation(userId, personId, selection.threadId);
    conversation = { channel: thread.channel, title: thread.title, messages: messages.map(m => ({ id: m.id, author: m.author, content: m.content, sentAt: m.sentAt })) };
  }
  if (selection.offerId) {
    const [row] = await db.select({ id: jobOffers.id, title: jobOffers.title, company: jobOffers.company, description: jobOffers.description, status: jobOffers.status }).from(jobOffers)
      .where(and(eq(jobOffers.userId, userId), eq(jobOffers.id, id(selection.offerId)))).limit(1);
    if (!row) throw new PeopleError('PEOPLE_OFFER_NOT_FOUND', 404);
    offer = row;
  }
  if (selection.includeCandidate) {
    const [[user], [cv]] = await Promise.all([
      db.select({ name: users.name, careerProfile: users.careerProfile }).from(users).where(eq(users.id, userId)).limit(1),
      db.select(baseCvForAiColumns).from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.updatedAt), desc(cvs.id)).limit(1),
    ]);
    candidate = { name: user?.name, profile: user?.careerProfile, cv: cv?.content || null };
  }
  const context = { profile, companies: links.companies, linkedOffers: links.offers, conversation, offer, candidate };
  if (JSON.stringify(context).length > 600000) throw new PeopleError('NETWORKING_CONTEXT_TOO_LARGE');
  return { context, hash: contentHash(context) };
}
export async function listAdvice(userId: string, personId: string) {
  await getPerson(userId, personId);
  const rows = await db.select().from(personAiResults).where(and(eq(personAiResults.userId, userId), eq(personAiResults.personId, personId))).orderBy(desc(personAiResults.createdAt)).limit(20);
  const hashes = new Map<string, Promise<string>>();
  return Promise.all(rows.map(async row => {
    const key = JSON.stringify(row.context);
    if (!hashes.has(key)) hashes.set(key, loadNetworkingContext(userId, personId, row.context).then(c => c.hash).catch(() => 'unavailable'));
    return { ...row, stale: (await hashes.get(key)) !== row.inputHash };
  }));
}
