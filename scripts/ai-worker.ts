import { processAiJob } from '@/lib/ai-jobs/process';
import { claimNextAiJob, failAiJob, getAiJob } from '@/lib/ai-jobs/queue';
import { reconcileUsage } from '@/lib/usage';
import { log } from '@/lib/logger';
import { createIdleBackoff, createWorkerShutdown } from '@/lib/worker-idle';

const GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.AI_GLOBAL_CONCURRENCY || 2));
const ENABLED = process.env.AI_WORKER_ENABLED !== 'false';

async function processRun() {
  const job = await claimNextAiJob();
  if (!job) return false;

  log({ event: 'ai_job_claimed', jobId: job.id, kind: job.kind, attempt: job.attempt });
  try {
    await processAiJob(job);
  } catch (error) {
    const latest = await getAiJob(job.id);
    if (latest && latest.status === 'running') {
      await failAiJob(latest, error);
    }
    log({ event: 'ai_job_worker_error', level: 'error', jobId: job.id, error });
  }
  return true;
}

const shutdown = createWorkerShutdown();

let nextReconcileAt = 0;
async function workerLoop(slot: number) {
  const idle = createIdleBackoff();
  while (!shutdown.stopping) {
    try {
      if (Date.now() >= nextReconcileAt) { nextReconcileAt = Date.now() + 60_000; await reconcileUsage(); }
      const worked = await processRun();
      if (worked) {
        idle.reset();
        continue;
      }
    } catch (error) {
      log({ event: 'ai_worker_loop_error', level: 'error', slot, error });
    }
    await idle.wait();
  }
}

log({ event: 'ai_worker_started', concurrency: GLOBAL_CONCURRENCY });

async function main() {
  if (!ENABLED) {
    log({ event: 'ai_worker_disabled' });
    await shutdown.waitUntilSignal();
    return;
  }
  await Promise.all(Array.from({ length: GLOBAL_CONCURRENCY }, (_, index) => workerLoop(index + 1)));
}

void main();
