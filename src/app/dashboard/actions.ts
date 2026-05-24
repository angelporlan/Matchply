"use server";

import { db } from "@/db";
import { cvs, jobOffers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const DEFAULT_MARKDOWN = `# TU NOMBRE COMPLETO

**Email:** tuemail@correo.com | **Teléfono:** +34 123 456 789 | **Ubicación:** Madrid, España
**LinkedIn:** linkedin.com/in/tuusuario | **GitHub:** github.com/tuusuario | **Web:** tuweb.com

## Perfil Profesional
Ingeniero de Software Full Stack apasionado por construir productos SaaS eficientes, escalables y visualmente impactantes. Experiencia liderando equipos técnicos ágiles y diseñando integraciones complejas de servicios cloud e IA.

## Experiencia Profesional
### Desarrollador de Software Senior
**Empresa de Tecnología Innovadora** | *2022 - Presente*
- Dirigí la migración de la plataforma core a una arquitectura moderna en la nube, reduciendo los costos de infraestructura en un **24%**.
- Implementé pipelines de automatización de CI/CD que aceleraron la velocidad de despliegue en producción un **40%**.
- Coordiné un equipo ágil de 6 desarrolladores, fomentando las revisiones de código exhaustivas y la mentoría técnica.

### Desarrollador Full Stack
**Agencia Digital Creativa** | *2019 - 2022*
- Desarrollé más de 15 aplicaciones web responsivas utilizando frameworks modernos y bases de datos relacionales robustas.
- Reduje el tiempo de renderizado frontend en un **30%** a través de optimizaciones avanzadas de CSS y carga diferida de imágenes.

## Educación
### Grado en Ingeniería Informática
**Universidad Tecnológica Nacional** | *2015 - 2019*

## Habilidades
- **Frontend:** React, Next.js, Tailwind CSS, TypeScript, JavaScript
- **Backend & DB:** Node.js, Express, PostgreSQL, Drizzle ORM, REST APIs
- **Herramientas & Cloud:** Docker, AWS, Git, GitHub Actions, Linux
`;

export async function setPrincipalCv(cvId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;

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
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    // Contar cuántos CVs base tiene el usuario ya
    const existingCvs = await db
      .select({ id: cvs.id })
      .from(cvs)
      .where(eq(cvs.userId, session.user.id))
      .limit(1);

    const isFirst = existingCvs.length === 0;

    const [newCv] = await db
      .insert(cvs)
      .values({
        userId: session.user.id,
        title: title || "Mi Currículum Base",
        content: DEFAULT_MARKDOWN,
        isBase: true,
        isPrincipal: isFirst,
        templateName: "harvard",
        accentColor: "#1a5f7a",
        fontFamily: "helvetica",
        pageMargin: 36,
        scale: 1.0,
      })
      .returning();

    revalidatePath("/dashboard");
    return { success: true, cvId: newCv.id };
  } catch (error: any) {
    console.error("Error creating CV:", error);
    return { error: error.message || "Failed to create CV" };
  }
}

export async function deleteCv(cvId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    // Comprobar pertenencia
    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== session.user.id) {
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
          .where(eq(cvs.userId, session.user.id))
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
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    // Comprobar pertenencia
    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== session.user.id) {
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
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const [cv] = await db.select().from(cvs).where(eq(cvs.id, cvId)).limit(1);
    if (!cv || cv.userId !== session.user.id) {
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
