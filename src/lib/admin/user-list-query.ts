import type { ReadonlyURLSearchParams } from 'next/navigation';
import { resolveMadridCreatedRange, type DateRange } from '@/lib/madrid-time';
import type { CrmFilter } from '@/lib/crm-views';
import { ADMIN_USER_COLUMNS, adminPageNumber, legacyDateFilter, mergeAdminFilters, parseAdminColumnFilters } from './table-filters';

export const USER_PAGE_SIZES = [10, 25, 50, 100] as const;
export type UserPageSize = typeof USER_PAGE_SIZES[number];
export type UserSortField = 'createdAt' | 'lastSeenAt' | 'lastLoginAt' | 'email' | 'name' | 'role' | 'plan' | 'status';
export type UserPlanFilter = 'all' | 'pro' | 'stripe' | 'trialing' | 'granted' | 'free';
export type UserActivityFilter = 'all' | '7d' | '30d' | 'none';

export type AdminUserListQuery = {
  q: string;
  created: string;
  from: string;
  to: string;
  role: 'all' | 'user' | 'admin';
  plan: UserPlanFilter;
  status: 'all' | 'active' | 'suspended';
  activity: UserActivityFilter;
  page: number;
  pageSize: UserPageSize;
  sort: UserSortField;
  dir: 'asc' | 'desc';
  columnFilters: CrmFilter[];
};

const SORT_FIELDS = new Set(ADMIN_USER_COLUMNS.map(column => column.id));
const PLANS = new Set<UserPlanFilter>(['all', 'pro', 'stripe', 'trialing', 'granted', 'free']);

function read(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export function parseAdminUserListQuery(
  searchParams: Record<string, string | string[] | undefined>,
  now = new Date(),
): AdminUserListQuery & { createdRange: DateRange | null; activityRange: DateRange | null } {
  const pageSizeRaw = Number(read(searchParams, 'pageSize'));
  const pageSize = (USER_PAGE_SIZES as readonly number[]).includes(pageSizeRaw) ? pageSizeRaw as UserPageSize : 25;
  const page = adminPageNumber(read(searchParams, 'page'));
  const sortRaw = read(searchParams, 'sort') as UserSortField;
  const sort = SORT_FIELDS.has(sortRaw) ? sortRaw : 'createdAt';
  const dir = read(searchParams, 'dir') === 'asc' ? 'asc' : 'desc';
  const roleRaw = read(searchParams, 'role');
  const planRaw = read(searchParams, 'plan') as UserPlanFilter;
  const statusRaw = read(searchParams, 'status');
  const activityRaw = read(searchParams, 'activity') as UserActivityFilter;
  const created = read(searchParams, 'created');
  const from = read(searchParams, 'from');
  const to = read(searchParams, 'to');
  const createdRange = resolveMadridCreatedRange({ preset: created, from, to, now });
  const activityRange = activityRaw === '7d' || activityRaw === '30d'
    ? resolveMadridCreatedRange({ preset: activityRaw, now })
    : null;
  const legacy: CrmFilter[] = [
    ...legacyDateFilter('createdAt', createdRange),
    ...legacyDateFilter('lastSeenAt', activityRange),
  ];
  if (roleRaw === 'user' || roleRaw === 'admin') legacy.push({ column: 'role', operator: 'in', value: '', values: [roleRaw] });
  if (statusRaw === 'active' || statusRaw === 'suspended') legacy.push({ column: 'status', operator: 'in', value: '', values: [statusRaw] });
  if (PLANS.has(planRaw) && planRaw !== 'all') legacy.push({ column: 'plan', operator: 'in', value: '', values: planRaw === 'pro' ? ['stripe', 'trialing', 'granted'] : [planRaw] });
  if (activityRaw === 'none') legacy.push({ column: 'lastSeenAt', operator: 'isEmpty', value: '' });

  return {
    q: read(searchParams, 'q').trim(),
    created,
    from,
    to,
    role: roleRaw === 'admin' || roleRaw === 'user' ? roleRaw : 'all',
    plan: PLANS.has(planRaw) ? planRaw : 'all',
    status: statusRaw === 'active' || statusRaw === 'suspended' ? statusRaw : 'all',
    activity: activityRaw === '7d' || activityRaw === '30d' || activityRaw === 'none' ? activityRaw : 'all',
    page,
    pageSize,
    sort,
    dir,
    createdRange,
    activityRange,
    columnFilters: mergeAdminFilters(legacy, parseAdminColumnFilters(read(searchParams, 'columnFilters'), ADMIN_USER_COLUMNS)),
  };
}

export function userListQueryString(query: Partial<AdminUserListQuery>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'createdRange' || key === 'activityRange') continue;
    if (key === 'columnFilters') {
      if (Array.isArray(value) && value.length) params.set(key, JSON.stringify(value));
      continue;
    }
    if (value === undefined || value === '' || value === 'all') continue;
    if (key === 'page' && value === 1) continue;
    if (key === 'pageSize' && value === 25) continue;
    if (key === 'sort' && value === 'createdAt') continue;
    if (key === 'dir' && value === 'desc') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function parseSearchParamsObject(searchParams?: ReadonlyURLSearchParams | Record<string, string | string[] | undefined>) {
  if (!searchParams) return {};
  if (typeof (searchParams as ReadonlyURLSearchParams).get === 'function') {
    const out: Record<string, string> = {};
    (searchParams as ReadonlyURLSearchParams).forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return searchParams as Record<string, string | string[] | undefined>;
}
