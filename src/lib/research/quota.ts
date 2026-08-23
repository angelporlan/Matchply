import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { jobResearchRuns, researchQuotaPeriods } from '@/db/schema';
import { requireUserFeature } from '@/lib/permissions';
import { ResearchStatus } from './types';

export const DEFAULT_RESEARCH_MONTHLY_QUOTA = 10;

export function utcMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function configuredResearchQuota() {
  const configured = Number(process.env.RESEARCH_MONTHLY_QUOTA || DEFAULT_RESEARCH_MONTHLY_QUOTA);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_RESEARCH_MONTHLY_QUOTA;
}

export type QuotaReservation = {
  accepted: boolean;
  status: ResearchStatus;
  run: typeof jobResearchRuns.$inferSelect | null;
  alreadyExists: boolean;
};

/** Reserva una oferta distinta de forma transaccional y devuelve el run existente si es un duplicado. */
export async function reserveResearchQuota(
  userId: string,
  jobOfferId: string,
  trigger = 'extension_capture',
): Promise<QuotaReservation> {
  await requireUserFeature(userId, 'deepResearch');
  const periodStart = utcMonthStart();
  const now = new Date();

  return db.transaction(async tx => {
    const [active] = await tx.select().from(jobResearchRuns).where(and(
      eq(jobResearchRuns.userId, userId),
      eq(jobResearchRuns.jobOfferId, jobOfferId),
      sql`${jobResearchRuns.status} in ('queued', 'running')`,
    )).limit(1);
    if (active) return { accepted: true, status: active.status as ResearchStatus, run: active, alreadyExists: true };

    await tx.insert(researchQuotaPeriods).values({ userId, periodStart }).onConflictDoNothing({
      target: [researchQuotaPeriods.userId, researchQuotaPeriods.periodStart],
    });

    // El lock impide que dos capturas concurrentes superen el límite mensual.
    const locked = await tx.execute(sql`
      SELECT "id", "usedOffers"
      FROM "research_quota_period"
      WHERE "userId" = ${userId} AND "periodStart" = ${periodStart}
      FOR UPDATE
    `);
    const period = (locked.rows[0] || {}) as { id?: string; usedOffers?: number };
    const existing = await tx.select().from(jobResearchRuns).where(and(
      eq(jobResearchRuns.userId, userId),
      eq(jobResearchRuns.jobOfferId, jobOfferId),
      eq(jobResearchRuns.quotaPeriodStart, periodStart),
    )).limit(1);
    if (existing[0]) {
      const run = existing[0];
      return { accepted: run.status !== 'quota_exceeded', status: run.status as ResearchStatus, run, alreadyExists: true };
    }

    if (Number(period.usedOffers || 0) >= configuredResearchQuota()) {
      return { accepted: false, status: 'quota_exceeded', run: null, alreadyExists: false };
    }

    await tx.update(researchQuotaPeriods).set({
      usedOffers: sql`${researchQuotaPeriods.usedOffers} + 1`,
      updatedAt: now,
    }).where(eq(researchQuotaPeriods.id, period.id!));

    const [run] = await tx.insert(jobResearchRuns).values({
      userId,
      jobOfferId,
      status: 'queued',
      trigger,
      attempt: 0,
      quotaPeriodStart: periodStart,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return { accepted: true, status: 'queued', run, alreadyExists: false };
  });
}
