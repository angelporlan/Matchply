"use server";
import { userErrorMessage } from '@/lib/user-errors';
import { publicErrorBody } from '@/lib/public-errors';

import { db } from "@/db";
import { jobOffers, cvs, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { findOrCreateCompany } from "@/lib/company-service";
import { log } from "@/lib/logger";
import { jobOfferOwnershipColumns } from "@/lib/job-offer-queries";
import { auditActorFields, requireProductContext } from "@/lib/request-context";
import { enqueueMatchBatchJob } from '@/lib/ai-jobs/queue';
import { settleAiJob } from '@/lib/ai-jobs/settle';
import { readCurrentMatchBatchResult } from '@/lib/ai-jobs/match-batch-progress';
import { aiRequestId } from '@/lib/ai-usage-http';
import { applyApplicationCommand, applicationTimeline, deleteOwnedApplication, type ApplicationCommand } from '@/lib/application-continuity';
import { UsageError } from "@/lib/usage";

function revalidateApplicationPaths(...companyIds: Array<string | null | undefined>) {
  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/applications/companies");
  for (const companyId of companyIds) {
    if (companyId) revalidatePath(`/dashboard/applications/companies/${companyId}`);
  }
}

async function requireApplicationContext() {
  return requireProductContext({ allowGuest: true, feature: "applications" });
}

export async function getOwnedJobOffer(offerId: string) {
  try {
    const ctx = await requireApplicationContext();
    const userId = ctx.effectiveUser!.id;

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
      .limit(1);

    if (!offer) {
      throw new Error("Offer not found");
    }

    if (offer.status.startsWith('archived:')) {
      offer.status = 'archived';
    }

    return { success: true as const, offer };
  } catch (error: any) {
    log({ event: 'product_action_failed', level: 'error', error });
    const failure = publicErrorBody(error);
    return { error: failure.error, code: failure.code, action: failure.action };
  }
}

export async function runApplicationCommand(offerId: string, command: ApplicationCommand) {
  try {
    const ctx = await requireApplicationContext();
    const result = await db.transaction(tx => applyApplicationCommand(tx, ctx.effectiveUser!.id, offerId, command));
    revalidateApplicationPaths();
    revalidatePath(`/dashboard/applications/offer/${offerId}`);
    void createAuditLog('job_offer_status_change', ctx.effectiveUser!.id, ctx.effectiveUser!.email || null, { offerId, newStatus: result.status }, auditActorFields(ctx));
    return { success: true as const, status: result.status, nextFollowupDate: result.nextFollowupDate, nextAction: result.nextAction, followupVersion: result.followupVersion };
  } catch (error) {
    log({ event: 'application_command_failed', level: 'warn', error });
    const failure = publicErrorBody(error);
    return { error: failure.error, code: failure.code, action: failure.action };
  }
}
export async function markApplicationSent(offerId: string, exportId?: string | null, commandId?: string) {
  return runApplicationCommand(offerId, { action: 'sent', exportId, commandId });
}
export async function updateJobOfferStatus(offerId: string, newStatus: string) {
  return runApplicationCommand(offerId, { status: newStatus });
}
export async function getApplicationTimeline(offerId: string, page = 0) {
  const ctx = await requireApplicationContext();
  return applicationTimeline(ctx.effectiveUser!.id, offerId, page);
}

export async function updateJobOfferCv(offerId: string, cvId: string | null) {
  try {
    const ctx = await requireApplicationContext();
    const userId = ctx.effectiveUser!.id;

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== userId) {
      throw new Error("Forbidden or Offer not found");
    }

    await db
      .update(jobOffers)
      .set({
        cvId: cvId || null,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    revalidatePath("/dashboard/applications");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    log({ event: 'product_action_failed', level: 'error', error });
    const failure = publicErrorBody(error);
    return { error: failure.error, code: failure.code, action: failure.action };
  }
}


export async function deleteJobOffer(offerId: string) {
  try {
    const ctx = await requireApplicationContext();
    const userId = ctx.effectiveUser!.id;

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== userId) {
      throw new Error("Forbidden or Offer not found");
    }

    await deleteOwnedApplication(userId, offerId);

    void createAuditLog("job_offer_delete", userId, ctx.effectiveUser!.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company
    }, auditActorFields(ctx));

    revalidateApplicationPaths(offer.companyId);
    if (offer.cvId) revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    log({ event: 'product_action_failed', level: 'error', error });
    const failure = publicErrorBody(error);
    return { error: failure.error, code: failure.code, action: failure.action };
  }
}

export async function createJobOffer(offerData: {
  title: string;
  company: string;
  url?: string;
  platform: string;
  description?: string;
}) {
  try {
    const ctx = await requireApplicationContext();
    const userId = ctx.effectiveUser!.id;

    const companyRecord = await findOrCreateCompany(userId, offerData.company);
    const companyName = companyRecord?.name ?? offerData.company.trim();

    const [newOffer] = (await db
      .insert(jobOffers)
      .values({
        userId,
        title: offerData.title,
        company: companyName,
        companyId: companyRecord?.id ?? null,
        url: offerData.url || null,
        platform: offerData.platform || "other",
        description: offerData.description || null,
        status: "interested"
      })
      .returning()) as any[];

    await createAuditLog("job_offer_create", userId, ctx.effectiveUser!.email || null, {
      offerId: newOffer.id,
      title: newOffer.title,
      company: newOffer.company,
      platform: newOffer.platform
    }, auditActorFields(ctx));

    revalidateApplicationPaths(companyRecord?.id);
    return { success: true };
  } catch (error: any) {
    log({ event: 'product_action_failed', level: 'error', error });
    const failure = publicErrorBody(error);
    return { error: failure.error, code: failure.code, action: failure.action };
  }
}

export async function updateJobOfferDetails(
  offerId: string,
  offerData: {
    title: string;
    company: string;
    url?: string | null;
    platform: string;
    description?: string | null;
  }
) {
  try {
    const ctx = await requireApplicationContext();
    const userId = ctx.effectiveUser!.id;

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== userId) {
      throw new Error("Forbidden or Offer not found");
    }

    const companyRecord = await findOrCreateCompany(userId, offerData.company);
    const companyName = companyRecord?.name ?? offerData.company.trim();

    await db
      .update(jobOffers)
      .set({
        title: offerData.title,
        company: companyName,
        companyId: companyRecord?.id ?? null,
        url: offerData.url || null,
        platform: offerData.platform || "other",
        description: offerData.description || null,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    await createAuditLog("job_offer_update", userId, ctx.effectiveUser!.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company,
      updatedData: {
        title: offerData.title,
        company: offerData.company,
        platform: offerData.platform,
      }
    }, auditActorFields(ctx));

    revalidateApplicationPaths(offer.companyId, companyRecord?.id);
    if (offer.cvId) revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    log({ event: 'product_action_failed', level: 'error', error });
    const failure = publicErrorBody(error);
    return { error: failure.error, code: failure.code, action: failure.action };
  }
}

export async function evaluateSingleOfferMatchAction(offerId: string, requestId?: string): Promise<{ success: boolean; score: number | null; scoreBreakdown: unknown; matchInputHash: string | null; matchEvidence: unknown; matchDetails: unknown; error?: string; code?: string; jobId?: string }> {
  try {
    const ctx = await requireApplicationContext();
    const userId = ctx.effectiveUser!.id;
    const [owned] = await db.select({ id: jobOffers.id }).from(jobOffers)
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId))).limit(1);
    if (!owned) throw new Error("Job offer not found");
    const job = await enqueueMatchBatchJob(userId, {
      offerIds: [offerId], targetThreshold: 65, kind: 'deep', requestId: aiRequestId(null, requestId),
    }, { initiatedByUserId: ctx.realUser?.id || userId });
    const settled = await settleAiJob(job.id);
    const progress = await readCurrentMatchBatchResult(settled);
    if (!progress.items.some(item => item.id === offerId)) {
      return { success: false, score: null, scoreBreakdown: null, matchInputHash: null, matchEvidence: null, matchDetails: null, error: settled.status === 'queued' || settled.status === 'running'
        ? 'El análisis continúa. Puedes recuperar el resultado en unos instantes.'
        : userErrorMessage(progress.errors[0]?.code === 'lookup' ? 'OFFER_IMPORT_FAILED' : 'AI_UNAVAILABLE'), jobId: job.id };
    }
    const [offer] = await db.select({ score: jobOffers.scoreOverall, scoreBreakdown: jobOffers.scoreBreakdown,
      matchInputHash: jobOffers.matchInputHash, matchEvidence: jobOffers.matchEvidence, matchDetails: jobOffers.matchDetails,
    }).from(jobOffers).where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId))).limit(1);
    if (!offer || typeof offer.score !== 'number') return { success: false, score: null, scoreBreakdown: null, matchInputHash: null, matchEvidence: null, matchDetails: null, error: 'La oferta ha cambiado durante el análisis.' };
    revalidatePath(`/dashboard/applications/offer/${offerId}`);
    revalidatePath('/dashboard/applications');
    return { success: true, ...offer, jobId: job.id };
  } catch (error: any) {
    log({ event: 'offer_match_evaluate_failed', level: 'error', error });
    return { success: false, score: null, scoreBreakdown: null, matchInputHash: null, matchEvidence: null, matchDetails: null, ...publicErrorBody(error) };
  }
}
