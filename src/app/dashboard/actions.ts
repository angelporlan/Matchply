"use server";

import { db } from "@/db";
import { cvs, jobOffers, users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { unstable_update } from "@/auth";
import { sanitizeDisplayName } from "@/lib/user-name";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { canUseCvTemplate } from "@/lib/subscription";
import { DEFAULT_CV_MARKDOWN } from "@/lib/default-cv";
import { createCvForUser, createManualCvForUser, requireCvCreation, requireEditableCv, updateCvForUser, lockCvUser } from "@/lib/cv-access";
import { UsageError } from "@/lib/usage";
import { getActor } from "@/lib/actor";
import { requireAccountContext, requireProductContext, auditActorFields } from "@/lib/request-context";
import { cvMetaColumns } from "@/lib/job-offer-queries";
import { parseMatchConstraints } from "@/lib/curation-constraints";
import { normalizeCareerProfileFields } from "@/lib/career-profile";
import { createTrySourceCv } from '@/lib/try-cv';
import { log } from '@/lib/logger';
import { saveCvVariant, activateCvVariant } from '@/lib/cv-optimization/service';
import type { VariantSaveContext } from '@/lib/cv-optimization/types';
import type { OptimizeModeId } from '@/lib/optimize-modes';

type ActionResult = { success?: boolean; error?: string; code?: string; cvId?: string; title?: string; name?: string; revision?: number; content?: string };

export async function createTryBaseCv(input: { id: string; title: string; content: string }): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) throw new Error('Unauthorized');
    const cvId = await createTrySourceCv(actor.userId, input);
    revalidatePath('/dashboard');
    return { success: true, cvId };
  } catch (error) {
    log({ event: 'try_source_cv_failed', level: 'error', error });
    return { error: error instanceof Error ? error.message : 'Failed to save resume',
      ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function setPrincipalCv(cvId: string): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    // 1. Comprobar que el CV existe y pertenece al usuario
    const [cv] = await db.select(cvMetaColumns).from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== userId) {
      throw new Error("Forbidden or CV not found");
    }

    // 2. Transacción para desmarcar los demás y marcar este
    await db.transaction(async (tx) => {
      const editable = await requireEditableCv(tx, userId, cvId);
      if (editable.pendingUsageOperationId) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'This resume is being generated');
      // Poner todos los del usuario a false
      await tx
        .update(cvs)
        .set({ isPrincipal: false, updatedAt: sql`${cvs.updatedAt}` })
        .where(eq(cvs.userId, userId));

      // Poner este a true
      await tx
        .update(cvs)
        .set({ isPrincipal: true })
        .where(eq(cvs.id, cvId));
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error setting principal CV:", error);
    return { error: error.message || "Failed to set principal CV", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function createBaseCv(title: string): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    const newCv = await createManualCvForUser(userId, { title: title || "Mi Currículum", content: DEFAULT_CV_MARKDOWN, templateName: "harvard", accentColor: "#1a5f7a", fontFamily: "helvetica", pageMargin: 36, scale: 1 });

    // Log de auditoría para creación manual de CV (solo usuarios reales)
    if (actor.kind === "user") {
      await createAuditLog("cv_create_manual", userId, actor.email || null, {
        cvId: newCv.id,
        title: newCv.title
      });
    }

    revalidatePath("/dashboard");
    return { success: true, cvId: newCv.id };
  } catch (error: any) {
    console.error("Error creating CV:", error);
    return { error: error.message || "Failed to create CV", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function deleteCv(cvId: string): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    // Comprobar pertenencia
    const [cv] = await db.select(cvMetaColumns).from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== userId) {
      throw new Error("Forbidden or CV not found");
    }

    await db.transaction(async (tx) => {
      await lockCvUser(tx, userId);
      const [current] = await tx.select({ pending: cvs.pendingUsageOperationId, isPrincipal: cvs.isPrincipal }).from(cvs).where(and(eq(cvs.id, cvId), eq(cvs.userId, userId))).limit(1);
      if (!current) throw new UsageError(404, 'CV_NOT_FOUND', 'Resume not found');
      if (current.pending) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'This resume is being generated');
      // Borrar el CV
      await tx.delete(cvs).where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)));

      // Si el CV que acabamos de borrar era el principal, elegir otro
      if (current.isPrincipal) {
        const [nextBaseCv] = await tx
          .select({ id: cvs.id })
          .from(cvs)
          .where(eq(cvs.userId, userId))
          .orderBy(desc(cvs.createdAt))
          .limit(1);

        if (nextBaseCv) {
          await tx
            .update(cvs)
            .set({ isPrincipal: true })
            .where(eq(cvs.id, nextBaseCv.id));
        }
      }
    });

    // Log de auditoría para eliminación de CV (solo usuarios reales)
    if (actor.kind === "user") {
      await createAuditLog("cv_delete", userId, actor.email || null, {
        cvId: cv.id,
        title: cv.title
      });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting CV:", error);
    return { error: error.message || "Failed to delete CV", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function updateCvStyling(
  cvId: string,
  updates: {
    title?: string;
    templateName?: string;
    accentColor?: string | null;
    fontFamily?: string | null;
    pageMargin?: number | null;
    scale?: number | null;
  }
): Promise<ActionResult> {
  try {
    const permitted = new Set(['title', 'templateName', 'accentColor', 'fontFamily', 'pageMargin', 'scale']);
    if (!updates || typeof updates !== 'object' || Object.keys(updates).some(key => !permitted.has(key))) throw new UsageError(400, 'INVALID_CV_PATCH', 'Invalid resume styling fields');
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    // Comprobar pertenencia
    const [cv] = await db.select(cvMetaColumns).from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== actor.userId) {
      throw new Error("Forbidden or CV not found");
    }

    if (
      updates.templateName
      && !canUseCvTemplate(actor.subscriptionStatus, updates.templateName, { isGuest: actor.kind === "guest", proGrantedUntil: actor.proGrantedUntil })
    ) {
      throw new Error("La única plantilla disponible es Harvard.");
    }

    await updateCvForUser(actor.userId, cvId, updates);

    revalidatePath(`/editor/${cvId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating CV styling:", error);
    return { error: error.message || "Failed to update CV styling", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function saveCvContent(cvId: string, content: string, context?: VariantSaveContext): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const [cv] = await db.select(cvMetaColumns).from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== actor.userId) {
      throw new Error("Forbidden");
    }

    if (context) {
      const saved = await saveCvVariant(actor.userId, cvId, content, context);
      return { success: true, revision: saved.revision };
    }
    await updateCvForUser(actor.userId, cvId, { content });

    return { success: true };
  } catch (error: any) {
    log({ event: 'cv_content_save_failed', level: 'error', error });
    return { error: error.message || "Failed to save CV content", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function selectCvVariant(cvId: string, optimizationId: string, modeId: OptimizeModeId): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) throw new Error('Unauthorized');
    const selected = await activateCvVariant(actor.userId, cvId, optimizationId, modeId);
    revalidatePath('/dashboard');
    return { success: true, ...selected };
  } catch (error) {
    log({ event: 'cv_variant_select_failed', level: 'error', error });
    return { error: error instanceof Error ? error.message : 'No se pudo cambiar de versión.', ...(error instanceof UsageError ? { code: error.code } : {}) };
  }
}

export async function renameCv(cvId: string, title: string): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const cleanTitle = title.trim().replace(/\s+/g, " ");
    if (!cleanTitle) {
      throw new Error("INVALID_TITLE");
    }
    if (cleanTitle.length > 120) {
      throw new Error("TITLE_TOO_LONG");
    }

    const [cv] = await db.select(cvMetaColumns).from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== actor.userId) {
      throw new Error("Forbidden or CV not found");
    }

    if (cv.title === cleanTitle) {
      return { success: true, title: cleanTitle };
    }

    await updateCvForUser(actor.userId, cvId, { title: cleanTitle });

    if (actor.kind === "user") {
      await createAuditLog("cv_rename", actor.userId, actor.email || null, {
        cvId,
        previousTitle: cv.title,
        title: cleanTitle,
      });
    }

    revalidatePath("/dashboard");
    return { success: true, title: cleanTitle };
  } catch (error: any) {
    console.error("Error renaming CV:", error);
    return { error: error.message || "Failed to rename CV", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function duplicateCv(cvId: string): Promise<ActionResult> {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    const [cv] = await db
      .select({ ...cvMetaColumns, content: cvs.content })
      .from(cvs)
      .where(eq(cvs.id, cvId))
      .limit(1);
    if (!cv || cv.userId !== userId) {
      throw new Error("Forbidden or CV not found");
    }

    const newCv = await createCvForUser(userId, { title: `${cv.title} (Copia)`, content: cv.content, isBase: false, isPrincipal: false, templateName: cv.templateName, accentColor: cv.accentColor, fontFamily: cv.fontFamily, pageMargin: cv.pageMargin, scale: cv.scale });

    if (actor.kind === "user") {
      await createAuditLog("cv_duplicate", userId, actor.email || null, {
        sourceCvId: cv.id,
        cvId: newCv.id,
        title: newCv.title,
      });
    }

    revalidatePath("/dashboard");
    return { success: true, cvId: newCv.id };
  } catch (error: any) {
    console.error("Error duplicating CV:", error);
    return { error: error.message || "Failed to duplicate CV", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function saveUserCareerProfileAction(profileData: any): Promise<ActionResult> {
  try {
    const ctx = await requireProductContext();
    const userId = ctx.effectiveUser!.id;

    const [user] = await db
      .select({ careerProfile: users.careerProfile })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const currentProfile = (user?.careerProfile as any) || {};
    const { hardConstraints: _ignoredHardConstraints, ...profileFields } = profileData || {};
    const normalizedFields = normalizeCareerProfileFields({ ...currentProfile, ...profileFields });

    const updatedProfile = {
      ...currentProfile,
      ...normalizedFields,
      hardConstraints: parseMatchConstraints(normalizedFields),
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(users)
      .set({
        careerProfile: updatedProfile,
      })
      .where(eq(users.id, userId));

    await createAuditLog("career_profile_update", userId, ctx.effectiveUser!.email || null, {
      hasBio: !!normalizedFields.bio,
      hasMasterDocument: !!normalizedFields.masterDocument,
      targetRolesCount: Array.isArray(normalizedFields.targetRoles) ? normalizedFields.targetRoles.length : 0,
      skillsCount: Array.isArray(normalizedFields.skills) ? normalizedFields.skills.length : 0,
      projectsCount: Array.isArray(normalizedFields.keyProjects) ? normalizedFields.keyProjects.length : 0,
    }, auditActorFields(ctx));

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard/applications");

    return { success: true };
  } catch (error: any) {
    console.error("Error saving career profile:", error);
    return { error: error.message || "Failed to save career profile", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}

export async function updateUserNameAction(name: string): Promise<ActionResult> {
  try {
    const ctx = await requireAccountContext();
    const userId = ctx.realUser!.id;

    const sanitized = sanitizeDisplayName(name);
    if (!sanitized) {
      return { error: "INVALID_NAME" };
    }

    const [currentUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return { error: "User not found" };
    }

    if (currentUser.name === sanitized) {
      return { success: true, name: sanitized };
    }

    await db
      .update(users)
      .set({ name: sanitized })
      .where(eq(users.id, userId));

    await createAuditLog("user_name_update", userId, ctx.realUser!.email || null, {
      previousName: currentUser.name,
      newName: sanitized,
    });

    try {
      await unstable_update({ user: { name: sanitized } });
    } catch (sessionError) {
      console.error("Error refreshing session after name update:", sessionError);
    }

    revalidatePath("/dashboard", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/dashboard/profile");

    return { success: true, name: sanitized };
  } catch (error: any) {
    console.error("Error updating user name:", error);
    return { error: error.message || "Failed to update name", ...(error instanceof UsageError ? { code: error.code, ...error.details } : {}) };
  }
}
