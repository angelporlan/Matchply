import { normalizeViewConfig, type ApplicationViewConfig } from './application-views';
import { PERSON_KINDS, PERSON_STATUSES } from './people/types';

export const CRM_ENTITIES = ['applications', 'companies', 'people'] as const;
export type CrmEntity = typeof CRM_ENTITIES[number];
export type ListEntity = Exclude<CrmEntity, 'applications'>;
export type CrmWidth = 'auto' | 'sm' | 'md' | 'lg';
export type CrmColumn = { id: string; label: [string, string]; kind: 'text' | 'date' | 'number' | 'choice' | 'relation' | 'presence'; options?: readonly string[] };
export type CrmFilter = { column: string; operator: string; value: string; values?: string[]; startDate?: string; endDate?: string; minScore?: number; maxScore?: number };
export type CrmConfig = {
  columns: string[];
  filters: { search?: string; favoritesOnly?: boolean; due?: boolean; offerId?: string; columnFilters?: CrmFilter[] };
  sort: { key: string; direction: 'asc' | 'desc' };
  pageSize: number;
  grouping: { column: string; direction: 'asc' | 'desc' } | null;
  columnWidths: Partial<Record<string, CrmWidth>>;
  actionsIndex: number | null;
};
export type SavedCrmView = { id: string; name: string; isDefault: boolean; config: CrmConfig };
export type CrmRow = { id: string; name: string; isFavorite: boolean; companies?: { id: string; name: string }[]; [key: string]: string | number | boolean | Date | null | undefined | { id: string; name: string }[] };
export type CrmPage = { items: CrmRow[]; total: number; page: number; pageSize: number; totalPages: number };
export const CRM_PAGE_SIZES = [10, 25, 50, 100];
export const CRM_WIDTH_PX = { auto: undefined, sm: 110, md: 180, lg: 280 };
export const TEXT_OPERATORS = ['contains', 'notContains', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'];
export const DATE_OPERATORS = ['today', 'last3Days', 'last7Days', 'customRange', 'isEmpty', 'isNotEmpty'];
export const NUMBER_OPERATORS = ['eq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];
export const COMPANY_COLUMNS: CrmColumn[] = [
  { id: 'name', label: ['Empresa', 'Company'], kind: 'text' },
  { id: 'location', label: ['Ubicación', 'Location'], kind: 'text' },
  { id: 'sector', label: ['Sector', 'Industry'], kind: 'text' },
  { id: 'website', label: ['Web', 'Website'], kind: 'text' },
  { id: 'applicationCount', label: ['Postulaciones', 'Applications'], kind: 'number' },
  { id: 'noteCount', label: ['Notas', 'Notes'], kind: 'number' },
  { id: 'updatedAt', label: ['Actualizado', 'Updated'], kind: 'date' },
  { id: 'createdAt', label: ['Creado', 'Created'], kind: 'date' },
];
export const PEOPLE_COLUMNS: CrmColumn[] = [
  { id: 'name', label: ['Persona', 'Person'], kind: 'text' },
  { id: 'role', label: ['Cargo', 'Role'], kind: 'text' },
  { id: 'companyNames', label: ['Empresas', 'Companies'], kind: 'relation' },
  { id: 'status', label: ['Estado', 'Status'], kind: 'choice', options: PERSON_STATUSES },
  { id: 'lastContactAt', label: ['Último contacto', 'Last contact'], kind: 'date' },
  { id: 'nextFollowupAt', label: ['Seguimiento', 'Follow-up'], kind: 'date' },
  { id: 'updatedAt', label: ['Actualizado', 'Updated'], kind: 'date' },
  { id: 'kind', label: ['Tipo', 'Type'], kind: 'choice', options: PERSON_KINDS },
  { id: 'location', label: ['Ubicación', 'Location'], kind: 'text' },
  { id: 'linkedinUrl', label: ['LinkedIn', 'LinkedIn'], kind: 'text' },
  { id: 'email', label: ['Email', 'Email'], kind: 'text' },
  { id: 'origin', label: ['Origen', 'Origin'], kind: 'text' },
  { id: 'createdAt', label: ['Creado', 'Created'], kind: 'date' },
];
export function isCrmEntity(value: unknown): value is CrmEntity { return CRM_ENTITIES.includes(value as CrmEntity); }
export function crmColumns(entity: ListEntity) { return entity === 'companies' ? COMPANY_COLUMNS : PEOPLE_COLUMNS; }
export function defaultCrmConfig(entity: ListEntity): CrmConfig {
  return { columns: crmColumns(entity).slice(0, 7).map(c => c.id), filters: {}, sort: { key: entity === 'companies' ? 'name' : 'updatedAt', direction: entity === 'companies' ? 'asc' : 'desc' }, pageSize: 25, grouping: null, columnWidths: {}, actionsIndex: null };
}
export function filterOperators(column: CrmColumn) {
  if (column.kind === 'date') return DATE_OPERATORS;
  if (column.kind === 'number') return NUMBER_OPERATORS;
  if (column.kind === 'presence') return ['isEmpty', 'isNotEmpty'];
  if (column.kind === 'choice' || column.kind === 'relation') return ['in', 'isEmpty', 'isNotEmpty'];
  return TEXT_OPERATORS;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeCrmConfig(entity: ListEntity, input: unknown): CrmConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<CrmConfig>;
  const defaults = defaultCrmConfig(entity), defs = crmColumns(entity), valid = new Set(defs.map(c => c.id));
  const columns = Array.isArray(raw.columns) ? Array.from(new Set(raw.columns.filter(c => valid.has(c)))) : [];
  const filters: CrmFilter[] = [];
  for (const f of Array.isArray(raw.filters?.columnFilters) ? raw.filters.columnFilters.slice(0, 30) : []) {
    if (!f || typeof f !== 'object') continue;
    const def = defs.find(c => c.id === f.column);
    if (!def || !filterOperators(def).includes(f.operator)) continue;
    const value = typeof f.value === 'string' ? f.value.trim().slice(0, 160) : '';
    const next: CrmFilter = { column: f.column, operator: f.operator, value };
    if (f.operator === 'in') {
      next.values = Array.from(new Set((Array.isArray(f.values) ? f.values : []).filter(v => typeof v === 'string' && (def.kind === 'relation' ? uuid.test(v) : def.options?.includes(v))))).slice(0, 50);
      if (!next.values.length) continue;
    } else if (f.operator === 'customRange') {
      for (const key of ['startDate', 'endDate'] as const) { if (typeof f[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f[key]!) && Number.isFinite(new Date(f[key]!).valueOf())) next[key] = f[key]; }
      if (!next.startDate && !next.endDate) continue;
      if (next.startDate && next.endDate && next.startDate > next.endDate) continue;
    } else if (def.kind === 'number' && !f.operator.startsWith('is')) {
      if (!/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) continue;
    } else if (def.kind === 'text' && !f.operator.startsWith('is') && !value) continue;
    const existing = filters.findIndex(item => item.column === next.column);
    if (existing < 0) filters.push(next); else filters[existing] = next;
  }
  return {
    columns: columns.length ? columns : defaults.columns,
    filters: { search: typeof raw.filters?.search === 'string' ? raw.filters.search.slice(0, 240) : '', favoritesOnly: raw.filters?.favoritesOnly === true, due: entity === 'people' && raw.filters?.due === true, offerId: entity === 'people' && typeof raw.filters?.offerId === 'string' && uuid.test(raw.filters.offerId) ? raw.filters.offerId : undefined, columnFilters: filters },
    sort: { key: valid.has(raw.sort?.key || '') ? raw.sort!.key : defaults.sort.key, direction: raw.sort?.direction === 'asc' ? 'asc' : raw.sort?.direction === 'desc' ? 'desc' : defaults.sort.direction },
    pageSize: CRM_PAGE_SIZES.includes(raw.pageSize || 0) ? raw.pageSize! : 25,
    grouping: raw.grouping && valid.has(raw.grouping.column) ? { column: raw.grouping.column, direction: raw.grouping.direction === 'desc' ? 'desc' : 'asc' } : null,
    columnWidths: Object.fromEntries(Object.entries(raw.columnWidths || {}).filter(([k, v]) => (valid.has(k) || k === 'actions') && typeof v === 'string' && ['sm', 'md', 'lg'].includes(v))),
    actionsIndex: Number.isInteger(raw.actionsIndex) && typeof raw.actionsIndex === 'number' ? Math.max(0, Math.min(raw.actionsIndex, columns.length || defaults.columns.length)) : null,
  };
}
export function normalizeEntityConfig(entity: CrmEntity, input: unknown): CrmConfig | ApplicationViewConfig { return entity === 'applications' ? normalizeViewConfig(input) : normalizeCrmConfig(entity, input); }
export function systemCrmViews(entity: ListEntity) {
  const base = defaultCrmConfig(entity);
  return [ { id: 'all', name: ['Todas', 'All'], config: base }, { id: 'favorites', name: ['Favoritos', 'Favorites'], config: { ...base, filters: { favoritesOnly: true } } }, ...(entity === 'people' ? [{ id: 'followup', name: ['Seguimientos pendientes', 'Follow-ups due'], config: { ...base, filters: { due: true } } }] : []) ];
}
