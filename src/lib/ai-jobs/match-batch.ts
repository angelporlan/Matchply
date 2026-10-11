import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, jobOffers, users, type AiJob } from '@/db/schema';
import { AIService } from '@/lib/ai-service';
import { listStubCanTakeDescription } from '@/lib/extension-capture';
import { baseCvForAiColumns, curateOfferColumns } from '@/lib/job-offer-queries';
import { persistMatchResult } from '@/lib/match-persistence';
import { log } from '@/lib/logger';
import {
  classifyLookupError, decideDescriptionLookup, failedLookupMetadata, isPermanentLookupFailure, offerNeedsDescriptionLookup, recoveredDescriptionMetadata,
} from '@/lib/matching/description-lookup';
import { importOffer, type ImportDependencies } from '@/lib/offer-import/service';
import type { ImportedOffer } from '@/lib/offer-import/types';
import { effectiveSubscriptionStatus } from '@/lib/subscription';
import { SubscriptionAccessError } from '@/lib/permissions';
import { getUserPlan } from '@/lib/plan-store';
import { getCvAccess } from '@/lib/cv-access';
import { readCurrentMatchBatchResult, readMatchBatchInputHashes } from './match-batch-progress';
import { ownsAiJobLease, saveAiJobProgress } from './queue';
import type { MatchBatchPayload } from './types';
import {
  addMatchBatchError,
  addMatchBatchScore,
  pendingMatchOfferIds,
  unfinishedMatchOfferIds,
  type MatchBatchError,
  type MatchBatchResult,
} from './match-batch-state';

type MatchOfferRow = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  sourceMetadata: unknown;
};

async function readOfferText(userId: string, offerId: string) {
  const [row] = await db.select({
    description: jobOffers.description,
    sourceMetadata: jobOffers.sourceMetadata,
  }).from(jobOffers).where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId))).limit(1);
  return row ?? null;
}

function applyStoredText(offer: MatchOfferRow, row: { description: string | null; sourceMetadata: unknown }) {
  offer.description = row.description;
  offer.sourceMetadata = row.sourceMetadata;
}

/** Keep a confirmed miss on the same URL so the match retry does not search it again. */
async function rememberLookupFailure(userId: string, offer: MatchOfferRow, code: string, url: string): Promise<'ready' | 'failed' | 'gone'> {
  const fresh = await readOfferText(userId, offer.id);
  if (!fresh) return 'gone';
  if (!offerNeedsDescriptionLookup({ ...offer, description: fresh.description, sourceMetadata: fresh.sourceMetadata })) {
    applyStoredText(offer, fresh);
    return 'ready';
  }
  const sourceMetadata = failedLookupMetadata(fresh.sourceMetadata, code, url);
  await db.update(jobOffers).set({ sourceMetadata, updatedAt: new Date() })
    .where(and(eq(jobOffers.id, offer.id), eq(jobOffers.userId, userId)));
  offer.sourceMetadata = sourceMetadata;
  return 'failed';
}

/** Save the looked-up description only. Title and company stay as captured. */
async function saveRecoveredDescription(userId: string, offer: MatchOfferRow, imported: ImportedOffer): Promise<'ready' | 'gone'> {
  const fresh = await readOfferText(userId, offer.id);
  if (!fresh) return 'gone';
  const current = { ...offer, description: fresh.description, sourceMetadata: fresh.sourceMetadata };
  if (!offerNeedsDescriptionLookup(current) || !listStubCanTakeDescription(fresh, imported.jobDescription)) {
    applyStoredText(offer, fresh);
    return 'ready';
  }
  const sourceMetadata = recoveredDescriptionMetadata(fresh.sourceMetadata, imported.sources, imported.sourceMethod);
  await db.update(jobOffers).set({ description: imported.jobDescription, sourceMetadata, updatedAt: new Date() })
    .where(and(eq(jobOffers.id, offer.id), eq(jobOffers.userId, userId)));
  offer.description = imported.jobDescription;
  offer.sourceMetadata = sourceMetadata;
  log({ event: 'offer_description_recovered', userId, offerId: offer.id, sourceMethod: imported.sourceMethod });
  return 'ready';
}

export async function processMatchBatch(
  job: AiJob,
  signal?: AbortSignal,
  lookupDependencies: Pick<ImportDependencies, 'download' | 'respond' | 'apiKey'> = {},
): Promise<MatchBatchResult & { inputHashes: Record<string, string> }> {
  const payload = job.payload as MatchBatchPayload;
  if (!Array.isArray(payload.offerIds) || payload.offerIds.some(id => typeof id !== 'string')) {
    throw new Error('INVALID_MATCH_BATCH');
  }
  let progress = await readCurrentMatchBatchResult(job);
  const inputHashes = readMatchBatchInputHashes(job.result);
  const pendingIds = pendingMatchOfferIds(payload.offerIds, progress);
  if (!pendingIds.length) return { ...progress, inputHashes };
  const cvAccess = await getCvAccess(job.userId);

  const [userRows, cvRows, offers] = await Promise.all([
    db.select({
      careerProfile: users.careerProfile,
      subscriptionStatus: users.subscriptionStatus,
      isGuest: users.isGuest,
      proGrantedUntil: users.proGrantedUntil,
    })
      .from(users).where(eq(users.id, job.userId)).limit(1),
    db.select(baseCvForAiColumns).from(cvs).where(and(eq(cvs.userId, job.userId), cvAccess.baseCvId ? eq(cvs.id, cvAccess.baseCvId) : cvAccess.activeIds.length ? inArray(cvs.id, cvAccess.activeIds) : sql`false`))
      .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt), desc(cvs.id)).limit(1),
    db.select(curateOfferColumns).from(jobOffers)
      .where(and(eq(jobOffers.userId, job.userId), inArray(jobOffers.id, pendingIds))),
  ]);
  const user = userRows[0];
  if (!user) throw new Error('USER_NOT_FOUND');
  const { plan, limits } = await getUserPlan(job.userId);
  if (!job.usageOperationId && payload.offerIds.length > 1 && plan !== 'pro') throw new SubscriptionAccessError('advancedAi');
  if (!job.usageOperationId && payload.offerIds.length > Math.max(1, limits.matchBatchSize)) throw new Error('MATCH_BATCH_TOO_LARGE');

  // AI micro-batches complete concurrently; serialize saves so progress cannot lose another batch's items.
  let progressTail: Promise<void> = Promise.resolve();
  const serializeProgress = (callback: () => Promise<void>) => {
    const operation = progressTail.then(callback);
    progressTail = operation;
    return operation;
  };
  const saveProgress = async () => {
    if (!await saveAiJobProgress(job, { ...progress, inputHashes })) throw new Error('AI_JOB_LEASE_LOST');
  };
  const recordError = (error: MatchBatchError) => serializeProgress(async () => {
    progress = addMatchBatchError(progress, error);
    await saveProgress();
  });

  const foundIds = new Set(offers.map(offer => offer.id));
  for (const id of pendingIds) {
    if (!foundIds.has(id)) await recordError({ id, message: 'La oferta ya no está disponible.' });
  }

  // Decisions only scores. Offers that already have a description are scored first.
  // A list card or a blank description is retrieved with the existing Responses search, then scored the same way.
  const scoreOffers = (rows: typeof offers) => AIService.curateOffersBatch({
    baseCvMarkdown: cvRows[0]?.content || '',
    userCareerProfile: user.careerProfile || {},
    userSubscriptionStatus: effectiveSubscriptionStatus(user),
    offers: rows,
    kind: payload.kind || 'triage',
    targetThreshold: payload.targetThreshold,
    evaluationStartedAt: job.createdAt.toISOString(),
    onItemError: recordError,
    onBatchComplete: items => serializeProgress(async () => {
      for (const item of items) {
        if (!await ownsAiJobLease(job)) throw new Error('AI_JOB_LEASE_LOST');
        const saved = await persistMatchResult(job.userId, item, { jobId: job.id, attempt: job.attempt, usageOperationId: job.usageOperationId });
        if (saved) {
          inputHashes[item.id] = item.inputHash;
          progress = addMatchBatchScore(progress, { id: item.id, score: item.score });
        } else {
          progress = addMatchBatchError(progress, {
            id: item.id,
            message: 'Los datos han cambiado. Solicita un nuevo cálculo para actualizar esta oferta.',
          });
        }
        // Observers see success only once the offer AND this progress record have been saved.
        await saveProgress();
      }
    }),
  });

  const ready = offers.filter(offer => decideDescriptionLookup(offer).action === 'ready');
  const readyIds = new Set(ready.map(offer => offer.id));
  await scoreOffers(ready);

  const reportLookup = async (offer: typeof offers[number], failure: { code: string; message: string; remember: boolean }, url: string) => {
    const kept = failure.remember ? await rememberLookupFailure(job.userId, offer, failure.code, url) : 'failed';
    if (kept === 'ready') await scoreOffers([offer]);
    else if (kept === 'gone') await recordError({ id: offer.id, message: 'La oferta ya no está disponible.' });
    else {
      await recordError({ id: offer.id, message: failure.message, ...(isPermanentLookupFailure(failure.code) ? { code: 'lookup' as const } : {}) });
      log({ event: 'offer_description_lookup_failed', level: 'warn', userId: job.userId, offerId: offer.id, jobId: job.id, code: failure.code });
    }
  };
  for (const offer of offers) {
    if (readyIds.has(offer.id)) continue;
    const decision = decideDescriptionLookup(offer);
    if (decision.action === 'ready') { await scoreOffers([offer]); continue; }
    if (signal?.aborted || !await ownsAiJobLease(job)) throw new Error('AI_JOB_LEASE_LOST');
    if (decision.action === 'fail') {
      await reportLookup(offer, decision, String(offer.url || '').trim());
      continue;
    }
    let recovered = false;
    try {
      const imported = await importOffer(decision.url, { ...lookupDependencies, signal });
      if (signal?.aborted || !await ownsAiJobLease(job)) throw new Error('AI_JOB_LEASE_LOST');
      if (await saveRecoveredDescription(job.userId, offer, imported) === 'gone') {
        await recordError({ id: offer.id, message: 'La oferta ya no está disponible.' });
      } else recovered = true;
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === 'AI_JOB_LEASE_LOST')) throw new Error('AI_JOB_LEASE_LOST');
      await reportLookup(offer, classifyLookupError(error), decision.url);
    }
    // Persist and publish this score before retrieving the next description.
    // Scoring/persistence failures must not be classified as retrieval failures.
    if (recovered) await scoreOffers([offer]);
  }
  await progressTail;

  for (const id of pendingMatchOfferIds(payload.offerIds, progress)) {
    if (!progress.errors.some(error => error.id === id)) {
      await recordError({ id, message: 'La IA no devolvió una evaluación completa.' });
    }
  }
  log({ event: 'match_batch_progress', jobId: job.id, userId: job.userId,
    evaluated: progress.items.length, failed: progress.errors.length, attempt: job.attempt });
  if (unfinishedMatchOfferIds(payload.offerIds, progress).length) {
    throw new Error('Algunas ofertas no se han actualizado; se conservan sus resultados anteriores.');
  }
  return { ...progress, inputHashes };
}
