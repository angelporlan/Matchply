import { runResearch } from '@/lib/research/orchestrator';
import { claimNextResearchRun, failResearchRun, renewResearchLease, type ResearchRun } from '@/lib/research/worker-queue';
import { reconcileUsage } from '@/lib/usage';
import { log } from '@/lib/logger';
import { createIdleBackoff, createWorkerShutdown } from '@/lib/worker-idle';

const GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.RESEARCH_GLOBAL_CONCURRENCY || 2));
const PIPELINE_ENABLED = process.env.RESEARCH_PIPELINE_ENABLED === 'true';
async function processRun(run: ResearchRun) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('RESEARCH_TIMEOUT')), 180_000);
  let renewing = false;
  const heartbeat = setInterval(() => {
    if (renewing) return; renewing = true;
    void renewResearchLease(run).then(active => { if (!active) controller.abort(new Error('RESEARCH_LEASE_LOST')); })
      .catch(error => log({ event: 'research_lease_renew_failed', level: 'warn', runId: run.id, error }))
      .finally(() => { renewing = false; });
  }, 30_000);
  try { await runResearch(run.id, { attempt: run.attempt, signal: controller.signal }); }
  catch (error) { await failResearchRun(run, error); }
  finally { clearTimeout(timeout); clearInterval(heartbeat); }
}
const shutdown = createWorkerShutdown();
let nextReconcileAt = 0;
async function workerLoop(slot: number) {
  const idle = createIdleBackoff();
  while (!shutdown.stopping) {
    try {
      if (Date.now() >= nextReconcileAt) { nextReconcileAt = Date.now() + 60_000; await reconcileUsage(); }
      const run = await claimNextResearchRun();
      if (run) { idle.reset(); log({ event: 'research_claimed', slot, runId: run.id, attempt: run.attempt }); await processRun(run); continue; }
    } catch (error) { log({ event: 'research_worker_error', level: 'error', slot, error }); }
    await idle.wait();
  }
}
log({ event: 'research_worker_started', concurrency: GLOBAL_CONCURRENCY });
async function main() {
  if (!PIPELINE_ENABLED) { log({ event: 'research_worker_disabled' }); await shutdown.waitUntilSignal(); return; }
  await Promise.all(Array.from({ length: GLOBAL_CONCURRENCY }, (_, index) => workerLoop(index + 1)));
}
void main();
