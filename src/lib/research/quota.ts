import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { jobResearchRuns } from '@/db/schema';
import { requireUserFeature } from '@/lib/permissions';
import { reserveUsage, utcUsageMonth, UsageError } from '@/lib/usage';
import { getPlanConfig } from '@/lib/plan-store';
import type { ResearchStatus } from './types';

export const DEFAULT_RESEARCH_MONTHLY_QUOTA = 10;
export const utcMonthStart = utcUsageMonth;
export async function configuredResearchQuota() { return (await getPlanConfig()).pro.researchMonthly; }
export type QuotaReservation = { accepted: boolean; status: ResearchStatus; run: typeof jobResearchRuns.$inferSelect | null; alreadyExists: boolean };

/** Admission and operation reservation are committed together; useful reports consume later. */
export async function reserveResearchQuota(userId: string, jobOfferId: string, trigger = 'extension_capture'): Promise<QuotaReservation> {
  await requireUserFeature(userId, 'deepResearch');
  const periodStart = utcMonthStart(), now = new Date();
  try {
    return await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`research:${userId}:${jobOfferId}`}))`);
      const [existing] = await tx.select().from(jobResearchRuns).where(and(eq(jobResearchRuns.userId, userId), eq(jobResearchRuns.jobOfferId, jobOfferId), eq(jobResearchRuns.quotaPeriodStart, periodStart))).limit(1);
      if (existing) return { accepted: existing.status !== 'quota_exceeded', status: existing.status as ResearchStatus, run: existing, alreadyExists: true };
      const id = randomUUID();
      const operation = await reserveUsage(tx, userId, { bucket: 'research', action: 'research_offer', requestId: id, input: { jobOfferId }, jobId: id });
      const [run] = await tx.insert(jobResearchRuns).values({ id, usageOperationId: operation.id, userId, jobOfferId,
        status: 'queued', trigger, attempt: 0, quotaPeriodStart: periodStart, nextAttemptAt: now, createdAt: now, updatedAt: now,
      }).returning();
      return { accepted: true, status: 'queued', run, alreadyExists: false };
    });
  } catch (error) {
    if (error instanceof UsageError && error.code === 'QUOTA_EXCEEDED') return { accepted: false, status: 'quota_exceeded', run: null, alreadyExists: false };
    throw error;
  }
}
