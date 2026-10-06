"use server";

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
import { decideApplicationSent } from "@/lib/application-sent";
import { createCvForUser } from "@/lib/cv-access";
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
    console.error("Error loading job offer:", error);
    return { error: error.message || "Failed to load offer" };
  }
}

export async function markApplicationSent(offerId: string) {
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
    if (offer.status !== "interested") {
      return { success: true, status: offer.status };
    }

    const decision = decideApplicationSent("yes");
    await db
      .update(jobOffers)
      .set({
        status: decision.status,
        nextFollowupDate: decision.nextFollowupDate,
        updatedAt: new Date(),
      })
      .where(eq(jobOffers.id, offerId));

    await createAuditLog("job_offer_status_change", userId, ctx.effectiveUser!.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company,
      oldStatus: offer.status,
      newStatus: decision.status,
      source: "application_sent",
    }, auditActorFields(ctx));

    revalidateApplicationPaths(offer.companyId);
    return { success: true, status: decision.status };
  } catch (error: any) {
    console.error("Error marking application sent:", error);
    return { error: error.message || "Failed to update status" };
  }
}

export async function updateJobOfferStatus(offerId: string, newStatus: string) {
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
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    await createAuditLog("job_offer_status_change", userId, ctx.effectiveUser!.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company,
      oldStatus: offer.status,
      newStatus
    }, auditActorFields(ctx));

    revalidatePath("/dashboard/applications");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer status:", error);
    return { error: error.message || "Failed to update status" };
  }
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
    console.error("Error updating offer CV:", error);
    return { error: error.message || "Failed to link CV" };
  }
}

export async function prepareCvForJobOffer(offerId: string, baseCvId: string): Promise<{ success?: boolean; cvId?: string; error?: string; code?: string }> {
  try {
    const ctx = await requireApplicationContext();
    const userId = ctx.effectiveUser!.id;

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== userId) {
      return { error: "Forbidden or Offer not found" };
    }

    if (offer.cvId) {
      return { success: true, cvId: offer.cvId };
    }

    const [baseCv] = await db
      .select({
        id: cvs.id,
        templateName: cvs.templateName,
        accentColor: cvs.accentColor,
        fontFamily: cvs.fontFamily,
        pageMargin: cvs.pageMargin,
        scale: cvs.scale,
      })
      .from(cvs)
      .where(and(eq(cvs.id, baseCvId), eq(cvs.userId, userId)))
      .limit(1);

    if (!baseCv) {
      return { error: "Base CV not found" };
    }

    const title = `Optimizado - ${offer.title} (${offer.company})`;
    const newCv = await createCvForUser(userId, {
      title,
      content: '',
      isBase: false,
      isPrincipal: false,
      templateName: baseCv.templateName || 'harvard',
      accentColor: baseCv.accentColor || '#000000',
      fontFamily: baseCv.fontFamily || 'helvetica',
      pageMargin: baseCv.pageMargin ?? 36,
      scale: baseCv.scale ?? 1.0,
    });

    await db
      .update(jobOffers)
      .set({
        cvId: newCv.id,
        updatedAt: new Date(),
      })
      .where(eq(jobOffers.id, offerId));

    revalidateApplicationPaths();
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/applications/offer/${offerId}`);

    return { success: true, cvId: newCv.id };
  } catch (error: any) {
    console.error("Error preparing CV for job offer:", error);
    return {
      error: error.message || "Failed to prepare CV for job offer",
      ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}),
    };
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

    await db.delete(jobOffers).where(eq(jobOffers.id, offerId));

    await createAuditLog("job_offer_delete", userId, ctx.effectiveUser!.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company
    }, auditActorFields(ctx));

    revalidateApplicationPaths(offer.companyId);
    if (offer.cvId) revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting offer:", error);
    return { error: error.message || "Failed to delete offer" };
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
    console.error("Error creating manual job offer:", error);
    return { error: error.message || "Failed to create manual offer" };
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
    console.error("Error updating offer details:", error);
    return { error: error.message || "Failed to update offer details" };
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
        : progress.errors[0]?.message || settled.lastError || 'No se pudo calcular la afinidad', jobId: job.id };
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
    return { success: false, score: null, scoreBreakdown: null, matchInputHash: null, matchEvidence: null, matchDetails: null, error: error.message || 'No se pudo calcular la afinidad', code: error.code };
  }
}
