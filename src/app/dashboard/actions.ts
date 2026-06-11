"use server";

import { db } from "@/db";
import { cvs, jobOffers, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { isProSubscription } from "@/lib/subscription";
import { DEFAULT_CV_MARKDOWN } from "@/lib/default-cv";
import { getActor, getGuestCvCount, GUEST_MAX_CVS } from "@/lib/actor";

export async function setPrincipalCv(cvId: string) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    // 1. Comprobar que el CV existe y pertenece al usuario
    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== userId) {
      throw new Error("Forbidden or CV not found");
    }

    // 2. Transacción para desmarcar los demás y marcar este
    await db.transaction(async (tx) => {
      // Poner todos los del usuario a false
      await tx
        .update(cvs)
        .set({ isPrincipal: false })
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
    return { error: error.message || "Failed to set principal CV" };
  }
}

export async function createBaseCv(title: string) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    // Contar cuántos CVs base tiene el usuario ya
    const cvCount = await getGuestCvCount(userId);
    if (actor.kind === "guest") {
      if (cvCount >= GUEST_MAX_CVS) {
        throw new Error("Has alcanzado el límite de 3 CVs de prueba. Regístrate para conservarlos y seguir creando.");
      }
    }

    const isFirst = cvCount === 0;

    const [newCv] = await db
      .insert(cvs)
      .values({
        userId,
        title: title || "Mi Currículum Base",
        content: DEFAULT_CV_MARKDOWN,
        isBase: true,
        isPrincipal: isFirst,
        templateName: "harvard",
        accentColor: "#1a5f7a",
        fontFamily: "helvetica",
        pageMargin: 36,
        scale: 1.0,
      })
      .returning();

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
    return { error: error.message || "Failed to create CV" };
  }
}

export async function deleteCv(cvId: string) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    // Comprobar pertenencia
    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== userId) {
      throw new Error("Forbidden or CV not found");
    }

    await db.transaction(async (tx) => {
      // Borrar el CV
      await tx.delete(cvs).where(eq(cvs.id, cvId));

      // Si el CV que acabamos de borrar era el principal, elegir otro
      if (cv.isPrincipal) {
        const [nextBaseCv] = await tx
          .select()
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
    return { error: error.message || "Failed to delete CV" };
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
) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    // Comprobar pertenencia
    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== actor.userId) {
      throw new Error("Forbidden or CV not found");
    }

    await db
      .update(cvs)
      .set(updates)
      .where(eq(cvs.id, cvId));

    revalidatePath(`/editor/${cvId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating CV styling:", error);
    return { error: error.message || "Failed to update CV styling" };
  }
}

export async function saveCvContent(cvId: string, content: string) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== actor.userId) {
      throw new Error("Forbidden");
    }

    await db
      .update(cvs)
      .set({ content })
      .where(eq(cvs.id, cvId));

    return { success: true };
  } catch (error: any) {
    console.error("Error saving CV content:", error);
    return { error: error.message || "Failed to save CV content" };
  }
}

export async function generateUserApiKey() {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    // Fetch user from DB to verify subscription status
    const [dbUser] = await db
      .select({ subscriptionStatus: users.subscriptionStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isPremium = isProSubscription(dbUser?.subscriptionStatus);
    if (!isPremium) {
      throw new Error("API Keys are a PRO feature. Please upgrade your subscription.");
    }

    // Generate a secure API Key prefixing with 'matchply_usr_'
    const newApiKey = `matchply_usr_${randomBytes(24).toString("hex")}`;

    await db
      .update(users)
      .set({ apiKey: newApiKey })
      .where(eq(users.id, userId));

    // Log de auditoría
    await createAuditLog("api_key_generate", userId, session.user.email || null, {
      success: true
    });

    revalidatePath("/dashboard/subscription");
    return { success: true, apiKey: newApiKey };
  } catch (error: any) {
    console.error("Error generating user API Key:", error);
    return { error: error.message || "Failed to generate API Key" };
  }
}

export async function revokeUserApiKey() {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    // Fetch user from DB to verify subscription status
    const [dbUser] = await db
      .select({ subscriptionStatus: users.subscriptionStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isPremium = isProSubscription(dbUser?.subscriptionStatus);
    if (!isPremium) {
      throw new Error("API Keys are a PRO feature. Please upgrade your subscription.");
    }

    await db
      .update(users)
      .set({ apiKey: null })
      .where(eq(users.id, userId));

    // Log de auditoría
    await createAuditLog("api_key_revoke", userId, session.user.email || null, {
      success: true
    });

    revalidatePath("/dashboard/subscription");
    return { success: true };
  } catch (error: any) {
    console.error("Error revoking user API Key:", error);
    return { error: error.message || "Failed to revoke API Key" };
  }
}

export async function createCvPlaceholder(updates: {
  title: string;
  isBase: boolean;
  isPrincipal: boolean;
}) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      throw new Error("Unauthorized");
    }

    const userId = actor.userId;

    if (actor.kind === "guest") {
      const cvCount = await getGuestCvCount(userId);
      if (cvCount >= GUEST_MAX_CVS) {
        throw new Error("Has alcanzado el límite de 3 CVs de prueba. Regístrate para conservarlos y seguir creando.");
      }
    }

    let newCvId = '';
    await db.transaction(async (tx) => {
      if (updates.isPrincipal) {
        await tx
          .update(cvs)
          .set({ isPrincipal: false })
          .where(eq(cvs.userId, userId));
      }

      // Obtener el estilo del currículum principal actual (para copiar el estilo)
      const [principalCv] = await tx
        .select()
        .from(cvs)
        .where(and(eq(cvs.userId, userId), eq(cvs.isPrincipal, true)))
        .limit(1);

      const [newCv] = await tx
        .insert(cvs)
        .values({
          userId: userId,
          title: updates.title,
          content: "", // Empezamos vacío para que se rellene con streaming
          isBase: updates.isBase,
          isPrincipal: updates.isPrincipal,
          templateName: principalCv?.templateName || "harvard",
          accentColor: principalCv?.accentColor || "#1a5f7a",
          fontFamily: principalCv?.fontFamily || "helvetica",
          pageMargin: principalCv?.pageMargin || 36,
          scale: principalCv?.scale || 1.0,
        })
        .returning();

      newCvId = newCv.id;
    });

    revalidatePath("/dashboard");
    return { success: true, cvId: newCvId };
  } catch (error: any) {
    console.error("Error creating CV placeholder:", error);
    return { error: error.message || "Failed to create CV placeholder" };
  }
}
