import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { AIService } from '@/lib/ai-service';
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
  scoreOverall?: number | string | null;
  scoreBreakdown?: unknown;
  tldr?: string | null;
  redFlags?: unknown;
  legitimacyTier?: string | null;
  rawReport?: string | null;
  targetProofPoints?: unknown;
  coverLetter?: string;
  outreachMessage?: string;
  interviewStories?: unknown;
  interviewQuestions?: unknown;
  nextFollowupDate?: string | null;
  rejectionPatternTags?: unknown;
};

function normalizeStatus(value?: string): PipelineStatus {
  return PIPELINE_STATUSES.includes(value as PipelineStatus)
    ? value as PipelineStatus
    : 'interested';
}

async function findExisting(userId: string, input: ExternalApplicationInput) {
  const externalSource = input.externalSource;
  const externalId = input.externalId;
  const hasExternalIdentity = Boolean(externalSource && externalId);
  if (hasExternalIdentity) {
    const [offer] = await db.select().from(jobOffers).where(and(
      eq(jobOffers.userId, userId),
      eq(jobOffers.externalSource, externalSource!),
      eq(jobOffers.externalId, externalId!),
    )).limit(1);
    if (offer) return offer;
  }
  if (input.url) {
    const [offer] = await db.select().from(jobOffers).where(and(
      eq(jobOffers.userId, userId),
      eq(jobOffers.url, input.url),
    )).limit(1);
    if (offer) return offer;
  }
  // Title/company matching is retained only for legacy clients without an
  // exact external identity or URL. It must not merge two distinct local jobs.
  if (hasExternalIdentity || input.url) return null;
  const [offer] = await db.select().from(jobOffers).where(and(
    eq(jobOffers.userId, userId),
    eq(jobOffers.title, input.title),
    eq(jobOffers.company, input.company),
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
    scoreOverall: Number.isFinite(score) ? score : null,
    scoreBreakdown: input.scoreBreakdown ?? null,
    tldr: input.tldr || null,
    redFlags: input.redFlags ?? null,
    legitimacyTier: input.legitimacyTier || null,
    rawReport: input.rawReport || null,
    targetProofPoints: input.targetProofPoints ?? null,
    coverLetter: input.coverLetter || null,
    outreachMessage: input.outreachMessage || null,
    interviewStories: input.interviewStories ?? null,
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

export async function listExternalApplications(
  userId: string,
  filters: { externalSource?: string; updatedSince?: string } = {},
) {
  await requireUserFeature(userId, 'kanban');
  const clauses = [eq(jobOffers.userId, userId)];
  if (filters.externalSource) clauses.push(eq(jobOffers.externalSource, filters.externalSource));
  if (filters.updatedSince) {
    const since = new Date(filters.updatedSince);
    if (!Number.isNaN(since.valueOf())) clauses.push(gt(jobOffers.updatedAt, since));
  }
  return db.select().from(jobOffers).where(and(...clauses)).orderBy(desc(jobOffers.updatedAt));
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

export async function updateExternalApplication(
  userId: string,
  offerId: string,
  input: { status?: string; nextFollowupDate?: string | null; expectedUpdatedAt?: string },
) {
  const existing = await getOwnedApplication(userId, offerId);
  if (input.expectedUpdatedAt && existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new ApplicationConflictError('Application changed in Matchply');
  }
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (input.status !== undefined) {
    if (!PIPELINE_STATUSES.includes(input.status as PipelineStatus)) throw new Error('Invalid status');
    values.status = input.status;
  }
  if (input.nextFollowupDate !== undefined) {
    values.nextFollowupDate = input.nextFollowupDate ? new Date(input.nextFollowupDate) : null;
  }
  const [updated] = await db.update(jobOffers).set(values).where(eq(jobOffers.id, offerId)).returning();
  return updated;
}

async function resolveBaseCv(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user?.mcpCvId) {
    const [selected] = await db.select().from(cvs).where(and(
      eq(cvs.id, user.mcpCvId),
      eq(cvs.userId, userId),
    )).limit(1);
    if (selected) return { user, cv: selected };
  }
  const [base] = await db.select().from(cvs).where(and(
    eq(cvs.userId, userId),
    eq(cvs.isBase, true),
  )).orderBy(desc(cvs.isPrincipal)).limit(1);
  return { user, cv: base || null };
}

async function consumeStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let content = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    content += decoder.decode(value, { stream: true });
  }
  return content.trim();
}

export async function optimizeApplicationCv(userId: string, offerId: string, regenerate = false) {
  const offer = await getOwnedApplication(userId, offerId);
  if (offer.cvId && !regenerate) {
    return { offer, cvId: offer.cvId, created: false };
  }
  if (!offer.description) throw new Error('Application has no job description');
  const { user, cv: baseCv } = await resolveBaseCv(userId);
  if (!user || !baseCv) throw new Error('Base CV not found');

  const stream = await AIService.optimizeCVStream({
    baseCvMarkdown: baseCv.content,
    jobDescription: offer.description,
    userSubscriptionStatus: user.subscriptionStatus,
    candidateName: user.name || '',
  });
  const content = await consumeStream(stream);
  if (!content) throw new Error('AI returned an empty CV');

  const [newCv] = await db.insert(cvs).values({
    userId,
    title: `Optimizado - ${offer.title} (${offer.company})`,
    content,
    isBase: false,
    isPrincipal: false,
    templateName: baseCv.templateName,
    accentColor: baseCv.accentColor,
    fontFamily: baseCv.fontFamily,
    pageMargin: baseCv.pageMargin,
    scale: baseCv.scale,
  }).returning();

  const [updatedOffer] = await db.update(jobOffers).set({
    cvId: newCv.id,
    updatedAt: new Date(),
  }).where(eq(jobOffers.id, offerId)).returning();
  return { offer: updatedOffer, cvId: newCv.id, created: true };
}

export async function createApplicationCvFromMarkdown(
  userId: string,
  offerId: string,
  content: string,
  title?: string,
) {
  const offer = await getOwnedApplication(userId, offerId);
  const { cv: baseCv } = await resolveBaseCv(userId);
  const [newCv] = await db.insert(cvs).values({
    userId,
    title: title?.trim() || `[API] - ${offer.title} (${offer.company})`,
    content: content.trim(),
    isBase: false,
    isPrincipal: false,
    templateName: baseCv?.templateName || 'harvard',
    accentColor: baseCv?.accentColor || '#1a5f7a',
    fontFamily: baseCv?.fontFamily || 'helvetica',
    pageMargin: baseCv?.pageMargin ?? 36,
    scale: baseCv?.scale ?? 1,
  }).returning();
  const [updatedOffer] = await db.update(jobOffers).set({
    cvId: newCv.id,
    updatedAt: new Date(),
  }).where(eq(jobOffers.id, offerId)).returning();
  return { offer: updatedOffer, cvId: newCv.id, created: true };
}
