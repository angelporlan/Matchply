'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, jobOffers } from '@/db/schema';
import { createAuditLog } from '@/lib/audit';
import { AGENT_CV_OFFER_COLUMNS, agentCvAdmissionError } from '@/lib/agent-cv';
import { getCvAccess } from '@/lib/cv-access';
import { enqueueCvOptimization } from '@/lib/cv-optimization/service';
import { LlmCredentialError, deleteLlmCredential, llmCredentialWriteBlocked, saveLlmCredential } from '@/lib/user-llm-credential';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import {
  AccountSuspendedError,
  SupportActionBlockedError,
} from '@/lib/request-errors';
import { auditActorFields, requireAccountContext, requireProductContext } from '@/lib/request-context';
import { SubscriptionAccessError } from '@/lib/permissions';
import { UsageError } from '@/lib/usage';
import { AiUsageHttpError } from '@/lib/ai-usage-http';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function actionError(error: unknown): { error: string } {
  if (error instanceof LlmCredentialError) return { error: error.code };
  if (error instanceof UsageError) return { error: error.code === 'OFFER_NOT_FOUND' ? 'not_found' : error.code };
  if (error instanceof AiUsageHttpError) return { error: error.code };
  if (error instanceof SubscriptionAccessError) return { error: 'subscription_required' };
  if (error instanceof RateLimitError) return { error: 'rate_limited' };
  if (error instanceof AccountSuspendedError || error instanceof SupportActionBlockedError) return { error: 'forbidden' };
  if (error instanceof Error && error.message === 'Unauthorized') return { error: 'unauthorized' };
  return { error: 'generic' };
}

export async function saveLlmCredentialAction(input: { provider: string; apiKey: string }) {
  try {
    const ctx = await requireAccountContext();
    const user = ctx.realUser;
    const blocked = llmCredentialWriteBlocked({ authenticated: true, impersonation: false, isGuest: Boolean(user.isGuest) });
    if (blocked) throw new SupportActionBlockedError();
    consumeRateLimit(`agents:llm-key:${user.id}`, 5, 10 * 60_000);
    const credential = await saveLlmCredential(user.id, input);
    await createAuditLog('llm_credential_saved', user.id, user.email, {
      provider: credential.provider,
      lastChars: credential.lastChars,
    }, auditActorFields(ctx));
    revalidatePath('/dashboard/agents');
    return { success: true as const, credential };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteLlmCredentialAction() {
  try {
    const ctx = await requireAccountContext();
    const user = ctx.realUser;
    const blocked = llmCredentialWriteBlocked({ authenticated: true, impersonation: false, isGuest: Boolean(user.isGuest) });
    if (blocked) throw new SupportActionBlockedError();
    consumeRateLimit(`agents:llm-key:${user.id}`, 5, 10 * 60_000);
    const credential = await deleteLlmCredential(user.id);
    await createAuditLog('llm_credential_deleted', user.id, user.email, {}, auditActorFields(ctx));
    revalidatePath('/dashboard/agents');
    return { success: true as const, credential };
  } catch (error) {
    return actionError(error);
  }
}

export async function startAgentCvAction(jobOfferId: string) {
  try {
    const ctx = await requireProductContext({ allowGuest: true });
    if (ctx.impersonation) throw new SupportActionBlockedError();
    const user = ctx.effectiveUser;
    if (!user) throw new Error('Unauthorized');
    if (typeof jobOfferId !== 'string' || !UUID.test(jobOfferId)) return { error: 'not_found' };
    const access = await getCvAccess(user.id);
    if (!access.baseCvId) return { error: 'need_cv' };
    const [offer] = await db
      .select(AGENT_CV_OFFER_COLUMNS)
      .from(jobOffers)
      .where(and(eq(jobOffers.id, jobOfferId), eq(jobOffers.userId, user.id)))
      .limit(1);
    const admission = agentCvAdmissionError(offer ?? null);
    const description = offer?.description?.trim() ?? '';
    if (admission || !offer || !description) return { error: admission ?? 'not_found' };
    const requestId = randomUUID();
    const result = await enqueueCvOptimization(user.id, {
      baseCvId: access.baseCvId,
      jobOfferId: offer.id,
      requestId,
      jobTitle: offer.title,
      company: offer.company,
      jobDescription: description,
      url: offer.url,
      platform: offer.platform || 'other',
      addToApplications: false,
    });
    const [job] = await db.select({ payload: aiJobs.payload }).from(aiJobs).where(eq(aiJobs.id, result.jobId)).limit(1);
    const optimizationId = job?.payload && typeof job.payload === 'object' && 'optimizationId' in job.payload && typeof job.payload.optimizationId === 'string'
      ? job.payload.optimizationId
      : null;
    await createAuditLog('agent_cv_optimize_requested', user.id, user.email, {
      jobOfferId: offer.id,
      jobId: result.jobId,
    }, auditActorFields(ctx));
    revalidatePath('/dashboard/agents');
    return { jobId: result.jobId, cvId: result.cvId, optimizationId };
  } catch (error) {
    return actionError(error);
  }
}
