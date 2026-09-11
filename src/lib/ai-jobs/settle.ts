import type { AiJob } from '@/db/schema';
import { processAiJob } from './process';
import { claimAiJobById, getAiJob, isTerminalAiJob } from './queue';

const WAIT_MS = Math.max(5_000, Number(process.env.AI_JOB_WAIT_MS || 90_000));
const STEAL_AFTER_MS = Math.max(0, Number(process.env.AI_INLINE_STEAL_MS || 1_500));

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function settleAiJob(jobId: string, waitMs = WAIT_MS): Promise<AiJob> {
  const started = Date.now();
  let stolen = false;

  while (Date.now() - started < waitMs) {
    const job = await getAiJob(jobId);
    if (!job) throw new Error('AI_JOB_NOT_FOUND');
    if (isTerminalAiJob(job)) return job;

    if (!stolen && Date.now() - started >= STEAL_AFTER_MS && job.status === 'queued') {
      const claimed = await claimAiJobById(job.id);
      if (claimed) {
        stolen = true;
        try {
          await processAiJob(claimed);
        } catch {
          // processAiJob already persisted the failure/retry.
        }
        const latest = await getAiJob(jobId);
        if (latest && isTerminalAiJob(latest)) return latest;
      }
    }

    await sleep(500);
  }

  const timedOut = await getAiJob(jobId);
  if (!timedOut) throw new Error('AI_JOB_NOT_FOUND');
  return timedOut;
}
