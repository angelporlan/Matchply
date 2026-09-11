import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, jobOffers, type AiJob, users } from '@/db/schema';
import { AIService } from '@/lib/ai-service';
import { createAuditLog } from '@/lib/audit';
import { formatCareerProfileContext } from '@/lib/profile-classification';
import {
  getOwnedApplication,
  upsertExternalApplication,
} from '@/lib/application-service';
import { completeAiJob, failAiJob } from './queue';
import { evaluationFields, formatMcpEvaluateMessage, formatMcpOptimizeMessage, parseJsonObject } from './evaluation';
import type { OfferJobPayload, OptimizeApplicationPayload } from './types';

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

async function resolveBaseCv(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { user: null, cv: null };
  if (user.mcpCvId) {
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

function offerPayload(job: AiJob): OfferJobPayload {
  return job.payload as OfferJobPayload;
}

async function processMcpOptimize(job: AiJob) {
  const payload = offerPayload(job);
  const { user, cv: baseCv } = await resolveBaseCv(job.userId);
  if (!user || !baseCv) throw new Error('Base CV not found');

  const cvMarkdown = await consumeStream(await AIService.optimizeCVStream({
    baseCvMarkdown: baseCv.content,
    jobDescription: payload.description,
    userSubscriptionStatus: user.subscriptionStatus,
    candidateName: user.name || '',
    careerProfileContext: formatCareerProfileContext(user.mcpProfile),
  }));
  if (!cvMarkdown) throw new Error('AI returned an empty CV');

  const [newCv] = await db.insert(cvs).values({
    userId: job.userId,
    title: `Optimizado (MCP) - ${payload.title} (${payload.company})`,
    content: cvMarkdown,
    isBase: false,
    isPrincipal: false,
    templateName: baseCv.templateName,
    accentColor: baseCv.accentColor,
    fontFamily: baseCv.fontFamily,
    pageMargin: baseCv.pageMargin,
    scale: baseCv.scale,
  }).returning();

  let parsed: Record<string, any> | null = null;
  try {
    const evalText = await consumeStream(await AIService.analyzeSTARStream({
      cvMarkdown: baseCv.content,
      jobDescription: payload.description,
      company: payload.company,
      userSubscriptionStatus: user.subscriptionStatus,
      mcpProfile: user.mcpProfile,
    }));
    parsed = parseJsonObject(evalText);
  } catch (error) {
    console.error('[ai-job mcp_optimize] evaluation failed:', error);
  }

  const fields = parsed ? evaluationFields(parsed) : {
    scoreOverall: null,
    scoreBreakdown: null,
    redFlags: null,
    tldr: null,
    legitimacyTier: null,
    rawReport: null,
  };

  const { offer } = await upsertExternalApplication(job.userId, {
    title: payload.title,
    company: payload.company,
    url: payload.url || undefined,
    platform: payload.platform || 'other',
    description: payload.description,
    status: 'interested',
    source: 'mcp_server',
    externalSource: payload.externalSource || undefined,
    externalId: payload.externalId || undefined,
    cvId: newCv.id,
    ...fields,
  });

  await createAuditLog('mcp_cv_optimize', job.userId, user.email, {
    offerId: offer.id,
    title: payload.title,
    company: payload.company,
    cvId: newCv.id,
    jobId: job.id,
  });

  return {
    offerId: offer.id,
    cvId: newCv.id,
    parsed,
    message: formatMcpOptimizeMessage({
      company: payload.company,
      title: payload.title,
      offerId: offer.id,
      parsed,
    }),
  };
}

async function processMcpEvaluate(job: AiJob) {
  const payload = offerPayload(job);
  const { user, cv: baseCv } = await resolveBaseCv(job.userId);
  if (!user || !baseCv) throw new Error('Base CV not found');

  const evalText = await consumeStream(await AIService.analyzeSTARStream({
    cvMarkdown: baseCv.content,
    jobDescription: payload.description,
    company: payload.company,
    userSubscriptionStatus: user.subscriptionStatus,
    mcpProfile: user.mcpProfile,
  }));
  const parsed = parseJsonObject(evalText);
  if (!parsed) throw new Error('AI did not return valid JSON evaluation');

  const fields = evaluationFields(parsed);
  const { offer } = await upsertExternalApplication(job.userId, {
    title: payload.title,
    company: payload.company,
    url: payload.url || undefined,
    platform: payload.platform || 'other',
    description: payload.description,
    status: 'interested',
    source: 'mcp_server',
    externalSource: payload.externalSource || undefined,
    externalId: payload.externalId || undefined,
    ...fields,
  });

  await createAuditLog('mcp_job_offer_evaluate', job.userId, user.email, {
    offerId: offer.id,
    title: payload.title,
    company: payload.company,
    score: parsed.score,
    jobId: job.id,
  });

  return {
    offerId: offer.id,
    parsed,
    tldr: fields.tldr,
    legitimacyTier: fields.legitimacyTier,
    message: formatMcpEvaluateMessage({
      company: payload.company,
      title: payload.title,
      offerId: offer.id,
      parsed,
      tldr: fields.tldr,
      legitimacyTier: fields.legitimacyTier,
    }),
  };
}

async function processEvaluate(job: AiJob) {
  const payload = offerPayload(job);
  const { user, cv: baseCv } = await resolveBaseCv(job.userId);
  if (!user || !baseCv) throw new Error('Base CV not found');

  const evalText = await consumeStream(await AIService.analyzeSTARStream({
    cvMarkdown: baseCv.content,
    jobDescription: payload.description,
    company: payload.company,
    userSubscriptionStatus: user.subscriptionStatus,
    mcpProfile: user.mcpProfile,
  }));
  const parsed = parseJsonObject(evalText);
  if (!parsed) throw new Error('AI did not return valid JSON evaluation');

  await createAuditLog('job_offer_evaluate_api', job.userId, user.email, {
    title: payload.title,
    company: payload.company,
    score: parsed.score,
    jobId: job.id,
  });
  return { parsed };
}

async function processOptimizeApplication(job: AiJob) {
  const payload = job.payload as OptimizeApplicationPayload;
  const offer = await getOwnedApplication(job.userId, payload.offerId);
  if (offer.cvId && !payload.regenerate) {
    return { offerId: offer.id, cvId: offer.cvId, created: false };
  }
  if (!offer.description) throw new Error('Application has no job description');
  const { user, cv: baseCv } = await resolveBaseCv(job.userId);
  if (!user || !baseCv) throw new Error('Base CV not found');

  const content = await consumeStream(await AIService.optimizeCVStream({
    baseCvMarkdown: baseCv.content,
    jobDescription: offer.description,
    userSubscriptionStatus: user.subscriptionStatus,
    candidateName: user.name || '',
    careerProfileContext: formatCareerProfileContext(user.mcpProfile),
  }));
  if (!content) throw new Error('AI returned an empty CV');

  const [newCv] = await db.insert(cvs).values({
    userId: job.userId,
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

  await db.update(jobOffers).set({
    cvId: newCv.id,
    updatedAt: new Date(),
  }).where(eq(jobOffers.id, offer.id));

  return { offerId: offer.id, cvId: newCv.id, created: true };
}

export async function processAiJob(job: AiJob) {
  try {
    let result: Record<string, unknown>;
    switch (job.kind) {
      case 'mcp_optimize':
        result = await processMcpOptimize(job);
        break;
      case 'mcp_evaluate':
        result = await processMcpEvaluate(job);
        break;
      case 'evaluate':
        result = await processEvaluate(job);
        break;
      case 'optimize_application':
        result = await processOptimizeApplication(job);
        break;
      default:
        throw new Error(`Unknown AI job kind: ${job.kind}`);
    }
    await completeAiJob(job.id, result);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'ai_job_failed',
      jobId: job.id,
      kind: job.kind,
      error: error instanceof Error ? error.message : 'unknown',
    }));
    await failAiJob(job, error);
  }
}
