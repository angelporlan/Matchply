'use server';
import { revalidatePath } from 'next/cache';
import type { ApplicationView } from '@/db/schema';
import { createAuditLog } from '@/lib/audit';
import { type ApplicationViewConfig } from '@/lib/application-views';
import { isCrmEntity, type CrmEntity } from '@/lib/crm-views';
import { deleteCrmViewRow, insertCrmView, setCrmViewDefault, updateCrmViewRow } from '@/lib/crm-view-store';
import { log } from '@/lib/logger';
import { auditActorFields, requireProductContext } from '@/lib/request-context';

async function run(entity: CrmEntity, action: string, operation: (userId: string) => Promise<ApplicationView | null>) {
  try {
    if (!isCrmEntity(entity)) return { error: 'INVALID_ENTITY' };
    const ctx = await requireProductContext(entity === 'people' ? { allowGuest: true, feature: 'networking' } : { allowGuest: true, feature: 'applications' });
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
export async function createCrmView(entity: CrmEntity, viewName: string, config: unknown) {
  return run(entity, 'create', (userId) => insertCrmView(userId, entity, viewName, config));
}
export async function updateCrmView(entity: CrmEntity, id: string, patch: { name?: string; config?: unknown }) {
  return run(entity, 'update', (userId) => updateCrmViewRow(userId, entity, id, patch));
}
export async function deleteCrmView(entity: CrmEntity, id: string) {
  return run(entity, 'delete', (userId) => deleteCrmViewRow(userId, entity, id));
}
export async function setDefaultCrmView(entity: CrmEntity, id: string | null) {
  return run(entity, 'default', (userId) => setCrmViewDefault(userId, entity, id));
}
export async function createApplicationView(name: string, config: ApplicationViewConfig) { return createCrmView('applications', name, config); }
export async function updateApplicationView(id: string, patch: { name?: string; config?: ApplicationViewConfig }) { return updateCrmView('applications', id, patch); }
export async function deleteApplicationView(id: string) { return deleteCrmView('applications', id); }
export async function setDefaultApplicationView(id: string | null) { return setDefaultCrmView('applications', id); }
