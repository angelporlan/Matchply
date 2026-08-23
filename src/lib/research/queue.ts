import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers, jobResearchAgentRuns, jobResearchRuns, jobResearchSources, researchQuotaPeriods } from '@/db/schema';
import { ApplicationNotFoundError } from '@/lib/application-service';
import { requireUserFeature } from '@/lib/permissions';
import { configuredResearchQuota, reserveResearchQuota } from './quota';
import { ResearchStatus } from './types';

const ACTIVE_STATUSES = ['queued', 'running'] as const;

export async function enqueueResearchForOffer(
  userId: string,
  jobOfferId: string,
  options: { trigger?: string; retryFailed?: boolean } = {},
) {
  await requireUserFeature(userId, 'deepResearch');
  const [offer] = await db.select({ id: jobOffers.id }).from(jobOffers).where(and(
    eq(jobOffers.id, jobOfferId),
    eq(jobOffers.userId, userId),
  )).limit(1);
  if (!offer) throw new ApplicationNotFoundError('Application not found');

  const [latest] = await db.select().from(jobResearchRuns).where(and(
    eq(jobResearchRuns.userId, userId),
    eq(jobResearchRuns.jobOfferId, jobOfferId),
  )).orderBy(desc(jobResearchRuns.createdAt)).limit(1);
  if (latest && ACTIVE_STATUSES.includes(latest.status as typeof ACTIVE_STATUSES[number])) {
    return { accepted: true, status: latest.status as ResearchStatus, run: latest, alreadyExists: true };
  }
  if (latest && latest.status === 'completed' && !options.retryFailed) {
    return { accepted: true, status: 'completed' as ResearchStatus, run: latest, alreadyExists: true };
  }
  if (latest && latest.status === 'partial' && !options.retryFailed) {
    return { accepted: true, status: 'partial' as ResearchStatus, run: latest, alreadyExists: true };
  }
  if (latest && ['failed', 'partial'].includes(latest.status) && (options.retryFailed || latest.status === 'failed')) {
    const [requeued] = await db.update(jobResearchRuns).set({
      status: 'queued',
      lastError: null,
      leaseUntil: null,
      nextAttemptAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(jobResearchRuns.id, latest.id),
      eq(jobResearchRuns.userId, userId),
    )).returning();
    return { accepted: true, status: 'queued' as ResearchStatus, run: requeued, alreadyExists: true };
  }

  return reserveResearchQuota(userId, jobOfferId, options.trigger || 'extension_capture');
}

export async function getResearchRunForUser(userId: string, jobOfferId: string) {
  const [run] = await db.select().from(jobResearchRuns).where(and(
    eq(jobResearchRuns.userId, userId),
    eq(jobResearchRuns.jobOfferId, jobOfferId),
  )).orderBy(desc(jobResearchRuns.createdAt)).limit(1);
  if (!run) return null;
  const [agents, sources] = await Promise.all([
    db.select().from(jobResearchAgentRuns).where(eq(jobResearchAgentRuns.researchRunId, run.id)),
    db.select().from(jobResearchSources).where(eq(jobResearchSources.researchRunId, run.id)),
  ]);
  return { ...run, agents, sources };
}

export async function getResearchQuota(userId: string) {
  const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [period] = await db.select().from(researchQuotaPeriods).where(and(
    eq(researchQuotaPeriods.userId, userId),
    eq(researchQuotaPeriods.periodStart, periodStart),
  )).limit(1);
  return { used: period?.usedOffers || 0, limit: configuredResearchQuota(), periodStart };
}
