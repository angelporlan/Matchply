import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers } from '@/db/schema';
import { requireUserFeature } from '@/lib/permissions';

export const PIPELINE_STATUSES = ['interested', 'applied', 'interview', 'offer', 'rejected'] as const;
export type PipelineStatus = typeof PIPELINE_STATUSES[number];

export class ApplicationConflictError extends Error {}
export class ApplicationNotFoundError extends Error {}

export type ExternalApplicationInput = {
  cvId?: string | null;
  title: string;
  company: string;
  url?: string;
  platform?: string;
  description?: string;
  status?: PipelineStatus;
  source?: string;
  externalSource?: string;
  externalId?: string;
  livenessStatus?: string;
  sourceMetadata?: unknown;
  scoreOverall?: number | string | null;
  scoreBreakdown?: unknown;
  tldr?: string | null;
  redFlags?: unknown;
  legitimacyTier?: string | null;
  rawReport?: string | null;
  targetProofPoints?: unknown;
  coverLetter?: string;
  outreachMessage?: string;
  interviewQuestions?: unknown;
  nextFollowupDate?: string | null;
  rejectionPatternTags?: unknown;
};

export function normalizeStatus(value?: string): PipelineStatus {
  return PIPELINE_STATUSES.includes(value as PipelineStatus)
    ? value as PipelineStatus
    : 'interested';
}

export type ApplicationMatchStrategy =
  | { strategy: 'external'; externalSource: string; externalId: string }
  | { strategy: 'url'; url: string }
  | { strategy: 'title_company'; title: string; company: string };

export function applicationMatchStrategy(input: Partial<Pick<ExternalApplicationInput, 'externalSource' | 'externalId' | 'url' | 'title' | 'company'>>): ApplicationMatchStrategy | null {
  if (input.externalSource && input.externalId) {
    return { strategy: 'external', externalSource: input.externalSource, externalId: input.externalId };
  }
  if (input.url) {
    return { strategy: 'url', url: input.url };
  }
  if (input.title && input.company) {
    return { strategy: 'title_company', title: input.title, company: input.company };
  }
  return null;
}

async function findExisting(userId: string, input: ExternalApplicationInput) {
  const match = applicationMatchStrategy(input);
  if (!match) return null;
  if (match.strategy === 'external') {
    const [offer] = await db.select().from(jobOffers).where(and(
      eq(jobOffers.userId, userId),
      eq(jobOffers.externalSource, match.externalSource),
      eq(jobOffers.externalId, match.externalId),
    )).limit(1);
    return offer || null;
  }
  if (match.strategy === 'url') {
    const [offer] = await db.select().from(jobOffers).where(and(
      eq(jobOffers.userId, userId),
      eq(jobOffers.url, match.url),
    )).limit(1);
    return offer || null;
  }
  const [offer] = await db.select().from(jobOffers).where(and(
    eq(jobOffers.userId, userId),
    eq(jobOffers.title, match.title),
    eq(jobOffers.company, match.company),
  )).limit(1);
  return offer || null;
}

export async function upsertExternalApplication(userId: string, input: ExternalApplicationInput) {
  await requireUserFeature(userId, 'kanban');
  const existing = await findExisting(userId, input);
  const score = input.scoreOverall === null || input.scoreOverall === undefined
    ? null
    : Number(input.scoreOverall);
  const data = {
    title: input.title.trim(),
    company: input.company.trim(),
    url: input.url?.trim() || null,
    platform: input.platform || 'other',
    description: input.description || null,
    status: existing?.status || normalizeStatus(input.status),
    source: input.source || 'api',
    externalSource: input.externalSource || existing?.externalSource || null,
    externalId: input.externalId || existing?.externalId || null,
    livenessStatus: input.livenessStatus || 'active',
    sourceMetadata: input.sourceMetadata ?? existing?.sourceMetadata ?? null,
    scoreOverall: Number.isFinite(score) ? score : null,
    scoreBreakdown: input.scoreBreakdown ?? null,
    tldr: input.tldr || null,
    redFlags: input.redFlags ?? null,
    legitimacyTier: input.legitimacyTier || null,
    rawReport: input.rawReport || null,
    targetProofPoints: input.targetProofPoints ?? null,
    coverLetter: input.coverLetter || null,
    outreachMessage: input.outreachMessage || null,
    interviewQuestions: input.interviewQuestions ?? null,
    cvId: input.cvId !== undefined ? input.cvId : existing?.cvId || null,
    nextFollowupDate: input.nextFollowupDate !== undefined
      ? (input.nextFollowupDate ? new Date(input.nextFollowupDate) : null)
      : existing?.nextFollowupDate || null,
    rejectionPatternTags: input.rejectionPatternTags ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(jobOffers).set(data).where(eq(jobOffers.id, existing.id)).returning();
    return { offer: updated, created: false };
  }

  const [created] = await db.insert(jobOffers).values({ ...data, userId }).returning();
  return { offer: created, created: true };
}

export async function getOwnedApplication(userId: string, offerId: string) {
  await requireUserFeature(userId, 'kanban');
  const [offer] = await db.select().from(jobOffers).where(and(
    eq(jobOffers.id, offerId),
    eq(jobOffers.userId, userId),
  )).limit(1);
  if (!offer) throw new ApplicationNotFoundError('Application not found');
  return offer;
}
