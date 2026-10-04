import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { jobResearchRuns } from '@/db/schema';
import { reserveUsage, releaseUsage, renewUsageOperation } from '@/lib/usage';

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;
export type ResearchRun = typeof jobResearchRuns.$inferSelect;
function owned(run: ResearchRun) { return and(eq(jobResearchRuns.id, run.id), eq(jobResearchRuns.attempt, run.attempt), eq(jobResearchRuns.status, 'running'), gt(jobResearchRuns.leaseUntil, new Date())); }

export async function claimNextResearchRun(): Promise<ResearchRun | null> {
  const now = new Date();
  // A worker dying on its last attempt must not strand the reservation forever.
  const expired = await db.select({ id: jobResearchRuns.id, userId: jobResearchRuns.userId }).from(jobResearchRuns)
    .where(and(eq(jobResearchRuns.status, 'running'), sql`${jobResearchRuns.leaseUntil} < ${now}`, sql`${jobResearchRuns.attempt} >= ${MAX_ATTEMPTS}`)).limit(100);
  for (const candidate of expired) await db.transaction(async tx => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${`usage:${candidate.userId}`})) AS acquired`);
    if (!lock.rows[0]?.acquired) return;
    const [failed] = await tx.update(jobResearchRuns).set({ status: 'failed', leaseUntil: null, completedAt: now, updatedAt: now, lastError: 'RESEARCH_LEASE_EXPIRED' })
      .where(and(eq(jobResearchRuns.id, candidate.id), eq(jobResearchRuns.status, 'running'), sql`${jobResearchRuns.leaseUntil} < ${now}`, sql`${jobResearchRuns.attempt} >= ${MAX_ATTEMPTS}`)).returning();
    if (failed?.usageOperationId) await releaseUsage(tx, failed.usageOperationId);
  });
  return db.transaction(async tx => {
    const result = await tx.execute(sql`
      SELECT r."id" FROM "job_research_run" r
      WHERE (r."status" = 'queued' OR (r."status" = 'running' AND r."leaseUntil" < ${now}))
        AND (r."nextAttemptAt" IS NULL OR r."nextAttemptAt" <= ${now}) AND r."attempt" < ${MAX_ATTEMPTS}
        AND NOT EXISTS (SELECT 1 FROM "job_research_run" active WHERE active."userId" = r."userId" AND active."id" <> r."id" AND active."status" = 'running' AND active."leaseUntil" > ${now})
      ORDER BY r."createdAt" ASC FOR UPDATE OF r SKIP LOCKED LIMIT 1
    `);
    const candidateId = result.rows[0]?.id as string | undefined;
    const [candidate] = candidateId ? await tx.select().from(jobResearchRuns).where(eq(jobResearchRuns.id, candidateId)).limit(1) : [];
    if (!candidate) return null;
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${`usage:${candidate.userId}`})) AS acquired`);
    if (!lock.rows[0]?.acquired) return null;
    const active = await tx.select({ id: jobResearchRuns.id }).from(jobResearchRuns)
      .where(and(eq(jobResearchRuns.userId, candidate.userId), eq(jobResearchRuns.status, 'running'), gt(jobResearchRuns.leaseUntil, now), sql`${jobResearchRuns.id} <> ${candidate.id}`)).limit(1);
    if (active.length) return null;
    let operationId = candidate.usageOperationId;
    if (!operationId) {
      try {
        const operation = await reserveUsage(tx, candidate.userId, { bucket: 'research', action: 'research_offer', requestId: candidate.id, input: { jobOfferId: candidate.jobOfferId }, jobId: candidate.id });
        operationId = operation.id;
      } catch (error) {
        await tx.update(jobResearchRuns).set({ status: 'failed', lastError: error instanceof Error ? error.message : 'RESEARCH_ADMISSION_FAILED', completedAt: now, leaseUntil: null }).where(eq(jobResearchRuns.id, candidate.id));
        return null;
      }
    }
    const [claimed] = await tx.update(jobResearchRuns).set({ status: 'running', attempt: candidate.attempt + 1,
      usageOperationId: operationId, leaseUntil: new Date(Date.now() + LEASE_MS), startedAt: candidate.startedAt || now, updatedAt: now, lastError: null,
    }).where(eq(jobResearchRuns.id, candidate.id)).returning();
    return claimed || null;
  });
}
export async function renewResearchLease(run: ResearchRun): Promise<boolean> {
  const rows = await db.update(jobResearchRuns).set({ leaseUntil: new Date(Date.now() + LEASE_MS), updatedAt: new Date() }).where(owned(run)).returning({ id: jobResearchRuns.id });
  if (rows.length && run.usageOperationId) await renewUsageOperation(run.usageOperationId);
  return rows.length === 1;
}
export async function failResearchRun(run: ResearchRun, error: unknown) {
  const terminal = run.attempt >= MAX_ATTEMPTS;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${run.userId}`}))`);
    const [updated] = await tx.update(jobResearchRuns).set({ status: terminal ? 'failed' : 'queued',
      lastError: error instanceof Error ? error.message.slice(0, 1000) : 'RESEARCH_FAILED',
      nextAttemptAt: terminal ? null : new Date(Date.now() + Math.min(60_000, run.attempt * 10_000)),
      leaseUntil: null, completedAt: terminal ? new Date() : null, updatedAt: new Date(),
    }).where(owned(run)).returning();
    if (updated && terminal && updated.usageOperationId) await releaseUsage(tx, updated.usageOperationId);
    return updated;
  });
}
