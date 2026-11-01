import { revalidatePath } from 'next/cache';
import type { ApplicationView } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import { asRecord, assertResourceId, parseCrmEntity, parsePageValue, parseViewName } from '@/lib/agent-api/validate';
import { SYSTEM_VIEWS, type ApplicationViewConfig } from '@/lib/application-views';
import { listApplicationsPage } from '@/lib/application-list-query';
import { listCrmPage } from '@/lib/crm-list-query';
import { normalizeEntityConfig, systemCrmViews, type CrmConfig, type CrmEntity } from '@/lib/crm-views';
import { deleteCrmViewRow, getCrmViewRow, insertCrmView, listCrmViewRows, setCrmViewDefault, updateCrmViewRow } from '@/lib/crm-view-store';

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === '23505' || candidate.cause?.code === '23505';
}

function revalidateViews(entity: CrmEntity) {
  revalidatePath(entity === 'applications' ? '/dashboard/applications' : `/dashboard/applications/${entity}`);
}

function presentSaved(row: ApplicationView) {
  return {
    id: row.id,
    entity: row.entity,
    name: row.name,
    isDefault: row.isDefault,
    system: false as const,
    config: normalizeEntityConfig(row.entity, row.config),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function systemViews(entity: CrmEntity) {
  if (entity === 'applications') {
    return SYSTEM_VIEWS.map((view) => ({ id: view.id, entity, nameKey: view.nameKey, system: true as const, config: view.config }));
  }
  return systemCrmViews(entity).map((view) => ({ id: view.id, entity, name: view.name, system: true as const, config: view.config }));
}

function systemConfig(entity: CrmEntity, id: string | null) {
  if (!id) return null;
  if (entity === 'applications') {
    const view = SYSTEM_VIEWS.find((item) => item.id === id);
    return view ? { id: view.id, name: view.nameKey, config: view.config } : null;
  }
  const view = systemCrmViews(entity).find((item) => item.id === id);
  return view ? { id: view.id, name: view.name[0], config: view.config } : null;
}

async function listEntityPage(userId: string, entity: CrmEntity, config: CrmConfig | ApplicationViewConfig, page: number) {
  if (entity === 'applications') {
    const view = config as ApplicationViewConfig;
    const result = await listApplicationsPage({ userId, filters: view.filters, sort: view.sort, page, pageSize: view.pageSize });
    return { data: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages };
  }
  const result = await listCrmPage(userId, entity, config as CrmConfig, page);
  return { data: result.items, page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages };
}

function duplicateName(error: unknown): never {
  if (isUniqueViolation(error)) throw new AgentApiError(409, 'conflict', 'Ya existe una vista con ese nombre.');
  throw error;
}

export async function listAgentViews(userId: string, entityValue: unknown) {
  const entity = parseCrmEntity(entityValue);
  const saved = await listCrmViewRows(userId, entity);
  return { data: { entity, saved: saved.map(presentSaved), system: systemViews(entity) } };
}

export async function getAgentView(userId: string, id: string) {
  assertResourceId(id, 'No se ha encontrado la vista.');
  const row = await getCrmViewRow(userId, id);
  if (!row) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
  return { data: presentSaved(row) };
}

export async function createAgentView(userId: string, body: unknown) {
  const record = asRecord(body);
  const entity = parseCrmEntity(record.entity);
  const name = parseViewName(record.name);
  if ('isDefault' in record && typeof record.isDefault !== 'boolean') {
    throw new AgentApiError(400, 'invalid_body', 'isDefault tiene que ser verdadero o falso.');
  }
  try {
    const row = await insertCrmView(userId, entity, name, record.config, record.isDefault === true);
    revalidateViews(entity);
    return { data: presentSaved(row) };
  } catch (error) {
    duplicateName(error);
  }
}

export async function updateAgentView(userId: string, id: string, body: unknown) {
  assertResourceId(id, 'No se ha encontrado la vista.');
  const record = asRecord(body);
  if (!('name' in record) && !('config' in record)) throw new AgentApiError(400, 'empty_patch', 'No hay campos que actualizar.');
  const existing = await getCrmViewRow(userId, id);
  if (!existing) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
  const patch: { name?: string; config?: unknown } = {};
  if ('name' in record) patch.name = parseViewName(record.name);
  if ('config' in record) patch.config = record.config;
  try {
    const row = await updateCrmViewRow(userId, existing.entity, id, patch);
    revalidateViews(existing.entity);
    return { data: presentSaved(row) };
  } catch (error) {
    duplicateName(error);
  }
}

export async function deleteAgentView(userId: string, id: string) {
  assertResourceId(id, 'No se ha encontrado la vista.');
  const existing = await getCrmViewRow(userId, id);
  if (!existing) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
  await deleteCrmViewRow(userId, existing.entity, id);
  revalidateViews(existing.entity);
  return { data: { id, deleted: true } };
}

export async function setAgentViewDefault(userId: string, id: string, body: unknown) {
  assertResourceId(id, 'No se ha encontrado la vista.');
  const record = asRecord(body);
  if (typeof record.isDefault !== 'boolean') throw new AgentApiError(400, 'invalid_body', 'Indica isDefault.');
  const existing = await getCrmViewRow(userId, id);
  if (!existing) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
  if (record.isDefault) {
    const row = await setCrmViewDefault(userId, existing.entity, id);
    if (!row) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
    revalidateViews(existing.entity);
    return { data: presentSaved(row) };
  }
  await setCrmViewDefault(userId, existing.entity, null);
  const row = await getCrmViewRow(userId, id);
  if (!row) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
  revalidateViews(existing.entity);
  return { data: presentSaved(row) };
}

export async function queryAgentViewRows(userId: string, id: string, pageValue: unknown) {
  assertResourceId(id, 'No se ha encontrado la vista.');
  const row = await getCrmViewRow(userId, id);
  if (!row) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
  const config = normalizeEntityConfig(row.entity, row.config);
  const listed = await listEntityPage(userId, row.entity, config, parsePageValue(pageValue));
  return { ...listed, view: { id: row.id, entity: row.entity, name: row.name, system: false } };
}

export async function queryAgentSystemRows(userId: string, entityValue: unknown, id: string | null, pageValue: unknown) {
  const entity = parseCrmEntity(entityValue);
  const system = systemConfig(entity, id);
  if (!system) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la vista.');
  const listed = await listEntityPage(userId, entity, system.config, parsePageValue(pageValue));
  return { ...listed, view: { id: system.id, entity, name: system.name, system: true } };
}

export async function previewAgentView(userId: string, body: unknown) {
  const record = asRecord(body);
  const entity = parseCrmEntity(record.entity);
  const config = normalizeEntityConfig(entity, record.config);
  const listed = await listEntityPage(userId, entity, config, parsePageValue(record.page));
  return { ...listed, view: { entity, system: false } };
}
