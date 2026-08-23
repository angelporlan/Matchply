import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { jobResearchRuns } from '@/db/schema';
import { runResearch } from '@/lib/research/orchestrator';

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;
const GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.RESEARCH_GLOBAL_CONCURRENCY || 2));
const PIPELINE_ENABLED = process.env.RESEARCH_PIPELINE_ENABLED === 'true';

type ClaimedRun = typeof jobResearchRuns.$inferSelect;

async function claimNextRun(): Promise<ClaimedRun | null> {
  const now = new Date();
  return db.transaction(async tx => {
    const result = await tx.execute(sql`
      SELECT * FROM "job_research_run"
      WHERE (
        "status" = 'queued'
        OR ("status" = 'running' AND "leaseUntil" < ${now})
      )
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      AND "attempt" < ${MAX_ATTEMPTS}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const candidate = result.rows[0] as ClaimedRun | undefined;
    if (!candidate) return null;

    const [userActive] = await tx.execute(sql`
      SELECT count(*)::int AS count FROM "job_research_run"
      WHERE "userId" = ${candidate.userId} AND "status" = 'running' AND "leaseUntil" > ${now}
    `).then(result => result.rows as Array<{ count: number }>);
    if (Number(userActive?.count || 0) > 0) return null;

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

async function workerLoop(slot: number) {
  while (true) {
    try {
      const run = await claimNextRun();
      if (run) {
        console.info(JSON.stringify({ event: 'research_claimed', slot, runId: run.id, attempt: run.attempt }));
        await processRun(run);
        continue;
      }
    } catch (error) {
      console.error(JSON.stringify({ event: 'research_worker_error', slot, error: error instanceof Error ? error.message : 'unknown' }));
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
}

console.info(JSON.stringify({ event: 'research_worker_started', concurrency: GLOBAL_CONCURRENCY }));
async function main() {
  if (!PIPELINE_ENABLED) {
    console.info(JSON.stringify({ event: 'research_worker_disabled' }));
    await new Promise<void>(() => undefined);
    return;
  }
  await Promise.all(Array.from({ length: GLOBAL_CONCURRENCY }, (_, index) => workerLoop(index + 1)));
}

void main();
