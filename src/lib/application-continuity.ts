import { lockCvUser } from '@/lib/cv-access';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql, desc } from 'drizzle-orm';
import { db } from '@/db';
import { applicationEvents, cvExports, jobOffers } from '@/db/schema';
import { transitionFields } from '@/lib/application-transition';
export type ContinuityTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type ApplicationCommand = {
  commandId?: string; status?: string; nextFollowupDate?: Date | null; nextAction?: string | null;
  action?: 'complete' | 'postpone' | 'schedule' | 'sent' | 'response' | 'reviewed';
  version?: number; exportId?: string | null; source?: string;
};
export function commandHash(input: unknown) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function applyApplicationCommand(tx: ContinuityTx, userId: string, offerId: string, input: ApplicationCommand) {
  if (!input || typeof input !== 'object' || (input.nextAction != null && typeof input.nextAction !== 'string') || (input.action !== undefined && !['complete', 'postpone', 'schedule', 'sent', 'response', 'reviewed'].includes(input.action))) throw new Error('INVALID_COMMAND');
  if (!uuid.test(offerId) || (input.commandId && !uuid.test(input.commandId)) || (input.exportId && !uuid.test(input.exportId))) throw new Error('INVALID_ID');
  await lockCvUser(tx, userId);
  const [offer] = await tx.select({ id: jobOffers.id, status: jobOffers.status, nextFollowupDate: jobOffers.nextFollowupDate, nextAction: jobOffers.nextAction, followupVersion: jobOffers.followupVersion })
    .from(jobOffers).where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId))).for('update');
  if (!offer) throw new Error('NOT_FOUND');
  const commandId = input.commandId || randomUUID();
  const hash = commandHash({ ...input, commandId: undefined });
  const [replay] = await tx.select({ inputHash: applicationEvents.inputHash }).from(applicationEvents).where(and(eq(applicationEvents.userId, userId), eq(applicationEvents.offerId, offerId), eq(applicationEvents.commandId, commandId)));
  if (replay) { if (replay.inputHash !== hash) throw new Error('COMMAND_CONFLICT'); return offer; }
  if (input.version !== undefined && input.version !== offer.followupVersion) throw new Error('FOLLOWUP_CONFLICT');
  if (['complete', 'postpone', 'schedule'].includes(input.action || '') && input.version === undefined) throw new Error('FOLLOWUP_VERSION_REQUIRED');
  if (['schedule', 'postpone'].includes(input.action || '') && (offer.status === 'rejected' || offer.status.startsWith('archived'))) throw new Error('ACTION_CLOSED');
  if (input.action === 'postpone' && (!offer.nextFollowupDate || !input.nextFollowupDate)) throw new Error('DATE_REQUIRED');
  if (input.action === 'complete' && !offer.nextFollowupDate) throw new Error('NO_PENDING_ACTION');
  if (input.action === 'schedule' && !input.nextFollowupDate) throw new Error('DATE_REQUIRED');
  if (input.exportId) {
    if (input.action !== 'sent') throw new Error('INVALID_EXPORT_ACTION');
    const [document] = await tx.select({ id: cvExports.id }).from(cvExports).where(and(eq(cvExports.id, input.exportId), eq(cvExports.userId, userId), sql`(${cvExports.expiresAt} is null or ${cvExports.expiresAt} > now())`)).for('update');
    if (!document) throw new Error('EXPORT_NOT_AVAILABLE');
    await tx.update(cvExports).set({ expiresAt: null }).where(eq(cvExports.id, document.id));
  }
  const fields = transitionFields(offer, {
    status: input.action === 'sent' ? offer.status === 'interested' ? 'applied' : offer.status : input.status,
    nextFollowupDate: input.action === 'complete' ? null : input.nextFollowupDate,
    nextAction: input.nextAction,
  });
  // A duplicate state update is not a second interview/submission.
  const changed = fields.status !== offer.status || fields.followupVersion !== offer.followupVersion;
  const kind = input.action ? ({ complete: 'followup_completed', postpone: 'followup_postponed', schedule: 'followup_scheduled', sent: 'sent', response: 'response', reviewed: 'reviewed' } as const)[input.action] : changed ? fields.status !== offer.status ? 'status_changed' : 'followup_scheduled' : 'noop';
  await tx.update(jobOffers).set(fields).where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)));
  await tx.insert(applicationEvents).values({ userId, offerId, commandId, inputHash: hash, kind, exportId: input.exportId || null, payload: { from: offer.status, to: fields.status, previousDate: offer.nextFollowupDate?.toISOString() || null, date: fields.nextFollowupDate?.toISOString() || null, action: fields.nextAction, previousAction: offer.nextAction, source: input.source || 'app', cancelled: Boolean(offer.nextFollowupDate && !fields.nextFollowupDate && input.action !== 'complete') } });
  return { ...offer, ...fields };
}
export async function applicationTimeline(userId: string, offerId: string, page = 0) {
  const safePage = Number.isSafeInteger(page) ? Math.max(0, Math.min(page, 10000)) : 0;
  return db.select({ id: applicationEvents.id, kind: applicationEvents.kind, exportId: applicationEvents.exportId, payload: applicationEvents.payload, createdAt: applicationEvents.createdAt, filename: cvExports.filename })
    .from(applicationEvents).leftJoin(cvExports, and(eq(cvExports.id, applicationEvents.exportId), eq(cvExports.userId, userId)))
    .where(and(eq(applicationEvents.userId, userId), eq(applicationEvents.offerId, offerId), sql`${applicationEvents.kind} <> 'noop'`)).orderBy(desc(applicationEvents.createdAt), desc(applicationEvents.id)).limit(20).offset(safePage * 20);
}

export async function deleteOwnedApplication(userId: string, offerId: string) {
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const deleted = await tx.delete(jobOffers).where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId))).returning({ id: jobOffers.id });
    if (!deleted.length) throw new Error('NOT_FOUND');
    await tx.execute(sql`delete from cv_export e where e."userId" = ${userId}::uuid and e."expiresAt" is null
      and not exists (select 1 from application_event a where a."exportId" = e.id)`);
  });
}
