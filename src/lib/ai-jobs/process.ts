import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, jobOffers, type AiJob, users } from '@/db/schema';
import { AIService } from '@/lib/ai-service';
import { baseCvForAiColumns } from '@/lib/job-offer-queries';
import { createAuditLog } from '@/lib/audit';
import { formatCareerProfileContext } from '@/lib/profile-classification';
import { getOwnedApplication } from '@/lib/application-service';
import { completeAiJob, failAiJob, renewAiJobLease } from './queue';
import { processMatchBatch } from './match-batch';
import { log } from '@/lib/logger';
import { parseJsonObject } from './evaluation';
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
  const [user] = await db.select({ name: users.name, email: users.email, subscriptionStatus: users.subscriptionStatus, careerProfile: users.careerProfile })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { user: null, cv: null };
  const [base] = await db.select({ ...baseCvForAiColumns, templateName: cvs.templateName, accentColor: cvs.accentColor, fontFamily: cvs.fontFamily, pageMargin: cvs.pageMargin, scale: cvs.scale })
    .from(cvs).where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt), desc(cvs.id)).limit(1);
  return { user, cv: base || null };
}

function offerPayload(job: AiJob): OfferJobPayload {
  return job.payload as OfferJobPayload;
}

async function processEvaluate(job: AiJob) {
  const payload = offerPayload(job);
  const { user, cv: baseCv } = await resolveBaseCv(job.userId);
  if (!user || !baseCv) throw new Error('Base CV not found');

  const evalText = await consumeStream(await AIService.analyzeSTARStream({
    cvMarkdown: baseCv.content,
    jobDescription: payload.description,
    company: payload.company,
    jobTitle: payload.title,
    userSubscriptionStatus: user.subscriptionStatus,
    careerProfile: user.careerProfile,
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
    careerProfileContext: formatCareerProfileContext(user.careerProfile),
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
  const started = Date.now();
  let renewing = false;
  const heartbeat = job.kind === 'match_batch' ? setInterval(() => {
    if (renewing) return;
    renewing = true;
    void renewAiJobLease(job).then(owned => {
      if (!owned && heartbeat) clearInterval(heartbeat);
    }).catch(() => {
      // An expired lease prevents progress/completion writes; a worker can safely reclaim the job.
      log({ event: 'ai_job_lease_renewal_failed', level: 'warn', jobId: job.id });
    }).finally(() => { renewing = false; });
  }, 30_000) : null;
  try {
    let result: Record<string, unknown>;
    switch (job.kind) {
      case 'match_batch':
        result = await processMatchBatch(job);
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
    const completed = await completeAiJob(job.id, result, job);
    if (!completed) return;
    log({
      event: 'ai_job_completed',
      userId: job.userId,
      jobId: job.id,
      kind: job.kind,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    log({
      event: 'ai_job_failed',
      level: 'error',
      userId: job.userId,
      jobId: job.id,
      kind: job.kind,
      durationMs: Date.now() - started,
      error,
    });
    await failAiJob(job, error);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
