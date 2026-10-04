import type { AiJob } from '@/db/schema';
import { getAiJob, isTerminalAiJob } from './queue';

const WAIT_MS = Math.max(5_000, Number(process.env.AI_JOB_WAIT_MS || 90_000));

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function settleAiJob(jobId: string, waitMs = WAIT_MS): Promise<AiJob> {
  const started = Date.now();

  while (Date.now() - started < waitMs) {
    const job = await getAiJob(jobId);
    if (!job) throw new Error('AI_JOB_NOT_FOUND');
    if (isTerminalAiJob(job)) return job;

    await sleep(500);
  }

  const timedOut = await getAiJob(jobId);
  if (!timedOut) throw new Error('AI_JOB_NOT_FOUND');
  return timedOut;
}
