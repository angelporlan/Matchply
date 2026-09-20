import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { jobResearchRuns } from '@/db/schema';
import { runResearch } from '@/lib/research/orchestrator';
import { log } from '@/lib/logger';
import { createIdleBackoff, createWorkerShutdown } from '@/lib/worker-idle';

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;
const GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.RESEARCH_GLOBAL_CONCURRENCY || 2));
const PIPELINE_ENABLED = process.env.RESEARCH_PIPELINE_ENABLED === 'true';

type ClaimedRun = typeof jobResearchRuns.$inferSelect;

async function claimNextRun(): Promise<ClaimedRun | null> {
  const now = new Date();
  return db.transaction(async tx => {
    const result = await tx.execute(sql`
      SELECT r.* FROM "job_research_run" r
      WHERE (
        r."status" = 'queued'
        OR (r."status" = 'running' AND r."leaseUntil" < ${now})
      )
      AND (r."nextAttemptAt" IS NULL OR r."nextAttemptAt" <= ${now})
      AND r."attempt" < ${MAX_ATTEMPTS}
      AND NOT EXISTS (
        SELECT 1 FROM "job_research_run" active
        WHERE active."userId" = r."userId"
          AND active."status" = 'running'
          AND active."leaseUntil" > ${now}
      )
      ORDER BY r."createdAt" ASC
      FOR UPDATE OF r SKIP LOCKED
      LIMIT 1
    `);
    const candidate = result.rows[0] as ClaimedRun | undefined;
    if (!candidate) return null;

    const leaseUntil = new Date(Date.now() + LEASE_MS);
    const [claimed] = await tx.update(jobResearchRuns).set({
      status: 'running',
      attempt: candidate.attempt + 1,
      leaseUntil,
      startedAt: candidate.startedAt || now,
      updatedAt: now,
      lastError: null,
    }).where(and(
      eq(jobResearchRuns.id, candidate.id),
      or(eq(jobResearchRuns.status, 'queued'), eq(jobResearchRuns.status, 'running')),
    )).returning();
    return claimed || null;
  });
}

async function processRun(run: ClaimedRun) {
  try {
    await Promise.race([
      runResearch(run.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RESEARCH_TIMEOUT')), 180_000)),
    ]);
  } catch (error) {
    const terminal = run.attempt >= MAX_ATTEMPTS;
    const now = new Date();
    await db.update(jobResearchRuns).set({
      status: terminal ? 'failed' : 'queued',
      lastError: error instanceof Error ? error.message.slice(0, 1_000) : 'RESEARCH_FAILED',
      nextAttemptAt: terminal ? null : new Date(Date.now() + Math.min(60_000, run.attempt * 10_000)),
      leaseUntil: null,
      completedAt: terminal ? now : null,
      updatedAt: now,
    }).where(eq(jobResearchRuns.id, run.id));
  }
}

const shutdown = createWorkerShutdown();

async function workerLoop(slot: number) {
  const idle = createIdleBackoff();
  while (!shutdown.stopping) {
    try {
      const run = await claimNextRun();
      if (run) {
        idle.reset();
        log({ event: 'research_claimed', slot, runId: run.id, attempt: run.attempt });
        await processRun(run);
        continue;
      }
    } catch (error) {
      log({ event: 'research_worker_error', level: 'error', slot, error });
    }
    await idle.wait();
  }
}

log({ event: 'research_worker_started', concurrency: GLOBAL_CONCURRENCY });
async function main() {
  if (!PIPELINE_ENABLED) {
    log({ event: 'research_worker_disabled' });
    await shutdown.waitUntilSignal();
    return;
  }
  await Promise.all(Array.from({ length: GLOBAL_CONCURRENCY }, (_, index) => workerLoop(index + 1)));
}

void main();
