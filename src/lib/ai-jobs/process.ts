import { processNetworking } from '@/lib/people/ai';
import { db } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { aiJobs, type AiJob } from '@/db/schema';
import { reserveUsage, renewUsageOperation } from '@/lib/usage';
import { getUserPlan } from '@/lib/plan-store';
import { AiUsageHttpError } from '@/lib/ai-usage-http';
import { completeAiJob, failAiJob, renewAiJobLease, saveAiJobProgress } from './queue';
import { processMatchBatch } from './match-batch';
import { log } from '@/lib/logger';
import type { ImportOfferPayload, MatchBatchPayload } from './types';
import { importOffer, OFFER_IMPORT_MODEL, OfferImportError } from '@/lib/offer-import/service';
import { bindAiRuntime, getResolvedAiRuntime } from '@/lib/ai-runtime-store';
import { parseAiRuntimeConfig } from '@/lib/ai-runtime-config';
import { recordAiRunStat } from '@/lib/ai-run-stats';

export async function processAiJob(job: AiJob) {
  const started = Date.now();
  if (!job.usageOperationId) {
    try {
      job = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${job.userId}`}))`);
        const { plan, limits } = await getUserPlan(job.userId, tx);
        const payload = job.payload as MatchBatchPayload;
        const units = job.kind === 'match_batch' ? new Set(payload.offerIds).size : 1;
        if (job.kind === 'match_batch' && units > 1 && plan !== 'pro') throw new AiUsageHttpError(403, 'PRO_REQUIRED', 'El matching en lote requiere Pro.');
        if (job.kind === 'match_batch' && units > Math.max(1, limits.matchBatchSize)) throw new AiUsageHttpError(400, 'MATCH_BATCH_TOO_LARGE', 'El lote supera el tamaño permitido.');
        if (!['match_batch', 'import_offer', 'networking'].includes(job.kind)) throw new AiUsageHttpError(400, 'UNSUPPORTED_AI_JOB', 'Este trabajo de IA ya no está disponible.');
        const operation = await reserveUsage(tx, job.userId, { bucket: job.kind === 'match_batch' ? 'matching' : 'general', requestId: job.id, action: `legacy:${job.kind}`, input: job.payload, units, jobId: job.id });
        const [updated] = await tx.update(aiJobs).set({ usageOperationId: operation.id }).where(eq(aiJobs.id, job.id)).returning();
        return updated;
      });
    } catch (error) { await failAiJob(job, error); return; }
  }
  const snapshot = job.resolvedAiConfig
    ? parseAiRuntimeConfig(job.resolvedAiConfig)
    : await getResolvedAiRuntime();
  return bindAiRuntime(snapshot, async () => {
  let renewing = false;
  const importController = new AbortController();
  const heartbeat = ['match_batch', 'import_offer', 'networking'].includes(job.kind) ? setInterval(() => {
    if (renewing) return;
    renewing = true;
    void renewAiJobLease(job).then(owned => {
      if (!owned) { importController.abort(); if (heartbeat) clearInterval(heartbeat); }
      else if (job.usageOperationId) return renewUsageOperation(job.usageOperationId);
    }).catch(() => {
      // An expired lease prevents progress/completion writes; a worker can safely reclaim the job.
      log({ event: 'ai_job_lease_renewal_failed', level: 'warn', jobId: job.id });
    }).finally(() => { renewing = false; });
  }, 30_000) : null;
  try {
    let result: Record<string, unknown>;
    switch (job.kind) {
      case 'networking':
        result = await processNetworking(job, importController.signal);
        break;
      case 'import_offer': {
        const payload = job.payload as ImportOfferPayload;
        result = await importOffer(payload.url, {
          signal: importController.signal,
          onProgress: async stage => {
            if (!await saveAiJobProgress(job, { stage })) {
              importController.abort();
              throw new OfferImportError('OFFER_LEASE_LOST');
            }
          },
        });
        log({ event: 'offer_import_completed', jobId: job.id, userId: job.userId,
          sourceMethod: result.sourceMethod, durationMs: Date.now() - started });
        break;
      }
      case 'match_batch':
        result = await processMatchBatch(job);
        break;
      default:
        throw new Error(`Unknown AI job kind: ${job.kind}`);
    }
    const completed = await completeAiJob(job.id, result, job);
    if (!completed) return;
    if (job.kind !== 'networking') void recordAiRunStat({
      functionKey: job.kind,
      provider: job.kind === 'import_offer' ? 'openai' : snapshot.general.pro.provider,
      model: job.kind === 'import_offer' ? OFFER_IMPORT_MODEL : snapshot.general.pro.model,
      plan: 'unknown',
      success: true,
      latencyMs: Date.now() - started,
    });
    log({
      event: 'ai_job_completed',
      userId: job.userId,
      initiatedByUserId: job.initiatedByUserId,
      jobId: job.id,
      kind: job.kind,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    log({
      event: 'ai_job_failed',
      level: 'error',
      userId: job.userId,
      initiatedByUserId: job.initiatedByUserId,
      jobId: job.id,
      kind: job.kind,
      durationMs: Date.now() - started,
      error,
    });
    if (job.kind !== 'networking') void recordAiRunStat({
      functionKey: job.kind,
      provider: job.kind === 'import_offer' ? 'openai' : snapshot.general.pro.provider,
      model: job.kind === 'import_offer' ? OFFER_IMPORT_MODEL : snapshot.general.pro.model,
      plan: 'unknown',
      success: false,
      latencyMs: Date.now() - started,
      errorCode: error instanceof Error ? error.message.slice(0, 80) : 'AI_JOB_FAILED',
    });
    await failAiJob(job, error);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
  });
}
