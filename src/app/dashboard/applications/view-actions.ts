'use server';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { applicationViews } from '@/db/schema';
import { createAuditLog } from '@/lib/audit';
import { type ApplicationViewConfig } from '@/lib/application-views';
import { isCrmEntity, normalizeEntityConfig, type CrmEntity } from '@/lib/crm-views';
import { log } from '@/lib/logger';
import { auditActorFields, requireProductContext } from '@/lib/request-context';

async function run(entity: CrmEntity, action: string, operation: (userId: string) => Promise<typeof applicationViews.$inferSelect | null>) {
  try {
    if (!isCrmEntity(entity)) return { error: 'INVALID_ENTITY' };
    const ctx = await requireProductContext(entity === 'people' ? { feature: 'networking' } : { allowGuest: true, feature: 'applications' });
    const view = await operation(ctx.effectiveUser!.id);
    void createAuditLog(`crm_view_${action}`, ctx.effectiveUser!.id, null, { entity, viewId: view?.id }, auditActorFields(ctx));
    revalidatePath(entity === 'applications' ? '/dashboard/applications' : `/dashboard/applications/${entity}`);
    return { success: true, view };
  } catch (error) {
    const candidate = error as { code?: string; cause?: { code?: string }; message?: string };
    if (candidate.code === '23505' || candidate.cause?.code === '23505') return { error: 'DUPLICATE_NAME' };
    log({ event: 'crm_view_failed', level: 'error', entity, action });
    return { error: ['INVALID_NAME', 'NOT_FOUND'].includes(candidate.message || '') ? candidate.message! : 'VIEW_ACTION_FAILED' };
  }
}
function name(value: string) { const clean = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 60) : ''; if (!clean) throw new Error('INVALID_NAME'); return clean; }
export async function createCrmView(entity: CrmEntity, viewName: string, config: unknown) {
  return run(entity, 'create', async userId => {
    const [row] = await db.insert(applicationViews).values({ userId, entity, name: name(viewName), config: normalizeEntityConfig(entity, config) }).returning();
    return row;
  });
}
export async function updateCrmView(entity: CrmEntity, id: string, patch: { name?: string; config?: unknown }) {
  return run(entity, 'update', async userId => {
    const [row] = await db.update(applicationViews).set({ ...(patch.name !== undefined ? { name: name(patch.name) } : {}), ...(patch.config !== undefined ? { config: normalizeEntityConfig(entity, patch.config) } : {}), updatedAt: new Date() }).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).returning();
    if (!row) throw new Error('NOT_FOUND'); return row;
  });
}
export async function deleteCrmView(entity: CrmEntity, id: string) {
  return run(entity, 'delete', async userId => {
    const [row] = await db.delete(applicationViews).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).returning();
    if (!row) throw new Error('NOT_FOUND'); return row;
  });
}
export async function setDefaultCrmView(entity: CrmEntity, id: string | null) {
  return run(entity, 'default', userId => db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`crm-view:${userId}:${entity}`}))`);
    if (id) {
      const [row] = await tx.select({ id: applicationViews.id }).from(applicationViews).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).limit(1);
      if (!row) throw new Error('NOT_FOUND');
    }
    await tx.update(applicationViews).set({ isDefault: false }).where(and(eq(applicationViews.userId, userId), eq(applicationViews.entity, entity)));
    if (!id) return null;
    const [row] = await tx.update(applicationViews).set({ isDefault: true, updatedAt: new Date() }).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).returning();
    return row;
  }));
}
export async function createApplicationView(name: string, config: ApplicationViewConfig) { return createCrmView('applications', name, config); }
export async function updateApplicationView(id: string, patch: { name?: string; config?: ApplicationViewConfig }) { return updateCrmView('applications', id, patch); }
export async function deleteApplicationView(id: string) { return deleteCrmView('applications', id); }
export async function setDefaultApplicationView(id: string | null) { return setDefaultCrmView('applications', id); }
