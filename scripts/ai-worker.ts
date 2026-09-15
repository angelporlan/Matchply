import { processAiJob } from '@/lib/ai-jobs/process';
import { claimNextAiJob, failAiJob, getAiJob } from '@/lib/ai-jobs/queue';
import { log } from '@/lib/logger';

const GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.AI_GLOBAL_CONCURRENCY || 2));
const JOB_TIMEOUT_MS = Math.max(30_000, Number(process.env.AI_JOB_TIMEOUT_MS || 120_000));
const ENABLED = process.env.AI_WORKER_ENABLED !== 'false';

async function processRun() {
  const job = await claimNextAiJob();
  if (!job) return false;

  log({ event: 'ai_job_claimed', jobId: job.id, kind: job.kind, attempt: job.attempt });
  try {
    // Batches renew their lease and bound individual LLM requests. A timer must
    // not requeue a still-running batch after it has saved partial results.
    if (job.kind === 'match_batch') {
      await processAiJob(job);
      return true;
    }
    await Promise.race([
      processAiJob(job),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI_JOB_TIMEOUT')), JOB_TIMEOUT_MS)),
    ]);
  } catch (error) {
    const latest = await getAiJob(job.id);
    if (latest && latest.status === 'running') {
      await failAiJob(latest, error);
    }
    log({ event: 'ai_job_worker_error', level: 'error', jobId: job.id, error });
  }
  return true;
}

async function workerLoop(slot: number) {
  while (true) {
    try {
      const worked = await processRun();
      if (worked) continue;
    } catch (error) {
      log({ event: 'ai_worker_loop_error', level: 'error', slot, error });
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
}

log({ event: 'ai_worker_started', concurrency: GLOBAL_CONCURRENCY });

async function main() {
  if (!ENABLED) {
    log({ event: 'ai_worker_disabled' });
    await new Promise<void>(() => undefined);
    return;
  }
  await Promise.all(Array.from({ length: GLOBAL_CONCURRENCY }, (_, index) => workerLoop(index + 1)));
}

void main();
