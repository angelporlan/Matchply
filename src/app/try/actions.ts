"use server";

import { db } from "@/db";
import { cvs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { DEFAULT_CV_MARKDOWN } from "@/lib/default-cv";
import { getGuestCvCount, getOrCreateGuestActor, GUEST_MAX_CVS } from "@/lib/actor";

// @ts-ignore
import pdf from "pdf-parse";

const TRIAL_PDF_MAX_BYTES = Number(process.env.TRIAL_PDF_MAX_BYTES || 4 * 1024 * 1024);

function fail(error: string) {
  return { success: false as const, error };
}

function asMarkdownFromRawText(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("#")) return trimmed;

  return `# Mi Curriculum

${trimmed}`;
}

export async function createTrialCv(formData: FormData) {
  try {
    const actor = await getOrCreateGuestActor();
    const mode = formData.get("mode") as "template" | "text" | "pdf" | null;
    const titleFromForm = (formData.get("title") as string | null)?.trim();

    if (actor.kind === "guest") {
      const cvCount = await getGuestCvCount(actor.userId);
      if (cvCount >= GUEST_MAX_CVS) {
        return fail("Has alcanzado el limite de 3 CVs de prueba. Registrate para conservarlos y seguir creando.");
      }
    }

    let title = titleFromForm || "Mi Curriculum de prueba";
    let content = DEFAULT_CV_MARKDOWN;

    if (mode === "text") {
      const rawText = (formData.get("text") as string | null)?.trim();
      if (!rawText) {
        return fail("Pega el texto de tu CV antes de continuar.");
      }
      content = asMarkdownFromRawText(rawText);
      title = titleFromForm || "CV importado desde texto";
    } else if (mode === "pdf") {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) {
        return fail("Selecciona un PDF para crear tu CV de prueba.");
      }
      if (file.type !== "application/pdf") {
        return fail("Solo se admiten archivos PDF.");
      }
      if (file.size > TRIAL_PDF_MAX_BYTES) {
        return fail("El PDF supera el tamano maximo permitido para la prueba.");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await pdf(buffer);
      const extractedText = (parsed.text || "").trim();
      if (!extractedText) {
        return fail("No se pudo extraer texto de ese PDF.");
      }

      content = asMarkdownFromRawText(extractedText);
      title = titleFromForm || file.name.replace(/\.[^/.]+$/, "") || "CV importado desde PDF";
    } else if (mode !== "template") {
      return fail("Elige como quieres empezar tu CV.");
    }

    const existingCvs = await db
      .select({ id: cvs.id })
      .from(cvs)
      .where(eq(cvs.userId, actor.userId))
      .limit(1);

    const isFirst = existingCvs.length === 0;

    const [newCv] = (await db
      .insert(cvs)
      .values({
        userId: actor.userId,
        title,
        content,
        isBase: true,
        isPrincipal: isFirst,
        templateName: "harvard",
        accentColor: "#1a5f7a",
        fontFamily: "helvetica",
        pageMargin: 36,
        scale: 1.0,
      })
      .returning()) as any[];

    if (actor.kind === "user") {
      await createAuditLog("cv_create_manual", actor.userId, actor.email, {
        cvId: newCv.id,
        title: newCv.title,
        source: "trial_flow",
      });
      revalidatePath("/dashboard");
    }

    return { success: true as const, cvId: newCv.id };
  } catch (error: any) {
    console.error("Error creating trial CV:", error);
    return fail(error.message || "No se pudo crear el CV de prueba.");
  }
}
