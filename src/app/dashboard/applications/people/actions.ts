'use server';

import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { companies, jobOffers, userCompanies } from '@/db/schema';
import { requireProductContext, auditActorFields } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import { log } from '@/lib/logger';
import * as crm from '@/lib/people/service';
import { listAdvice } from '@/lib/people/context';
import { PeopleError, type PersonInput, type MessageInput } from '@/lib/people/types';

async function run<T>(action: string, operation: (userId: string) => Promise<T>, personId?: string) {
  try {
    const ctx = await requireProductContext({ feature: 'networking' });
    const userId = ctx.effectiveUser!.id;
    const data = await operation(userId);
    if (action !== 'read') {
      void createAuditLog(`person_${action}`, userId, null, { personId }, auditActorFields(ctx));
      revalidatePath('/dashboard/applications/people');
      if (personId) revalidatePath(`/dashboard/applications/people/${personId}`);
    }
    return { data };
  } catch (error) {
    if (error instanceof PeopleError) return { error: error.message };
    if (error instanceof Error && ['Unauthorized', 'Forbidden'].includes(error.message)) return { error: 'PEOPLE_FORBIDDEN' };
    log({ event: 'person_action_failed', level: 'error', action, personId });
    return { error: 'PEOPLE_ACTION_FAILED' };
  }
}
export async function savePersonAction(input: PersonInput, personId?: string, link?: { companyId?: string; offerId?: string }) {
  return run('save', async userId => {
    // Validate links before saving, so a stale or foreign link never creates a partial contact.
    if (link?.companyId) {
      const [owned] = await db.select({ id: userCompanies.companyId }).from(userCompanies).where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, link.companyId))).limit(1);
      if (!owned) throw new PeopleError('PEOPLE_COMPANY_NOT_FOUND', 404);
    }
    if (link?.offerId) {
      const [owned] = await db.select({ id: jobOffers.id }).from(jobOffers).where(and(eq(jobOffers.userId, userId), eq(jobOffers.id, link.offerId))).limit(1);
      if (!owned) throw new PeopleError('PEOPLE_OFFER_NOT_FOUND', 404);
    }
    const person = await crm.savePerson(userId, input, personId);
    if (link?.companyId) await crm.linkCompany(userId, person.id, link.companyId, 'unconfirmed');
    if (link?.offerId) await crm.linkOffer(userId, person.id, link.offerId);
    return person;
  }, personId);
}
export async function deletePersonAction(personId: string) { return run('delete', u => crm.deletePerson(u, personId), personId); }
export async function linkPersonAction(personId: string, link: { companyId?: string; offerId?: string; relation?: string; companyName?: string }) {
  return run('link', async u => {
    if (link.companyName) await crm.createAndLinkCompany(u, personId, link.companyName, link.relation || 'unconfirmed');
    else if (link.companyId) await crm.linkCompany(u, personId, link.companyId, link.relation || 'unconfirmed');
    if (link.offerId) await crm.linkOffer(u, personId, link.offerId);
  }, personId);
}
export async function unlinkPersonAction(personId: string, link: { companyId?: string; offerId?: string; relation?: string }) { return run('unlink', u => crm.unlinkPerson(u, personId, link), personId); }
export async function createThreadAction(personId: string, title: string, channel: string) { return run('thread_create', u => crm.createThread(u, personId, title, channel), personId); }
export async function readThreadAction(personId: string, threadId: string) { return run('read', u => crm.readConversation(u, personId, threadId), personId); }
export async function saveImportAction(personId: string, threadId: string, raw: string) { return run('import_save', u => crm.saveImport(u, personId, threadId, raw), personId); }
export async function readImportAction(personId: string, importId: string) { return run('read', u => crm.getImport(u, personId, importId), personId); }
export async function confirmImportAction(personId: string, importId: string, messages: MessageInput[]) { return run('import_confirm', u => crm.confirmImport(u, personId, importId, messages), personId); }
export async function saveMessageAction(personId: string, threadId: string, input: MessageInput, messageId?: string) { return run('message_save', u => crm.saveMessage(u, personId, threadId, input, messageId), personId); }
export async function deleteMessageAction(personId: string, messageId: string) { return run('message_delete', u => crm.deleteMessage(u, personId, messageId), personId); }
export async function readAdviceAction(personId: string) { return run('read', u => listAdvice(u, personId), personId); }
export async function acceptFollowupAction(personId: string, resultId: string) { return run('followup_accept', u => crm.acceptFollowup(u, personId, resultId), personId); }
export async function searchPersonLinksAction(query: string) {
  return run('read', async u => {
    const term = `%${query.slice(0, 180).replace(/[\\%_]/g, '\\$&')}%`;
    const [companyOptions, offerOptions] = await Promise.all([
      db.select({ id: companies.id, name: companies.name }).from(userCompanies).innerJoin(companies, eq(companies.id, userCompanies.companyId)).where(and(eq(userCompanies.userId, u), ilike(companies.name, term))).orderBy(companies.name).limit(50),
      db.select({ id: jobOffers.id, title: jobOffers.title, company: jobOffers.company }).from(jobOffers).where(and(eq(jobOffers.userId, u), or(ilike(jobOffers.title, term), ilike(jobOffers.company, term)))).orderBy(desc(jobOffers.updatedAt)).limit(50),
    ]);
    return { companies: companyOptions, offers: offerOptions };
  });
}
