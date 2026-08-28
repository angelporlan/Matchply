"use server";

import { db } from "@/db";
import { jobOffers, users, cvs } from "@/db/schema";
import { AIService } from "@/lib/ai-service";
import { eq, and, inArray, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { requireUserFeature } from "@/lib/permissions";

const ARCHIVED_STATUS_PREFIX = "archived:";
const VALID_PIPELINE_STATUSES = ["interested", "applied", "interview", "offer", "rejected"] as const;
type PipelineStatus = typeof VALID_PIPELINE_STATUSES[number];

function getValidPipelineStatus(status: string | null | undefined): PipelineStatus {
  return VALID_PIPELINE_STATUSES.includes(status as PipelineStatus)
    ? (status as PipelineStatus)
    : "interested";
}

function getRestoreStatus(status: string): PipelineStatus {
  if (!status.startsWith(ARCHIVED_STATUS_PREFIX)) {
    return getValidPipelineStatus(status);
  }

  return getValidPipelineStatus(status.slice(ARCHIVED_STATUS_PREFIX.length));
}

export async function updateJobOfferStatus(offerId: string, newStatus: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");

    const [offer] = await db
      .select()
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

    revalidatePath("/dashboard/kanban");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer status:", error);
    return { error: error.message || "Failed to update status" };
  }
}

export async function archiveJobOffer(offerId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    if (offer.status.startsWith(ARCHIVED_STATUS_PREFIX)) {
      return { success: true };
    }

    const previousStatus = getValidPipelineStatus(offer.status);

    await db
      .update(jobOffers)
      .set({
        status: `${ARCHIVED_STATUS_PREFIX}${previousStatus}`,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error archiving offer:", error);
    return { error: error.message || "Failed to archive offer" };
  }
}

export async function restoreArchivedJobOffer(offerId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    const restoredStatus = getRestoreStatus(offer.status);

    await db
      .update(jobOffers)
      .set({
        status: restoredStatus,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error restoring archived offer:", error);
    return { error: error.message || "Failed to restore offer" };
  }
}

export async function archiveMultipleJobOffers(offerIds: string[]) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");
    const userId = session.user.id;

    if (!offerIds || offerIds.length === 0) {
      return { success: true, count: 0 };
    }

    const offersToArchive = await db
      .select({ id: jobOffers.id, status: jobOffers.status })
      .from(jobOffers)
      .where(and(eq(jobOffers.userId, userId), inArray(jobOffers.id, offerIds)));

    const statusMap = new Map<string, string[]>();
    for (const off of offersToArchive) {
      if (!off.status.startsWith(ARCHIVED_STATUS_PREFIX)) {
        const prevStatus = getValidPipelineStatus(off.status);
        const targetStatus = `${ARCHIVED_STATUS_PREFIX}${prevStatus}`;
        const list = statusMap.get(targetStatus) || [];
        list.push(off.id);
        statusMap.set(targetStatus, list);
      }
    }

    for (const [targetStatus, ids] of Array.from(statusMap.entries())) {
      if (ids.length > 0) {
        await db
          .update(jobOffers)
          .set({
            status: targetStatus,
            updatedAt: new Date(),
          })
          .where(and(eq(jobOffers.userId, userId), inArray(jobOffers.id, ids)));
      }
    }

    await createAuditLog("job_offers_bulk_archived", userId, session.user.email || null, {
      archivedCount: offersToArchive.length,
    });

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");

    return { success: true, count: offersToArchive.length };
  } catch (error: any) {
    console.error("Error archiving multiple offers:", error);
    return { error: error.message || "Failed to archive offers" };
  }
}

export async function updateJobOfferCv(offerId: string, cvId: string | null) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");

    const [offer] = await db
      .select()
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

    revalidatePath("/dashboard/kanban");
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
    await requireUserFeature(session.user.id, "kanban");

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db.delete(jobOffers).where(eq(jobOffers.id, offerId));

    // Log de auditoría para eliminación de candidatura en Kanban
    await createAuditLog("job_offer_delete", session.user.id, session.user.email || null, {
      offerId: offer.id,
      title: offer.title,
      company: offer.company
    });

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
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
    await requireUserFeature(session.user.id, "kanban");

    const [newOffer] = (await db
      .insert(jobOffers)
      .values({
        userId: session.user.id,
        title: offerData.title,
        company: offerData.company,
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

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
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
    await requireUserFeature(session.user.id, "kanban");

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db
      .update(jobOffers)
      .set({
        title: offerData.title,
        company: offerData.company,
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

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer details:", error);
    return { error: error.message || "Failed to update offer details" };
  }
}

export async function analyzeFailuresAction(targetOffersText: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");

    const userId = session.user.id;

    // 1. Obtener usuario para comprobar suscripción
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    // 2. Ejecutar análisis de la IA
    const analysis = await AIService.analyzeFailures({
      targetOffersText,
      userSubscriptionStatus: user.subscriptionStatus
    });

    // 3. Crear log de auditoría
    await createAuditLog("cv_analyze_failures_ai", userId, user.email || null, {
      textLength: targetOffersText.length
    });

    return { analysis };
  } catch (error: any) {
    console.error("Error analyzing failures:", error);
    return { error: error.message || "Failed to analyze failures" };
  }
}

export async function curateOffersWithAiAction(targetThreshold: number = 65) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");
    const userId = session.user.id;

    // 1. Obtener usuario para suscripción
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    // 2. Obtener CV Base del usuario
    const userCvsList = await db
      .select()
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt));

    const baseCv = userCvsList.find(c => c.isBase || c.isPrincipal) || userCvsList[0];
    const baseCvMarkdown = baseCv?.content || "";

    // 3. Obtener todas las ofertas activas en la columna "interested"
    const interestedOffers = await db
      .select()
      .from(jobOffers)
      .where(and(eq(jobOffers.userId, userId), eq(jobOffers.status, "interested")))
      .orderBy(desc(jobOffers.createdAt));

    if (interestedOffers.length === 0) {
      return { results: [], baseCvName: baseCv?.title || null };
    }

    // 4. Ejecutar evaluación por lotes con IA
    const userProfile = (user.mcpProfile as any) || {};

    const { curated } = await AIService.curateOffersBatch({
      baseCvMarkdown,
      userCareerProfile: userProfile,
      offers: interestedOffers.map(o => ({
        id: o.id,
        title: o.title,
        company: o.company,
        description: o.description,
        platform: o.platform,
        scoreOverall: o.scoreOverall,
        tldr: o.tldr,
        sourceMetadata: o.sourceMetadata,
      })),
      userSubscriptionStatus: user.subscriptionStatus,
      targetThreshold,
    });

    // 5. Opcional: Actualizar los scores evaluados en base de datos para que persistan
    for (const item of curated) {
      if (typeof item.score === 'number' && item.score > 0) {
        await db
          .update(jobOffers)
          .set({ scoreOverall: item.score, updatedAt: new Date() })
          .where(and(eq(jobOffers.id, item.id), eq(jobOffers.userId, userId)))
          .catch(() => {});
      }
    }

    // 6. Log de auditoría
    await createAuditLog("job_offers_ai_curate_preview", userId, user.email || null, {
      totalEvaluated: interestedOffers.length,
      keptCount: curated.filter(c => c.decision === 'keep').length,
      archivedCount: curated.filter(c => c.decision === 'archive').length,
    });

    revalidatePath("/dashboard/kanban");

    return { 
      results: curated,
      baseCvName: baseCv?.title || "CV Principal",
      totalCount: interestedOffers.length
    };
  } catch (error: any) {
    console.error("Error in curateOffersWithAiAction:", error);
    return { error: error.message || "Failed to curate offers" };
  }
}

export async function evaluateSingleOfferMatchAction(offerId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    const userId = session.user.id;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("User not found");

    const [offer] = await db.select().from(jobOffers).where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId))).limit(1);
    if (!offer) throw new Error("Job offer not found");

    const userCvsList = await db.select().from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt));
    const baseCv = userCvsList.find(c => c.isBase || c.isPrincipal) || userCvsList[0];

    const { curated } = await AIService.curateOffersBatch({
      baseCvMarkdown: baseCv?.content || "",
      userCareerProfile: user.mcpProfile,
      offers: [{
        id: offer.id,
        title: offer.title,
        company: offer.company,
        description: offer.description,
        platform: offer.platform,
        scoreOverall: offer.scoreOverall,
        tldr: offer.tldr,
        sourceMetadata: offer.sourceMetadata,
      }],
      userSubscriptionStatus: user.subscriptionStatus,
      targetThreshold: 65,
    });

    const evaluated = curated[0];
    if (evaluated && typeof evaluated.score === 'number') {
      await db.update(jobOffers)
        .set({ scoreOverall: evaluated.score, updatedAt: new Date() })
        .where(and(eq(jobOffers.id, offer.id), eq(jobOffers.userId, userId)));
      
      revalidatePath(`/dashboard/kanban/offer/${offerId}`);
      revalidatePath("/dashboard/kanban");

      return {
        success: true,
        score: evaluated.score,
        fitReason: evaluated.fitReason,
        decision: evaluated.decision,
      };
    }

    return { error: "No se pudo calcular la afinidad" };
  } catch (error: any) {
    console.error("Error evaluating single offer match:", error);
    return { error: error.message || "Failed to evaluate match" };
  }
}

export async function applyCuratedOffersAction({
  archiveOfferIds,
  moveOfferIds,
}: {
  archiveOfferIds: string[];
  moveOfferIds?: string[];
}) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");
    const userId = session.user.id;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // 1. Archivar las ofertas descartadas
    if (archiveOfferIds && archiveOfferIds.length > 0) {
      await db
        .update(jobOffers)
        .set({
          status: "archived:interested",
          updatedAt: new Date(),
        })
        .where(and(eq(jobOffers.userId, userId), inArray(jobOffers.id, archiveOfferIds)));
    }

    // 2. Mover a 'applied' si el usuario lo solicitó expresamente
    if (moveOfferIds && moveOfferIds.length > 0) {
      await db
        .update(jobOffers)
        .set({
          status: "applied",
          updatedAt: new Date(),
        })
        .where(and(eq(jobOffers.userId, userId), inArray(jobOffers.id, moveOfferIds)));
    }

    // 3. Log de auditoría
    await createAuditLog("job_offers_bulk_curate_applied", userId, user?.email || null, {
      archivedCount: archiveOfferIds?.length || 0,
      movedCount: moveOfferIds?.length || 0,
    });

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");

    return {
      success: true,
      archivedCount: archiveOfferIds?.length || 0,
      movedCount: moveOfferIds?.length || 0,
    };
  } catch (error: any) {
    console.error("Error in applyCuratedOffersAction:", error);
    return { error: error.message || "Failed to apply curated offers" };
  }
}

