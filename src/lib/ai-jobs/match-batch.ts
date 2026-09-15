import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, jobOffers, users, type AiJob } from '@/db/schema';
import { AIService } from '@/lib/ai-service';
import { baseCvForAiColumns, curateOfferColumns } from '@/lib/job-offer-queries';
import { persistMatchResult } from '@/lib/match-persistence';
import { log } from '@/lib/logger';
import { canAccessFeature } from '@/lib/subscription';
import { SubscriptionAccessError } from '@/lib/permissions';
import { readCurrentMatchBatchResult, readMatchBatchInputHashes } from './match-batch-progress';
import { ownsAiJobLease, saveAiJobProgress } from './queue';
import type { MatchBatchPayload } from './types';
import {
  addMatchBatchError,
  addMatchBatchScore,
  pendingMatchOfferIds,
  type MatchBatchError,
  type MatchBatchResult,
} from './match-batch-state';

export async function processMatchBatch(job: AiJob): Promise<MatchBatchResult & { inputHashes: Record<string, string> }> {
  const payload = job.payload as MatchBatchPayload;
  if (!Array.isArray(payload.offerIds) || payload.offerIds.some(id => typeof id !== 'string')) {
    throw new Error('INVALID_MATCH_BATCH');
  }
  let progress = await readCurrentMatchBatchResult(job);
  const inputHashes = readMatchBatchInputHashes(job.result);
  const pendingIds = pendingMatchOfferIds(payload.offerIds, progress);
  if (!pendingIds.length) return { ...progress, inputHashes };

  const [userRows, cvRows, offers] = await Promise.all([
    db.select({ careerProfile: users.careerProfile, subscriptionStatus: users.subscriptionStatus, isGuest: users.isGuest })
      .from(users).where(eq(users.id, job.userId)).limit(1),
    db.select(baseCvForAiColumns).from(cvs).where(eq(cvs.userId, job.userId))
      .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt), desc(cvs.id)).limit(1),
    db.select(curateOfferColumns).from(jobOffers)
      .where(and(eq(jobOffers.userId, job.userId), inArray(jobOffers.id, pendingIds))),
  ]);
  const user = userRows[0];
  if (!user) throw new Error('USER_NOT_FOUND');
  if (!canAccessFeature(user.subscriptionStatus, 'applications', { isGuest: user.isGuest })) throw new SubscriptionAccessError('applications');

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

  await AIService.curateOffersBatch({
    baseCvMarkdown: cvRows[0]?.content || '',
    userCareerProfile: user.careerProfile || {},
    userSubscriptionStatus: user.subscriptionStatus,
    offers,
    kind: 'triage',
    targetThreshold: payload.targetThreshold,
    evaluationStartedAt: job.createdAt.toISOString(),
    onItemError: recordError,
    onBatchComplete: items => serializeProgress(async () => {
      for (const item of items) {
        if (!await ownsAiJobLease(job)) throw new Error('AI_JOB_LEASE_LOST');
        const saved = await persistMatchResult(job.userId, item, { jobId: job.id, attempt: job.attempt });
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
  await progressTail;

  for (const id of pendingMatchOfferIds(payload.offerIds, progress)) {
    if (!progress.errors.some(error => error.id === id)) {
      await recordError({ id, message: 'La IA no devolvió una evaluación completa.' });
    }
  }
  log({ event: 'match_batch_progress', jobId: job.id, userId: job.userId,
    evaluated: progress.items.length, failed: progress.errors.length, attempt: job.attempt });
  if (progress.items.length !== new Set(payload.offerIds).size) {
    throw new Error('Algunas ofertas no se han actualizado; se conservan sus resultados anteriores.');
  }
  return { ...progress, inputHashes };
}
