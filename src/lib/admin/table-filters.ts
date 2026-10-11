import { filterOperators, type CrmColumn, type CrmFilter } from '@/lib/crm-views';
import { madridDayRange, madridRollingRange, madridYmd, type DateRange } from '@/lib/madrid-time';

export const ADMIN_USER_COLUMNS: CrmColumn[] = [
  { id: 'name', label: ['Nombre', 'Name'], kind: 'text' },
  { id: 'email', label: ['Correo', 'Email'], kind: 'text' },
  { id: 'createdAt', label: ['Alta', 'Joined'], kind: 'date' },
  { id: 'lastLoginAt', label: ['Último acceso', 'Last login'], kind: 'date' },
  { id: 'lastSeenAt', label: ['Actividad', 'Activity'], kind: 'date' },
  { id: 'role', label: ['Rol', 'Role'], kind: 'choice', options: ['user', 'admin'] },
  { id: 'plan', label: ['Plan', 'Plan'], kind: 'choice', options: ['free', 'stripe', 'trialing', 'granted'] },
  { id: 'status', label: ['Estado', 'Status'], kind: 'choice', options: ['active', 'suspended'] },
];

export const ADMIN_AUDIT_COLUMNS: CrmColumn[] = [
  { id: 'createdAt', label: ['Fecha', 'Date'], kind: 'date' },
  { id: 'action', label: ['Acción', 'Action'], kind: 'text' },
  { id: 'userEmail', label: ['Correo', 'Email'], kind: 'text' },
  { id: 'actorUserId', label: ['Actor', 'Actor'], kind: 'text' },
  { id: 'affectedUserId', label: ['Afectado', 'Affected user'], kind: 'text' },
  { id: 'category', label: ['Categoría', 'Category'], kind: 'choice', options: ['ordinary', 'admin'] },
];

export function adminOptionLabel(column: string, value: string, en: boolean) {
  const labels: Record<string, Record<string, [string, string]>> = {
    role: { user: ['Usuario', 'User'], admin: ['Administrador', 'Administrator'] },
    plan: { free: ['Gratis', 'Free'], stripe: ['Pro Stripe', 'Pro Stripe'], trialing: ['Prueba Stripe', 'Stripe trial'], granted: ['Pro concesión', 'Granted Pro'] },
    status: { active: ['Activo', 'Active'], suspended: ['Suspendido', 'Suspended'] },
    category: { ordinary: ['Ordinaria', 'Ordinary'], admin: ['Administrativa', 'Administrative'] },
  };
  return labels[column]?.[value]?.[en ? 1 : 0] || value;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

/** Only known columns and operators reach SQL. One active filter per column. */
export function parseAdminColumnFilters(raw: unknown, definitions: CrmColumn[]): CrmFilter[] {
  if (typeof raw === 'string') {
    if (raw.length > 16_000) return [];
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  const filters = new Map<string, CrmFilter>();
  for (const input of raw.slice(0, 30)) {
    if (!input || typeof input !== 'object') continue;
    const definition = definitions.find(item => item.id === input.column);
    if (!definition || !filterOperators(definition).includes(input.operator)) continue;
    const filter: CrmFilter = {
      column: definition.id,
      operator: input.operator,
      value: typeof input.value === 'string' ? input.value.trim().slice(0, 240) : '',
    };
    if (filter.operator === 'in') {
      filter.values = Array.from(new Set<string>((Array.isArray(input.values) ? input.values : [])
        .filter((value: unknown): value is string => typeof value === 'string' && !!definition.options?.includes(value))));
      if (!filter.values.length) continue;
    } else if (filter.operator === 'customRange') {
      if (validDate(input.startDate)) filter.startDate = input.startDate;
      if (validDate(input.endDate)) filter.endDate = input.endDate;
      if (!filter.startDate && !filter.endDate) continue;
      if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) continue;
    } else if (definition.kind === 'text' && !filter.operator.startsWith('is') && !filter.value) {
      continue;
    }
    filters.set(filter.column, filter);
  }
  return Array.from(filters.values());
}

export function legacyDateFilter(column: string, range: DateRange | null): CrmFilter[] {
  return range ? [{ column, operator: 'customRange', value: '', startDate: madridYmd(range.start), endDate: madridYmd(new Date(range.end.valueOf() - 1)) }] : [];
}

export function mergeAdminFilters(legacy: CrmFilter[], current: CrmFilter[]) {
  return [...legacy.filter(filter => !current.some(item => item.column === filter.column)), ...current];
}

export function adminDateBounds(filter: CrmFilter, now: Date) {
  if (filter.operator === 'today') return madridRollingRange(1, now);
  if (filter.operator === 'last3Days') return madridRollingRange(3, now);
  if (filter.operator === 'last7Days') return madridRollingRange(7, now);
  return {
    start: filter.startDate ? madridDayRange(filter.startDate)?.start : undefined,
    end: filter.endDate ? madridDayRange(filter.endDate)?.end : undefined,
  };
}

export function adminPageNumber(raw: string) {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}
