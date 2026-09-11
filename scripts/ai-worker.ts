import { processAiJob } from '@/lib/ai-jobs/process';
import { claimNextAiJob, failAiJob, getAiJob } from '@/lib/ai-jobs/queue';

const GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.AI_GLOBAL_CONCURRENCY || 2));
const JOB_TIMEOUT_MS = Math.max(30_000, Number(process.env.AI_JOB_TIMEOUT_MS || 120_000));
const ENABLED = process.env.AI_WORKER_ENABLED !== 'false';

async function processRun() {
  const job = await claimNextAiJob();
  if (!job) return false;

  console.info(JSON.stringify({ event: 'ai_job_claimed', jobId: job.id, kind: job.kind, attempt: job.attempt }));
  try {
    await Promise.race([
      processAiJob(job),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI_JOB_TIMEOUT')), JOB_TIMEOUT_MS)),
    ]);
  } catch (error) {
    const latest = await getAiJob(job.id);
    if (latest && latest.status === 'running') {
      await failAiJob(latest, error);
    }
    console.error(JSON.stringify({
      event: 'ai_job_worker_error',
      jobId: job.id,
      error: error instanceof Error ? error.message : 'unknown',
    }));
  }
  return true;
}

async function workerLoop(slot: number) {
  while (true) {
    try {
      const worked = await processRun();
      if (worked) continue;
    } catch (error) {
      console.error(JSON.stringify({
        event: 'ai_worker_loop_error',
        slot,
        error: error instanceof Error ? error.message : 'unknown',
      }));
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
}

console.info(JSON.stringify({ event: 'ai_worker_started', concurrency: GLOBAL_CONCURRENCY }));

async function main() {
  if (!ENABLED) {
    console.info(JSON.stringify({ event: 'ai_worker_disabled' }));
    await new Promise<void>(() => undefined);
    return;
  }
  await Promise.all(Array.from({ length: GLOBAL_CONCURRENCY }, (_, index) => workerLoop(index + 1)));
}

void main();
