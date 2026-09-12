"use server";

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/db';
import { applicationViews } from '@/db/schema';
import { createAuditLog } from '@/lib/audit';
import { normalizeViewConfig, type ApplicationViewConfig } from '@/lib/application-views';
import { requireUserFeature } from '@/lib/permissions';

const MAX_VIEW_NAME_LENGTH = 60;

function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code === '23505' || candidate?.cause?.code === '23505';
}

function cleanViewName(name: unknown) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_VIEW_NAME_LENGTH);
}

async function requireViewUser() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }
  await requireUserFeature(session.user.id, 'applications');
  return session;
}

export async function createApplicationView(name: string, config: ApplicationViewConfig) {
  try {
    const session = await requireViewUser();
    const cleanName = cleanViewName(name);
    if (!cleanName) return { error: 'INVALID_NAME' };

    const [created] = await db.insert(applicationViews).values({
      userId: session.user.id,
      name: cleanName,
      config: normalizeViewConfig(config),
    }).returning();

    await createAuditLog('application_view_create', session.user.id, session.user.email || null, {
      viewId: created.id,
      name: cleanName,
    });

    revalidatePath('/dashboard/applications');
    return { success: true, view: created };
  } catch (error: any) {
    if (isUniqueViolation(error)) return { error: 'DUPLICATE_NAME' };
    console.error('Error creating application view:', error);
    return { error: error.message || 'Failed to create view' };
  }
}

export async function updateApplicationView(
  id: string,
  patch: { name?: string; config?: ApplicationViewConfig },
) {
  try {
    const session = await requireViewUser();

    const [existing] = await db.select().from(applicationViews).where(and(
      eq(applicationViews.id, id),
      eq(applicationViews.userId, session.user.id),
    )).limit(1);

    if (!existing) return { error: 'NOT_FOUND' };

    const values: { name?: string; config?: ApplicationViewConfig; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (patch.name !== undefined) {
      const cleanName = cleanViewName(patch.name);
      if (!cleanName) return { error: 'INVALID_NAME' };
      values.name = cleanName;
    }
    if (patch.config !== undefined) {
      values.config = normalizeViewConfig(patch.config);
    }

    const [updated] = await db.update(applicationViews).set(values).where(eq(applicationViews.id, id)).returning();

    await createAuditLog('application_view_update', session.user.id, session.user.email || null, {
      viewId: id,
      name: updated.name,
    });

    revalidatePath('/dashboard/applications');
    return { success: true, view: updated };
  } catch (error: any) {
    if (isUniqueViolation(error)) return { error: 'DUPLICATE_NAME' };
    console.error('Error updating application view:', error);
    return { error: error.message || 'Failed to update view' };
  }
}

export async function deleteApplicationView(id: string) {
  try {
    const session = await requireViewUser();

    const [deleted] = await db.delete(applicationViews).where(and(
      eq(applicationViews.id, id),
      eq(applicationViews.userId, session.user.id),
    )).returning();

    if (!deleted) return { error: 'NOT_FOUND' };

    await createAuditLog('application_view_delete', session.user.id, session.user.email || null, {
      viewId: id,
      name: deleted.name,
    });

    revalidatePath('/dashboard/applications');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting application view:', error);
    return { error: error.message || 'Failed to delete view' };
  }
}

export async function setDefaultApplicationView(id: string | null) {
  try {
    const session = await requireViewUser();

    if (id) {
      const [existing] = await db.select({ id: applicationViews.id }).from(applicationViews).where(and(
        eq(applicationViews.id, id),
        eq(applicationViews.userId, session.user.id),
      )).limit(1);
      if (!existing) return { error: 'NOT_FOUND' };
    }

    await db.transaction(async (tx) => {
      await tx.update(applicationViews)
        .set({ isDefault: false })
        .where(eq(applicationViews.userId, session.user.id));
      if (id) {
        await tx.update(applicationViews)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(and(eq(applicationViews.id, id), eq(applicationViews.userId, session.user.id)));
      }
    });

    await createAuditLog('application_view_set_default', session.user.id, session.user.email || null, {
      viewId: id,
    });

    revalidatePath('/dashboard/applications');
    return { success: true };
  } catch (error: any) {
    console.error('Error setting default application view:', error);
    return { error: error.message || 'Failed to set default view' };
  }
}
