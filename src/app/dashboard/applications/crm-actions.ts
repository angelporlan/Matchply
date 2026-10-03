'use server';
import { revalidatePath } from 'next/cache';
import { requireProductContext, auditActorFields } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import { log } from '@/lib/logger';
import { isCrmEntity, type CrmEntity, type ListEntity, type CrmConfig } from '@/lib/crm-views';
import { listCrmPage, listCrmIds, listCrmSelected } from '@/lib/crm-list-query';
import { setRowsFavorite, setPeopleStatus, crmIds } from '@/lib/crm-service';
import { EXPORT_OFFER_ID_LIMIT, SELECT_ALL_ID_LIMIT } from '@/lib/application-filter-bounds';

async function context(entity: CrmEntity) {
  if (!isCrmEntity(entity)) throw new Error('INVALID_ENTITY');
  return requireProductContext(entity === 'people' ? { allowGuest: true, feature: 'networking' } : { allowGuest: true, feature: 'applications' });
}
function failure(error: unknown) { log({ event: 'crm_action_failed', level: 'error', code: error instanceof Error ? error.message : 'UNKNOWN' }); return { error: 'CRM_ACTION_FAILED' }; }
function requireListEntity(entity: unknown): asserts entity is ListEntity {
  if (entity !== 'companies' && entity !== 'people') throw new Error('INVALID_ENTITY');
}
export async function queryCrmAction(entity: ListEntity, config: CrmConfig, page = 1) {
  try { requireListEntity(entity); const ctx = await context(entity); return { data: await listCrmPage(ctx.effectiveUser!.id, entity, config, page) }; } catch (e) { return failure(e); }
}
export async function queryCrmIdsAction(entity: ListEntity, config: CrmConfig) {
  try { requireListEntity(entity); const ctx = await context(entity); const ids = await listCrmIds(ctx.effectiveUser!.id, entity, config); return { ids, truncated: ids.length >= SELECT_ALL_ID_LIMIT }; } catch (e) { return failure(e); }
}
export async function setRowsFavoriteAction(entity: CrmEntity, ids: string[], isFavorite: boolean) {
  try {
    const ctx = await context(entity), rows = await setRowsFavorite(ctx.effectiveUser!.id, entity, ids, isFavorite);
    void createAuditLog('crm_favorite_set', ctx.effectiveUser!.id, null, { entity, count: rows.length, isFavorite }, auditActorFields(ctx));
    revalidatePath(entity === 'applications' ? '/dashboard/applications' : `/dashboard/applications/${entity}`);
    return { rows };
  } catch (e) { return failure(e); }
}
export async function setPeopleStatusAction(ids: string[], status: string) {
  try { const ctx = await context('people'); const rows = await setPeopleStatus(ctx.effectiveUser!.id, ids, status); revalidatePath('/dashboard/applications/people'); return { rows }; } catch (e) { return failure(e); }
}
export async function exportCrmRowsAction(entity: ListEntity, input: string[]) {
  try {
    requireListEntity(entity);
    const ctx = await context(entity), ids = crmIds(input);
    if (ids.length > EXPORT_OFFER_ID_LIMIT) return { error: 'EXPORT_LIMIT' };
    const rows = await listCrmSelected(ctx.effectiveUser!.id, entity, ids), map = new Map(rows.map(r => [r.id, r]));
    return { rows: ids.map(id => map.get(id)).filter((row): row is NonNullable<typeof row> => !!row) };
  } catch (e) { return failure(e); }
}
