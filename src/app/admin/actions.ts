'use server';

import { auth } from '@/auth';
import { db } from '@/db';
import { users, cvs, jobOffers, settings, prompts, auditLogs } from '@/db/schema';
import { eq, and, not, sql, desc, gte, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// Helper de seguridad para asegurar que solo los admins llaman a estas acciones
async function verifyAdmin() {
  const session = await auth();
  if (!session || !session.user || (session.user as any).role !== 'admin') {
    throw new Error('No autorizado. Debes ser administrador.');
  }
  return session.user.id;
}

// 1. Obtener estadísticas globales y lista rápida de usuarios
export async function getAdminStats() {
  await verifyAdmin();

  try {
    // Conteos rápidos
    const [usersCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isGuest, false));
    const [guestsCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isGuest, true));
    const [cvsCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cvs)
      .innerJoin(users, eq(cvs.userId, users.id))
      .where(eq(users.isGuest, false));
    const [offersCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobOffers)
      .innerJoin(users, eq(jobOffers.userId, users.id))
      .where(eq(users.isGuest, false));

    // Conteo de suscripciones activas
    const [activeSubsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.subscriptionStatus, 'active'), eq(users.isGuest, false)));

    // Obtener lista completa de usuarios
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        subscriptionStatus: users.subscriptionStatus,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.isGuest, false))
      .orderBy(sql`${users.createdAt} DESC`);

    return {
      success: true,
      stats: {
        totalUsers: Number(usersCountResult?.count || 0),
        totalGuests: Number(guestsCountResult?.count || 0),
        totalCvs: Number(cvsCountResult?.count || 0),
        totalOffers: Number(offersCountResult?.count || 0),
        activeSubscriptions: Number(activeSubsResult?.count || 0),
      },
      users: allUsers,
    };
  } catch (error: any) {
    console.error('Error al obtener estadísticas de administración:', error);
    return { success: false, error: error.message || 'Error del servidor' };
  }
}

// 2. Obtener toda la información detallada de un usuario en particular
export async function getUserDetails(targetUserId: string) {
  await verifyAdmin();

  try {
    const [userProfile] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!userProfile) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    // Obtener CVs del usuario
    const userCvs = await db
      .select()
      .from(cvs)
      .where(eq(cvs.userId, targetUserId))
      .orderBy(sql`${cvs.createdAt} DESC`);

    // Obtener candidaturas (ofertas de trabajo)
    const userOffers = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.userId, targetUserId))
      .orderBy(sql`${jobOffers.createdAt} DESC`);

    return {
      success: true,
      profile: userProfile,
      cvs: userCvs,
      offers: userOffers,
    };
  } catch (error: any) {
    console.error(`Error al obtener detalles del usuario ${targetUserId}:`, error);
    return { success: false, error: error.message };
  }
}

// 3. Obtener configuraciones de IA y Prompts
export async function getAIConfig() {
  await verifyAdmin();

  try {
    const allSettings = await db.select().from(settings);
    const allPrompts = await db.select().from(prompts).orderBy(sql`${prompts.createdAt} DESC`);

    return {
      success: true,
      settings: allSettings,
      prompts: allPrompts,
    };
  } catch (error: any) {
    console.error('Error al obtener configuraciones de IA:', error);
    return { success: false, error: error.message };
  }
}

// 4. Guardar/Actualizar un Setting de IA
export async function updateAISetting(key: string, value: string) {
  await verifyAdmin();

  if (!key || value === undefined) {
    return { success: false, error: 'Clave y valor requeridos' };
  }

  try {
    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error(`Error al guardar configuración ${key}:`, error);
    return { success: false, error: error.message };
  }
}

// 5. Guardar/Editar un Prompt dinámico
export async function savePrompt(data: {
   id?: string;
  name: string;
  nameEn?: string;
  key: string;
  description?: string;
  descriptionEn?: string;
  color?: string;
  systemPrompt: string;
  userPrompt: string;
  isActive: boolean;
  isArchived?: boolean;
  isStrict?: boolean;
}) {
  await verifyAdmin();

  if (!data.name || !data.key || !data.systemPrompt || !data.userPrompt) {
    return { success: false, error: 'Todos los campos son obligatorios' };
  }

  try {
    const isCreating = !data.id;
    const now = new Date();
    const isArchivedVal = data.isArchived ?? false;
    const isStrictVal = data.isStrict ?? false;

    let targetId = data.id;

    if (isCreating) {
      const [inserted] = await db
        .insert(prompts)
        .values({
          name: data.name,
          nameEn: data.nameEn || null,
          key: data.key,
          description: data.description || null,
          descriptionEn: data.descriptionEn || null,
          color: data.color || null,
          systemPrompt: data.systemPrompt,
          userPrompt: data.userPrompt,
          isActive: data.isActive,
          isArchived: isArchivedVal,
          isStrict: isStrictVal,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      targetId = inserted.id;
    } else {
      await db
        .update(prompts)
        .set({
          name: data.name,
          nameEn: data.nameEn || null,
          key: data.key,
          description: data.description || null,
          descriptionEn: data.descriptionEn || null,
          color: data.color || null,
          systemPrompt: data.systemPrompt,
          userPrompt: data.userPrompt,
          isActive: data.isActive,
          isArchived: isArchivedVal,
          isStrict: isStrictVal,
          updatedAt: now,
        })
        .where(eq(prompts.id, data.id!));
    }

    // Si se marcó como activo, desactivamos todos los demás prompts de la misma función/key
    if (data.isActive && targetId) {
      await db
        .update(prompts)
        .set({ isActive: false })
        .where(and(eq(prompts.key, data.key), not(eq(prompts.id, targetId))));
    }

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error('Error al guardar prompt:', error);
    return { success: false, error: error.message };
  }
}

// 6. Eliminar un Prompt
export async function deletePrompt(id: string) {
  await verifyAdmin();

  try {
    // Comprobar si es activo antes de borrar
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id)).limit(1);
    if (prompt?.isActive) {
      return { success: false, error: 'No se puede eliminar el prompt que está actualmente activo.' };
    }

    await db.delete(prompts).where(eq(prompts.id, id));
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error('Error al eliminar prompt:', error);
    return { success: false, error: error.message };
  }
}

// 7. Alternar estado activo de un prompt
export async function togglePromptActive(id: string, key: string) {
  await verifyAdmin();

  try {
    // Poner el prompt objetivo como activo
    await db
      .update(prompts)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(prompts.id, id));

    // Desactivar todos los demás prompts para la misma función/key
    await db
      .update(prompts)
      .set({ isActive: false })
      .where(and(eq(prompts.key, key), not(eq(prompts.id, id))));

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error('Error al activar el prompt:', error);
    return { success: false, error: error.message };
  }
}

// 8. Actualizar el Rol de un Usuario
export async function updateUserRole(userId: string, newRole: string) {
  const currentUserId = await verifyAdmin();

  if (userId === currentUserId) {
    return { success: false, error: 'No puedes quitarte el rol de administrador a ti mismo.' };
  }

  if (newRole !== 'admin' && newRole !== 'user') {
    return { success: false, error: 'Rol no válido.' };
  }

  try {
    await db
      .update(users)
      .set({ role: newRole })
      .where(eq(users.id, userId));

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error(`Error al actualizar rol del usuario ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

// 9. Actualizar manualmente la suscripción de un usuario (para soporte)
export async function updateUserSubscription(userId: string, status: string) {
  await verifyAdmin();

  try {
    await db
      .update(users)
      .set({ subscriptionStatus: status })
      .where(eq(users.id, userId));

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error(`Error al actualizar suscripción de usuario ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

// 10. Archivar / Desarchivar un Prompt
export async function togglePromptArchive(id: string, isArchived: boolean) {
  await verifyAdmin();

  try {
    // Si se va a archivar y es el activo, dar error
    if (isArchived) {
      const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id)).limit(1);
      if (prompt?.isActive) {
        return { success: false, error: 'No puedes archivar el prompt que está actualmente activo. Desactívalo primero.' };
      }
    }

    await db
      .update(prompts)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(prompts.id, id));

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error('Error al archivar/desarchivar el prompt:', error);
    return { success: false, error: error.message };
  }
}

// 11. Obtener logs de auditoría para el panel de administración
export async function getAdminAuditLogs() {
  await verifyAdmin();
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(1000); // Límite razonable para procesar en cliente

    return { success: true, logs };
  } catch (error: any) {
    console.error('Error al obtener logs de auditoría:', error);
    return { success: false, error: error.message };
  }
}

// 12. Obtener estadísticas de actividad de auditoría de HOY
export async function getAdminAuditStats() {
  await verifyAdmin();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filtrar conteos rápidos para HOY
    const [registersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, 'user_register'),
          gte(auditLogs.createdAt, today)
        )
      );

    const [loginsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, 'user_login'),
          gte(auditLogs.createdAt, today)
        )
      );

    // Currículums creados hoy (creación manual + optimización por IA)
    const [cvsCreatedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(
        and(
          or(
            eq(auditLogs.action, 'cv_create_manual'),
            eq(auditLogs.action, 'cv_optimize_ai')
          ),
          gte(auditLogs.createdAt, today)
        )
      );

    const [downloadsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, 'cv_download_pdf'),
          gte(auditLogs.createdAt, today)
        )
      );

    return {
      success: true,
      stats: {
        registersToday: Number(registersCount?.count || 0),
        loginsToday: Number(loginsCount?.count || 0),
        cvsCreatedToday: Number(cvsCreatedCount?.count || 0),
        downloadsToday: Number(downloadsCount?.count || 0),
      }
    };
  } catch (error: any) {
    console.error('Error al obtener estadísticas de auditoría:', error);
    return { success: false, error: error.message };
  }
}

// 13. Obtener información y límites de la clave OpenRouter
export async function getOpenRouterKeyInfo() {
  await verifyAdmin();

  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key.includes("mock-key") || key === "") {
    return {
      success: false,
      error: 'La API Key de OpenRouter no está configurada o es una clave de prueba.'
    };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      next: { revalidate: 0 } // Deshabilitar caché para tener datos en tiempo real
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Error de la API de OpenRouter (${response.status}): ${response.statusText || errorText}`
      };
    }

    const json = await response.json();
    return {
      success: true,
      data: json.data
    };
  } catch (error: any) {
    console.error('Error al obtener info de clave OpenRouter:', error);
    return {
      success: false,
      error: error.message || 'Error al conectar con la API de OpenRouter.'
    };
  }
}
