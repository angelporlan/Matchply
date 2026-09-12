"use server";

import { db } from "@/db";
import { jobOffers, users, cvs } from "@/db/schema";
import { AIService } from "@/lib/ai-service";
import { eq, and, inArray, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { requireUserFeature } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

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

const COLUMN_TITLES: Record<'es' | 'en', Record<string, string>> = {
  es: {
    interested: 'Interesado',
    applied: 'Aplicado',
    interview: 'Entrevista',
    offer: 'Oferta',
    rejected: 'Rechazado',
  },
  en: {
    interested: 'Interested',
    applied: 'Applied',
    interview: 'Interview',
    offer: 'Offer',
    rejected: 'Rejected',
  },
};

export async function getOwnedJobOffer(offerId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, session.user.id)))
      .limit(1);

    if (!offer) {
      throw new Error("Offer not found");
    }

    return { success: true as const, offer };
  } catch (error: any) {
    console.error("Error loading job offer:", error);
    return { error: error.message || "Failed to load offer" };
  }
}

export async function exportJobOffersReport(options: {
  dateFilter: 'all' | 'today' | '7days' | 'custom';
  startDate?: string;
  endDate?: string;
  limitForAi?: boolean;
  language?: 'es' | 'en';
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    await requireUserFeature(session.user.id, "kanban");

    const language = options.language === 'en' ? 'en' : 'es';
    const isEs = language === 'es';
    const userId = session.user.id;

    const offers = await db
      .select({
        id: jobOffers.id,
        title: jobOffers.title,
        company: jobOffers.company,
        url: jobOffers.url,
        platform: jobOffers.platform,
        status: jobOffers.status,
        cvId: jobOffers.cvId,
        description: jobOffers.description,
        createdAt: jobOffers.createdAt,
      })
      .from(jobOffers)
      .where(eq(jobOffers.userId, userId))
      .orderBy(desc(jobOffers.createdAt));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    let targetOffers = offers.filter((offer) => {
      if (offer.status.startsWith(ARCHIVED_STATUS_PREFIX)) return false;
      if (options.dateFilter === 'all') return true;

      const offerDate = new Date(offer.createdAt);
      offerDate.setHours(0, 0, 0, 0);
      const offerTime = offerDate.getTime();

      if (options.dateFilter === 'today') return offerTime === todayTime;
      if (options.dateFilter === '7days') return offerTime >= sevenDaysAgo.getTime() && offerTime <= todayTime;
      if (options.dateFilter === 'custom') {
        let matches = true;
        if (options.startDate) {
          matches = matches && offerTime >= new Date(`${options.startDate}T00:00:00`).getTime();
        }
        if (options.endDate) {
          matches = matches && offerTime <= new Date(`${options.endDate}T00:00:00`).getTime();
        }
        return matches;
      }
      return true;
    });

    if (options.limitForAi && targetOffers.length > 8) {
      targetOffers = targetOffers.slice(0, 8);
    }

    if (targetOffers.length === 0) {
      return { success: true as const, text: '' };
    }

    const usedCvIds = Array.from(new Set(targetOffers.map((offer) => offer.cvId).filter((id): id is string => Boolean(id))));
    const linkedCvs = usedCvIds.length
      ? await db
          .select({ id: cvs.id, title: cvs.title, content: cvs.content })
          .from(cvs)
          .where(and(eq(cvs.userId, userId), inArray(cvs.id, usedCvIds)))
      : [];
    const cvById = new Map(linkedCvs.map((cv) => [cv.id, cv]));

    const titleText = isEs ? 'REPORTE DE POSTULACIONES - MATCHPLY' : 'APPLICATIONS REPORT - MATCHPLY';
    const periodLabel = isEs ? 'Período' : 'Period';
    const exportDateLabel = isEs ? 'Fecha de exportación' : 'Export date';
    const applicationsSectionTitle = isEs ? 'POSTULACIONES COPIADAS' : 'COPIED APPLICATIONS';
    const cvsSectionTitle = isEs ? 'CURRÍCULUMS VINCULADOS' : 'LINKED CVs';

    let periodValue = isEs ? 'Todas las postulaciones' : 'All applications';
    if (options.dateFilter === 'today') periodValue = isEs ? 'Hoy' : 'Today';
    else if (options.dateFilter === '7days') periodValue = isEs ? 'Últimos 7 días' : 'Last 7 days';
    else if (options.dateFilter === 'custom') {
      const startStr = options.startDate ? formatDate(new Date(`${options.startDate}T00:00:00`)) : '...';
      const endStr = options.endDate ? formatDate(new Date(`${options.endDate}T00:00:00`)) : '...';
      periodValue = isEs ? `Rango: ${startStr} - ${endStr}` : `Range: ${startStr} - ${endStr}`;
    }

    const formattedExportDate = `${formatDate(new Date())} ${new Date().toLocaleTimeString(isEs ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`;

    let textStr = `==================================================
${titleText}
==================================================
• ${periodLabel}: ${periodValue}
• ${exportDateLabel}: ${formattedExportDate}

==================================================
${applicationsSectionTitle} (${targetOffers.length})
==================================================
`;

    targetOffers.forEach((offer, idx) => {
      const statusText = COLUMN_TITLES[language][offer.status] || offer.status;
      const cvObj = offer.cvId ? cvById.get(offer.cvId) : null;
      const cvTitle = cvObj ? cvObj.title : (isEs ? 'Ninguno' : 'None');
      let descriptionText = offer.description || (isEs ? 'Sin descripción' : 'No description');
      if (options.limitForAi && descriptionText.length > 600) {
        descriptionText = `${descriptionText.substring(0, 600)}... [Descripción truncada para optimización de tokens]`;
      }

      textStr += `
--------------------------------------------------
${idx + 1}. ${offer.title.toUpperCase()} en ${offer.company.toUpperCase()}
--------------------------------------------------
• ${isEs ? 'Puesto' : 'Job Title'}: ${offer.title}
• ${isEs ? 'Empresa' : 'Company'}: ${offer.company}
• ${isEs ? 'Enlace' : 'Link'}: ${offer.url || (isEs ? 'No proporcionado' : 'Not provided')}
• ${isEs ? 'Plataforma' : 'Platform'}: ${offer.platform}
• ${isEs ? 'Estado' : 'Status'}: ${statusText}
• ${isEs ? 'CV Vinculado' : 'Linked CV'}: ${cvTitle}

• ${isEs ? 'Descripción' : 'Description'}:
${descriptionText}
`;
    });

    if (linkedCvs.length > 0) {
      textStr += `
==================================================
${cvsSectionTitle} (${linkedCvs.length})
==================================================
`;
      linkedCvs.forEach((cv) => {
        const offersUsingThisCv = targetOffers.filter((offer) => offer.cvId === cv.id);
        const offersList = offersUsingThisCv
          .map((offer) => `  - ${offer.title} en ${offer.company} (${COLUMN_TITLES[language][offer.status] || offer.status})`)
          .join('\n');
        let cvContentText = cv.content;
        if (options.limitForAi && cvContentText.length > 3000) {
          cvContentText = `${cvContentText.substring(0, 3000)}\n... [Contenido del CV truncado para optimización de tokens]`;
        }
        textStr += `
--------------------------------------------------
CV: ${cv.title}
${isEs ? 'Utilizado en las siguientes postulaciones:' : 'Used in the following applications:'}
${offersList}

${isEs ? 'Contenido del CV:' : 'CV Content:'}
${cvContentText}
--------------------------------------------------
`;
      });
    }

    return { success: true as const, text: textStr };
  } catch (error: any) {
    console.error("Error exporting job offers:", error);
    return { error: error.message || "Failed to export offers" };
  }
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
    const userProfile = (user.careerProfile as any) || {};

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
      userCareerProfile: user.careerProfile,
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

