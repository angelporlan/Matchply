'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, cvs, jobOffers, jobResearchRuns, users } from '@/db/schema';
import { createAuditLog } from '@/lib/audit';
import { agentResearchAdmission, profileGoalOffer } from '@/lib/agent-cv';
import { getCvAccess } from '@/lib/cv-access';
import { enqueueCvOptimization } from '@/lib/cv-optimization/service';
import { parseMatchConstraints } from '@/lib/curation-constraints';
import { baseCvForAiColumns } from '@/lib/job-offer-queries';
import { buildCandidateEvidence } from '@/lib/matching/candidate-card';
import { enqueueResearchForOffer } from '@/lib/research/queue';
import {
  LlmCredentialError,
  deleteLlmCredential,
  listUserProviderModels,
  llmCredentialWriteBlocked,
  saveAgentModels,
  saveLlmCredential,
} from '@/lib/user-llm-credential';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import {
  AccountSuspendedError,
  SupportActionBlockedError,
} from '@/lib/request-errors';
import { auditActorFields, requireAccountContext, requireProductContext } from '@/lib/request-context';
import { SubscriptionAccessError } from '@/lib/permissions';
import { UsageError } from '@/lib/usage';
import { AiUsageHttpError } from '@/lib/ai-usage-http';
import { ApplicationNotFoundError } from '@/lib/application-service';

function actionError(error: unknown): { error: string } {
  if (error instanceof LlmCredentialError) return { error: error.code };
  if (error instanceof UsageError) return { error: error.code === 'OFFER_NOT_FOUND' ? 'not_found' : error.code };
  if (error instanceof AiUsageHttpError) return { error: error.code };
  if (error instanceof SubscriptionAccessError) return { error: 'subscription_required' };
  if (error instanceof RateLimitError) return { error: 'rate_limited' };
  if (error instanceof AccountSuspendedError || error instanceof SupportActionBlockedError) return { error: 'forbidden' };
  if (error instanceof ApplicationNotFoundError) return { error: 'SCOUT_REQUIRED' };
  if (error instanceof Error && error.message === 'Unauthorized') return { error: 'unauthorized' };
  return { error: 'generic' };
}

async function loadProfileEvidence(userId: string) {
  const access = await getCvAccess(userId);
  const [[user], [cv]] = await Promise.all([
    db.select({ careerProfile: users.careerProfile }).from(users).where(eq(users.id, userId)).limit(1),
    access.baseCvId
      ? db.select(baseCvForAiColumns).from(cvs).where(and(eq(cvs.userId, userId), eq(cvs.id, access.baseCvId))).limit(1)
      : Promise.resolve([] as Array<{ id: string; content: string }>),
  ]);
  const evidence = buildCandidateEvidence(user?.careerProfile, cv?.content || '', parseMatchConstraints(user?.careerProfile || {}));
  return { access, careerProfile: user?.careerProfile, evidence, baseCvId: access.baseCvId };
}

export async function saveLlmCredentialAction(input: { provider: string; apiKey: string }) {
  try {
    const ctx = await requireAccountContext();
    const user = ctx.realUser;
    const blocked = llmCredentialWriteBlocked({ authenticated: true, impersonation: false, isGuest: Boolean(user.isGuest) });
    if (blocked) throw new SupportActionBlockedError();
    consumeRateLimit(`agents:llm-key:${user.id}`, 5, 10 * 60_000);
    const credential = await saveLlmCredential(user.id, input);
    let models: Array<{ id: string; name: string }> = [];
    try {
      models = await listUserProviderModels(user.id);
    } catch (error) {
      if (error instanceof LlmCredentialError) {
        await createAuditLog('llm_credential_saved', user.id, user.email, {
          provider: credential.provider,
          lastChars: credential.lastChars,
        }, auditActorFields(ctx));
        revalidatePath('/dashboard/agents');
        return { error: error.code, credential };
      }
      throw error;
    }
    await createAuditLog('llm_credential_saved', user.id, user.email, {
      provider: credential.provider,
      lastChars: credential.lastChars,
    }, auditActorFields(ctx));
    revalidatePath('/dashboard/agents');
    return { success: true as const, credential, models };
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

export async function listLlmModelsAction() {
  try {
    const ctx = await requireAccountContext();
    const user = ctx.realUser;
    const blocked = llmCredentialWriteBlocked({ authenticated: true, impersonation: false, isGuest: Boolean(user.isGuest) });
    if (blocked) throw new SupportActionBlockedError();
    consumeRateLimit(`agents:llm-models:${user.id}`, 10, 10 * 60_000);
    const models = await listUserProviderModels(user.id);
    return { success: true as const, models };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveAgentModelsAction(input: { scout?: string; research?: string; cv?: string }) {
  try {
    const ctx = await requireAccountContext();
    const user = ctx.realUser;
    const blocked = llmCredentialWriteBlocked({ authenticated: true, impersonation: false, isGuest: Boolean(user.isGuest) });
    if (blocked) throw new SupportActionBlockedError();
    const credential = await saveAgentModels(user.id, input);
    await createAuditLog('llm_agent_models_saved', user.id, user.email, {
      scout: credential.scoutModel,
      research: credential.researchModel,
      cv: credential.cvModel,
    }, auditActorFields(ctx));
    revalidatePath('/dashboard/agents');
    return { success: true as const, credential };
  } catch (error) {
    return actionError(error);
  }
}

export async function startAgentResearchAction() {
  try {
    const ctx = await requireProductContext({ feature: 'deepResearch' });
    if (ctx.impersonation) throw new SupportActionBlockedError();
    const user = ctx.effectiveUser;
    if (!user) throw new Error('Unauthorized');
    const { evidence } = await loadProfileEvidence(user.id);
    const [offer] = await db
      .select({ id: jobOffers.id })
      .from(jobOffers)
      .where(and(
        eq(jobOffers.userId, user.id),
        sql`coalesce(btrim(${jobOffers.description}), '') <> ''`,
      ))
      .orderBy(desc(jobOffers.updatedAt))
      .limit(1);
    const admission = agentResearchAdmission({ sufficient: evidence.sufficient, hasDescribedOffer: Boolean(offer) });
    if (admission || !offer) return { error: admission ?? 'SCOUT_REQUIRED' };
    const [latest] = await db
      .select({ status: jobResearchRuns.status })
      .from(jobResearchRuns)
      .where(and(eq(jobResearchRuns.userId, user.id), eq(jobResearchRuns.jobOfferId, offer.id)))
      .orderBy(desc(jobResearchRuns.createdAt))
      .limit(1);
    const queued = await enqueueResearchForOffer(user.id, offer.id, {
      trigger: 'agents_tab',
      retryFailed: latest?.status === 'failed',
    });
    if (!queued.accepted || !queued.run) return { error: queued.status === 'quota_exceeded' ? 'QUOTA_EXCEEDED' : 'generic' };
    await createAuditLog('agent_research_requested', user.id, user.email, {
      jobOfferId: offer.id,
      runId: queued.run.id,
    }, auditActorFields(ctx));
    revalidatePath('/dashboard/agents');
    return { runId: queued.run.id, status: queued.status, jobOfferId: offer.id };
  } catch (error) {
    return actionError(error);
  }
}

export async function startAgentCvAction() {
  try {
    const ctx = await requireProductContext({ allowGuest: true });
    if (ctx.impersonation) throw new SupportActionBlockedError();
    const user = ctx.effectiveUser;
    if (!user) throw new Error('Unauthorized');
    const { access, careerProfile, evidence } = await loadProfileEvidence(user.id);
    if (!evidence.sufficient) return { error: 'PROFILE_REQUIRED' };
    if (!access.baseCvId) return { error: 'need_cv' };
    const goal = profileGoalOffer(careerProfile);
    const requestId = randomUUID();
    const result = await enqueueCvOptimization(user.id, {
      baseCvId: access.baseCvId,
      requestId,
      jobTitle: goal.jobTitle,
      company: goal.company,
      jobDescription: goal.jobDescription,
      url: goal.url,
      platform: goal.platform,
      addToApplications: goal.addToApplications,
    });
    const [job] = await db.select({ payload: aiJobs.payload }).from(aiJobs).where(eq(aiJobs.id, result.jobId)).limit(1);
    const optimizationId = job?.payload && typeof job.payload === 'object' && 'optimizationId' in job.payload && typeof job.payload.optimizationId === 'string'
      ? job.payload.optimizationId
      : null;
    await createAuditLog('agent_cv_optimize_requested', user.id, user.email, {
      jobId: result.jobId,
      jobTitle: goal.jobTitle,
    }, auditActorFields(ctx));
    revalidatePath('/dashboard/agents');
    return { jobId: result.jobId, cvId: result.cvId, optimizationId };
  } catch (error) {
    return actionError(error);
  }
}
