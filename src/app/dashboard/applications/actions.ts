"use server";

import { db } from "@/db";
import { jobOffers, cvs, users } from "@/db/schema";
import { AIService } from "@/lib/ai-service";
import { eq, and, inArray, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { findOrCreateCompany } from "@/lib/company-service";
import { requireUserFeature } from "@/lib/permissions";
import { log } from "@/lib/logger";
import { persistMatchResult } from "@/lib/match-persistence";
import { baseCvForAiColumns, curateOfferColumns, jobOfferOwnershipColumns } from "@/lib/job-offer-queries";

function revalidateApplicationPaths(...companyIds: Array<string | null | undefined>) {
  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/applications/companies");
  for (const companyId of companyIds) {
    if (companyId) revalidatePath(`/dashboard/applications/companies/${companyId}`);
  }
}

export async function getOwnedJobOffer(offerId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "applications");

    // Detalle completo (tabla ancha): solo se lee al abrir la oferta.
    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, session.user.id)))
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


export async function updateJobOfferStatus(offerId: string, newStatus: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "applications");

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db
      .update(jobOffers)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    // Log de auditoría para cambio de estado de candidatura
    await createAuditLog("job_offer_status_change", session.user.id, session.user.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company,
      oldStatus: offer.status,
      newStatus
    });

    revalidatePath("/dashboard/applications");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer status:", error);
    return { error: error.message || "Failed to update status" };
  }
}

export async function updateJobOfferCv(offerId: string, cvId: string | null) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "applications");

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
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
    // El dashboard muestra la oferta más reciente vinculada a cada CV.
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer CV:", error);
    return { error: error.message || "Failed to link CV" };
  }
}

export async function deleteJobOffer(offerId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "applications");

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db.delete(jobOffers).where(eq(jobOffers.id, offerId));

    // Log de auditoría para eliminación de candidatura en el tablero
    await createAuditLog("job_offer_delete", session.user.id, session.user.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company
    });

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
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "applications");

    const companyRecord = await findOrCreateCompany(session.user.id, offerData.company);
    const companyName = companyRecord?.name ?? offerData.company.trim();

    const [newOffer] = (await db
      .insert(jobOffers)
      .values({
        userId: session.user.id,
        title: offerData.title,
        company: companyName,
        companyId: companyRecord?.id ?? null,
        url: offerData.url || null,
        platform: offerData.platform || "other",
        description: offerData.description || null,
        status: "interested"
      })
      .returning()) as any[];

    // Log de auditoría para creación de candidatura
    await createAuditLog("job_offer_create", session.user.id, session.user.email || null, {
      offerId: newOffer.id,
      title: newOffer.title,
      company: newOffer.company,
      platform: newOffer.platform
    });

    // Una oferta nueva no tiene CV vinculado: el dashboard no cambia.
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
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "applications");

    const [offer] = await db
      .select(jobOfferOwnershipColumns)
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    const companyRecord = await findOrCreateCompany(session.user.id, offerData.company);
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

    // Log de auditoría para actualización de candidatura
    await createAuditLog("job_offer_update", session.user.id, session.user.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company,
      updatedData: offerData
    });

    revalidateApplicationPaths(offer.companyId, companyRecord?.id);
    if (offer.cvId) revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer details:", error);
    return { error: error.message || "Failed to update offer details" };
  }
}

export async function evaluateSingleOfferMatchAction(offerId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    const userId = session.user.id;
    const user = await requireUserFeature(userId, "applications");

    const [[offer], [baseCv], [profileRow]] = await Promise.all([
      db
        .select(curateOfferColumns)
        .from(jobOffers)
        .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
        .limit(1),
      db
        .select(baseCvForAiColumns)
        .from(cvs)
        .where(eq(cvs.userId, userId))
        .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt), desc(cvs.id))
        .limit(1),
      db
        .select({ careerProfile: users.careerProfile })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);
    if (!offer) throw new Error("Job offer not found");

    const { curated, errors } = await AIService.curateOffersBatch({
      baseCvMarkdown: baseCv?.content || "",
      userCareerProfile: profileRow?.careerProfile ?? null,
      offers: [{
        id: offer.id,
        title: offer.title,
        company: offer.company,
        description: offer.description,
        platform: offer.platform,
        scoreOverall: offer.scoreOverall,
        scoreBreakdown: offer.scoreBreakdown,
        tldr: offer.tldr,
        sourceMetadata: offer.sourceMetadata,
        matchInputHash: offer.matchInputHash,
        matchEvidence: offer.matchEvidence,
        matchDetails: offer.matchDetails,
      }],
      userSubscriptionStatus: user.subscriptionStatus,
      targetThreshold: 65,
      kind: 'deep',
    });

    const evaluated = curated[0];
    if (evaluated && typeof evaluated.score === 'number') {
      if (!await persistMatchResult(userId, evaluated)) {
        return { error: "El perfil o la oferta han cambiado durante el análisis. Vuelve a calcular el match." };
      }

      revalidatePath(`/dashboard/applications/offer/${offerId}`);
      revalidatePath("/dashboard/applications");

      return {
        success: true,
        score: evaluated.score,
        fitReason: evaluated.fitReason,
        decision: evaluated.decision,
        scoreBreakdown: evaluated.scoreBreakdown,
        matchInputHash: evaluated.inputHash,
        matchEvidence: evaluated.evidence,
        matchDetails: evaluated.details,
      };
    }

    return { error: errors[0]?.message || "No se pudo calcular la afinidad" };
  } catch (error: any) {
    log({ event: 'offer_match_evaluate_failed', level: 'error', error });
    return { error: error.message || "Failed to evaluate match" };
  }
}


