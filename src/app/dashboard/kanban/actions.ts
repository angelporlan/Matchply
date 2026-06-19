"use server";

import { db } from "@/db";
import { jobOffers, users } from "@/db/schema";
import { AIService } from "@/lib/ai-service";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

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

export async function updateJobOfferCv(offerId: string, cvId: string | null) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

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

    const [newOffer] = await db
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
      .returning();

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
