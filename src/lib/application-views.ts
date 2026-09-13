import type { ApplicationSummary } from '@/lib/job-offer-queries';

export const APPLICATION_COLUMN_IDS = [
  'title',
  'company',
  'status',
  'score',
  'cv',
  'followup',
  'platform',
  'url',
  'source',
  'liveness',
  'createdAt',
  'updatedAt',
] as const;

export type ApplicationColumnId = typeof APPLICATION_COLUMN_IDS[number];

export const DEFAULT_APPLICATION_COLUMNS: ApplicationColumnId[] = [
  'title',
  'company',
  'status',
  'createdAt',
  'updatedAt',
];

export const APPLICATION_SORT_KEYS = [
  'title',
  'company',
  'status',
  'score',
  'followup',
  'createdAt',
  'updatedAt',
] as const;

export type ApplicationSortKey = typeof APPLICATION_SORT_KEYS[number];
export type ApplicationSortDirection = 'asc' | 'desc';

export type ApplicationCvFilter = 'all' | 'linked' | 'unlinked';
export type ApplicationDateFilter = 'all' | 'today' | '7days' | 'custom';
export type ApplicationFollowupFilter = 'all' | 'withDate' | 'overdue';

export const APPLICATION_STATUSES = ['interested', 'applied', 'interview', 'offer', 'rejected', 'archived'] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

export const DEFAULT_EXCLUDED_STATUSES: ApplicationStatus[] = ['archived'];

export const APPLICATION_COLUMN_FILTER_OPERATORS = [
  'contains',
  'notContains',
  'equals',
  'notEquals',
  'isEmpty',
  'isNotEmpty',
] as const;

export type ApplicationColumnFilterOperator = typeof APPLICATION_COLUMN_FILTER_OPERATORS[number];

export const APPLICATION_COLUMN_DATE_FILTER_OPERATORS = [
  'today',
  'last3Days',
  'last7Days',
  'customRange',
] as const;

export type ApplicationColumnDateFilterOperator = typeof APPLICATION_COLUMN_DATE_FILTER_OPERATORS[number];

export const APPLICATION_COLUMN_MULTI_FILTER_OPERATORS = ['in'] as const;
export type ApplicationColumnMultiFilterOperator = typeof APPLICATION_COLUMN_MULTI_FILTER_OPERATORS[number];

export type ApplicationColumnFilterOperatorValue =
  | ApplicationColumnFilterOperator
  | ApplicationColumnDateFilterOperator
  | ApplicationColumnMultiFilterOperator;

export const APPLICATION_DATE_COLUMN_IDS = ['createdAt', 'updatedAt'] as const;
export type ApplicationDateColumnId = typeof APPLICATION_DATE_COLUMN_IDS[number];

export function isApplicationDateColumn(column: unknown): column is ApplicationDateColumnId {
  return typeof column === 'string' && (APPLICATION_DATE_COLUMN_IDS as readonly string[]).includes(column);
}

export function isApplicationDateColumnFilterOperator(
  operator: unknown,
): operator is ApplicationColumnDateFilterOperator {
  return typeof operator === 'string'
    && (APPLICATION_COLUMN_DATE_FILTER_OPERATORS as readonly string[]).includes(operator);
}

export function isApplicationMultiFilterOperator(
  operator: unknown,
): operator is ApplicationColumnMultiFilterOperator {
  return operator === 'in';
}

export type ApplicationColumnFilter = {
  column: ApplicationColumnId;
  operator: ApplicationColumnFilterOperatorValue;
  value: string;
  values?: string[];
  startDate?: string;
  endDate?: string;
};

export type ApplicationGrouping = {
  column: ApplicationColumnId;
  direction: ApplicationSortDirection;
};

export const APPLICATION_COLUMN_WIDTHS = ['auto', 'sm', 'md', 'lg'] as const;
export type ApplicationColumnWidth = typeof APPLICATION_COLUMN_WIDTHS[number];

export const APPLICATION_COLUMN_WIDTH_PX: Record<ApplicationColumnWidth, number | null> = {
  auto: null,
  sm: 110,
  md: 180,
  lg: 280,
};

export type ApplicationViewFilters = {
  search?: string;
  status?: string;
  cv?: ApplicationCvFilter;
  date?: ApplicationDateFilter;
  startDate?: string;
  endDate?: string;
  followup?: ApplicationFollowupFilter;
  columnFilters?: ApplicationColumnFilter[];
  excludedStatuses?: ApplicationStatus[];
};

export type ApplicationSortState = {
  key: ApplicationSortKey;
  direction: ApplicationSortDirection;
};

export type ApplicationColumnWidths = Partial<Record<ApplicationColumnId | 'actions', ApplicationColumnWidth>>;

export type ApplicationViewConfig = {
  columns: ApplicationColumnId[];
  filters: ApplicationViewFilters;
  sort: ApplicationSortState;
  pageSize: number;
  grouping: ApplicationGrouping | null;
  columnWidths: ApplicationColumnWidths;
  actionsIndex: number | null;
};

export const APPLICATION_PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_VIEW_CONFIG: ApplicationViewConfig = {
  columns: DEFAULT_APPLICATION_COLUMNS,
  filters: {
    status: 'all',
    cv: 'all',
    date: 'all',
    followup: 'all',
    excludedStatuses: DEFAULT_EXCLUDED_STATUSES,
  },
  sort: { key: 'updatedAt', direction: 'desc' },
  pageSize: 25,
  grouping: null,
  columnWidths: {},
  actionsIndex: null,
};

export type SystemViewDefinition = {
  id: string;
  nameKey: string;
  config: ApplicationViewConfig;
};

export const SYSTEM_VIEWS: SystemViewDefinition[] = [
  {
    id: 'active',
    nameKey: 'applications.views.system.active',
    config: DEFAULT_VIEW_CONFIG,
  },
  {
    id: 'interested',
    nameKey: 'applications.views.system.interested',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      filters: { ...DEFAULT_VIEW_CONFIG.filters, status: 'interested' },
      sort: { key: 'score', direction: 'desc' },
    },
  },
  {
    id: 'applied',
    nameKey: 'applications.views.system.applied',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      filters: { ...DEFAULT_VIEW_CONFIG.filters, status: 'applied' },
      sort: { key: 'updatedAt', direction: 'desc' },
    },
  },
  {
    id: 'interview',
    nameKey: 'applications.views.system.interview',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      filters: { ...DEFAULT_VIEW_CONFIG.filters, status: 'interview' },
      sort: { key: 'updatedAt', direction: 'desc' },
    },
  },
  {
    id: 'archived',
    nameKey: 'applications.views.system.archived',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      filters: { ...DEFAULT_VIEW_CONFIG.filters, status: 'archived' },
      sort: { key: 'updatedAt', direction: 'desc' },
    },
  },
  {
    id: 'followup',
    nameKey: 'applications.views.system.followup',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      columns: ['title', 'company', 'status', 'followup', 'updatedAt'],
      filters: { ...DEFAULT_VIEW_CONFIG.filters, followup: 'withDate' },
      sort: { key: 'followup', direction: 'asc' },
    },
  },
  {
    id: 'recent',
    nameKey: 'applications.views.system.recent',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      sort: { key: 'createdAt', direction: 'desc' },
    },
  },
];

export const SYSTEM_VIEW_IDS = SYSTEM_VIEWS.map((view) => view.id);

function isColumnId(value: unknown): value is ApplicationColumnId {
  return typeof value === 'string' && (APPLICATION_COLUMN_IDS as readonly string[]).includes(value);
}

function isSortKey(value: unknown): value is ApplicationSortKey {
  return typeof value === 'string' && (APPLICATION_SORT_KEYS as readonly string[]).includes(value);
}

function isPageSize(value: unknown): value is number {
  return typeof value === 'number' && (APPLICATION_PAGE_SIZES as readonly number[]).includes(value);
}

function isColumnFilterOperator(value: unknown): value is ApplicationColumnFilterOperator {
  return typeof value === 'string' && (APPLICATION_COLUMN_FILTER_OPERATORS as readonly string[]).includes(value);
}

function isColumnWidth(value: unknown): value is ApplicationColumnWidth {
  return typeof value === 'string' && (APPLICATION_COLUMN_WIDTHS as readonly string[]).includes(value);
}

function normalizeDateInput(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function normalizeColumnFilters(input: unknown): ApplicationColumnFilter[] {
  if (!Array.isArray(input)) return [];
  const filters: ApplicationColumnFilter[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<ApplicationColumnFilter>;
    if (!isColumnId(candidate.column)) continue;

    let filter: ApplicationColumnFilter;
    if (isApplicationDateColumn(candidate.column)) {
      if (!isApplicationDateColumnFilterOperator(candidate.operator)) continue;
      if (candidate.operator === 'customRange') {
        const startDate = normalizeDateInput(candidate.startDate);
        const endDate = normalizeDateInput(candidate.endDate);
        if (!startDate && !endDate) continue;
        filter = {
          column: candidate.column,
          operator: candidate.operator,
          value: '',
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        };
      } else {
        filter = { column: candidate.column, operator: candidate.operator, value: '' };
      }
    } else if (isApplicationMultiFilterOperator(candidate.operator)) {
      const rawValues = Array.isArray(candidate.values) ? candidate.values : [];
      const values: string[] = [];
      for (const entry of rawValues) {
        if (typeof entry !== 'string') continue;
        const normalizedValue = entry.trim().slice(0, 80);
        if (!normalizedValue) continue;
        if (
          candidate.column === 'status'
          && !(APPLICATION_STATUSES as readonly string[]).includes(normalizedValue)
        ) {
          continue;
        }
        if (!values.includes(normalizedValue)) values.push(normalizedValue);
        if (values.length >= 50) break;
      }
      if (values.length === 0) continue;
      filter = { column: candidate.column, operator: candidate.operator, value: '', values };
    } else {
      if (!isColumnFilterOperator(candidate.operator)) continue;
      const needsValue = candidate.operator !== 'isEmpty' && candidate.operator !== 'isNotEmpty';
      const value = typeof candidate.value === 'string' ? candidate.value.trim().slice(0, 160) : '';
      if (needsValue && !value) continue;
      filter = {
        column: candidate.column,
        operator: candidate.operator,
        value: needsValue ? value : '',
      };
    }

    const existing = filters.findIndex((item) => item.column === filter.column);
    if (existing >= 0) filters[existing] = filter;
    else filters.push(filter);
  }
  return filters;
}

function normalizeGrouping(input: unknown): ApplicationGrouping | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<ApplicationGrouping>;
  if (!isColumnId(candidate.column)) return null;
  return {
    column: candidate.column,
    direction: candidate.direction === 'desc' ? 'desc' : 'asc',
  };
}

function isColumnWidthKey(value: string): value is ApplicationColumnId | 'actions' {
  return value === 'actions' || isColumnId(value);
}

function normalizeColumnWidths(input: unknown): ApplicationColumnWidths {
  if (!input || typeof input !== 'object') return {};
  const widths: ApplicationColumnWidths = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isColumnWidthKey(key) || !isColumnWidth(value) || value === 'auto') continue;
    widths[key] = value;
  }
  return widths;
}

function normalizeActionsIndex(input: unknown, columnsCount: number): number | null {
  if (typeof input !== 'number' || !Number.isInteger(input)) return null;
  return Math.min(Math.max(0, input), columnsCount);
}

function normalizeExcludedStatuses(input: unknown): ApplicationStatus[] {
  if (!Array.isArray(input)) return [...DEFAULT_EXCLUDED_STATUSES];
  const statuses: ApplicationStatus[] = [];
  for (const value of input) {
    if (typeof value !== 'string' || !(APPLICATION_STATUSES as readonly string[]).includes(value)) continue;
    const status = value as ApplicationStatus;
    if (!statuses.includes(status)) statuses.push(status);
  }
  return statuses;
}

export function normalizeViewConfig(input: unknown): ApplicationViewConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<ApplicationViewConfig>;
  const rawFilters = (raw.filters && typeof raw.filters === 'object' ? raw.filters : {}) as ApplicationViewFilters;

  const rawColumns = Array.isArray(raw.columns)
    ? Array.from(new Set(raw.columns.filter(isColumnId)))
    : [];
  const columns = rawColumns.length > 0 ? rawColumns : DEFAULT_APPLICATION_COLUMNS;
  const status = typeof rawFilters.status === 'string'
    && (rawFilters.status === 'all' || (APPLICATION_STATUSES as readonly string[]).includes(rawFilters.status))
    ? rawFilters.status
    : 'all';
  const cv: ApplicationCvFilter = rawFilters.cv === 'linked' || rawFilters.cv === 'unlinked' ? rawFilters.cv : 'all';
  const date: ApplicationDateFilter = rawFilters.date === 'today' || rawFilters.date === '7days' || rawFilters.date === 'custom'
    ? rawFilters.date
    : 'all';
  const followup: ApplicationFollowupFilter = rawFilters.followup === 'withDate' || rawFilters.followup === 'overdue'
    ? rawFilters.followup
    : 'all';

  return {
    columns,
    filters: {
      search: typeof rawFilters.search === 'string' && rawFilters.search.trim() ? rawFilters.search : undefined,
      status,
      cv,
      date,
      startDate: typeof rawFilters.startDate === 'string' && rawFilters.startDate ? rawFilters.startDate : undefined,
      endDate: typeof rawFilters.endDate === 'string' && rawFilters.endDate ? rawFilters.endDate : undefined,
      followup,
      columnFilters: normalizeColumnFilters(rawFilters.columnFilters),
      excludedStatuses: normalizeExcludedStatuses(rawFilters.excludedStatuses),
    },
    sort: {
      key: isSortKey(raw.sort?.key) ? raw.sort!.key : DEFAULT_VIEW_CONFIG.sort.key,
      direction: raw.sort?.direction === 'asc' ? 'asc' : 'desc',
    },
    pageSize: isPageSize(raw.pageSize) ? raw.pageSize : DEFAULT_VIEW_CONFIG.pageSize,
    grouping: normalizeGrouping(raw.grouping),
    columnWidths: normalizeColumnWidths(raw.columnWidths),
    actionsIndex: normalizeActionsIndex(raw.actionsIndex, columns.length),
  };
}

export function scoreToPercent(score: number | null | undefined): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  return score > 5 ? Math.round(score) : Math.round(score * 20);
}

function dayStart(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function matchesDateFilter(createdAt: Date, filters: ApplicationViewFilters, now: Date) {
  const dateFilter = filters.date || 'all';
  if (dateFilter === 'all') return true;

  const offerTime = dayStart(new Date(createdAt));
  const todayTime = dayStart(now);

  if (dateFilter === 'today') return offerTime === todayTime;
  if (dateFilter === '7days') {
    const sevenDaysAgo = new Date(todayTime);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return offerTime >= sevenDaysAgo.getTime() && offerTime <= todayTime;
  }

  let matches = true;
  if (filters.startDate) {
    const start = new Date(`${filters.startDate}T00:00:00`);
    if (!Number.isNaN(start.valueOf())) matches = matches && offerTime >= start.getTime();
  }
  if (filters.endDate) {
    const end = new Date(`${filters.endDate}T00:00:00`);
    if (!Number.isNaN(end.valueOf())) matches = matches && offerTime <= end.getTime();
  }
  return matches;
}

function matchesFollowupFilter(offer: ApplicationSummary, filters: ApplicationViewFilters, now: Date) {
  const followup = filters.followup || 'all';
  if (followup === 'all') return true;
  if (!offer.nextFollowupDate) return false;
  if (followup === 'withDate') return true;
  return dayStart(new Date(offer.nextFollowupDate)) < dayStart(now);
}

export function getApplicationColumnValue(
  offer: ApplicationSummary,
  column: ApplicationColumnId,
): string | null {
  switch (column) {
    case 'title':
      return offer.title || null;
    case 'company':
      return offer.company || null;
    case 'status':
      return offer.status || null;
    case 'score': {
      const score = scoreToPercent(offer.scoreOverall);
      return score === null ? null : String(score);
    }
    case 'cv':
      return offer.cvId || null;
    case 'followup':
      return offer.nextFollowupDate ? new Date(offer.nextFollowupDate).toISOString() : null;
    case 'platform':
      return offer.platform || null;
    case 'url':
      return offer.url || null;
    case 'source':
      return offer.source || null;
    case 'liveness':
      return offer.livenessStatus || null;
    case 'createdAt':
      return new Date(offer.createdAt).toISOString();
    case 'updatedAt':
      return new Date(offer.updatedAt).toISOString();
    default:
      return null;
  }
}

function matchesColumnDateFilter(
  rawValue: string | null,
  filter: ApplicationColumnFilter,
  now: Date,
): boolean {
  if (!rawValue) return false;
  const date = new Date(rawValue);
  if (Number.isNaN(date.valueOf())) return false;

  const offerTime = dayStart(date);
  const today = dayStart(now);

  if (filter.operator === 'today') return offerTime === today;
  if (filter.operator === 'last3Days' || filter.operator === 'last7Days') {
    const days = filter.operator === 'last3Days' ? 3 : 7;
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    return offerTime >= from.getTime() && offerTime <= today;
  }
  if (filter.operator === 'customRange') {
    let matches = true;
    if (filter.startDate) {
      const start = new Date(`${filter.startDate}T00:00:00`);
      if (!Number.isNaN(start.valueOf())) matches = matches && offerTime >= start.getTime();
    }
    if (filter.endDate) {
      const end = new Date(`${filter.endDate}T00:00:00`);
      if (!Number.isNaN(end.valueOf())) matches = matches && offerTime <= end.getTime();
    }
    return matches;
  }
  return true;
}

export function matchesColumnFilter(
  offer: ApplicationSummary,
  filter: ApplicationColumnFilter,
  now: Date = new Date(),
): boolean {
  const raw = getApplicationColumnValue(offer, filter.column);
  const value = raw === null ? '' : raw;
  const needle = filter.value.trim().toLowerCase();

  if (isApplicationDateColumnFilterOperator(filter.operator)) {
    return matchesColumnDateFilter(raw, filter, now);
  }

  if (isApplicationMultiFilterOperator(filter.operator)) {
    const values = filter.values ?? [];
    if (values.length === 0) return true;
    return values.some((entry) => entry.toLowerCase() === value.toLowerCase());
  }

  switch (filter.operator) {
    case 'isEmpty':
      return value.trim() === '';
    case 'isNotEmpty':
      return value.trim() !== '';
    case 'contains':
      return needle === '' || value.toLowerCase().includes(needle);
    case 'notContains':
      return needle === '' || !value.toLowerCase().includes(needle);
    case 'equals':
      return needle === '' || value.toLowerCase() === needle;
    case 'notEquals':
      return needle === '' || value.toLowerCase() !== needle;
    default:
      return true;
  }
}

export function filterApplications(
  offers: ApplicationSummary[],
  filters: ApplicationViewFilters,
  now: Date = new Date(),
) {
  const search = (filters.search || '').trim().toLowerCase();
  const status = filters.status || 'all';
  const cv = filters.cv || 'all';
  const columnFilters = filters.columnFilters ?? [];
  const excludedStatuses = filters.excludedStatuses ?? [];
  const hasExplicitStatusFilter = status !== 'all'
    || columnFilters.some((filter) => filter.column === 'status');

  return offers.filter((offer) => {
    if (search) {
      const haystack = [offer.title, offer.company, offer.platform, offer.tldr]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (status !== 'all' && offer.status !== status) return false;
    if (!hasExplicitStatusFilter && excludedStatuses.includes(offer.status as ApplicationStatus)) return false;
    if (cv === 'linked' && !offer.cvId) return false;
    if (cv === 'unlinked' && offer.cvId) return false;
    if (!matchesDateFilter(offer.createdAt, filters, now)) return false;
    if (!matchesFollowupFilter(offer, filters, now)) return false;
    for (const columnFilter of columnFilters) {
      if (!matchesColumnFilter(offer, columnFilter, now)) return false;
    }
    return true;
  });
}

const STATUS_ORDER: Record<string, number> = {
  interested: 0,
  applied: 1,
  interview: 2,
  offer: 3,
  rejected: 4,
  archived: 5,
};

function compareValues(a: ApplicationSummary, b: ApplicationSummary, key: ApplicationSortKey) {
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    case 'company':
      return a.company.localeCompare(b.company, 'es', { sensitivity: 'base' });
    case 'status':
      return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    case 'score': {
      const scoreA = scoreToPercent(a.scoreOverall) ?? -1;
      const scoreB = scoreToPercent(b.scoreOverall) ?? -1;
      return scoreA - scoreB;
    }
    case 'followup': {
      const timeA = a.nextFollowupDate ? new Date(a.nextFollowupDate).getTime() : Number.POSITIVE_INFINITY;
      const timeB = b.nextFollowupDate ? new Date(b.nextFollowupDate).getTime() : Number.POSITIVE_INFINITY;
      return timeA - timeB;
    }
    case 'createdAt':
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case 'updatedAt':
    default:
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  }
}

export function sortApplications(offers: ApplicationSummary[], sort: ApplicationSortState) {
  const sorted = [...offers];
  const direction = sort.direction === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    const result = compareValues(a, b, sort.key);
    if (result !== 0) return result * direction;
    return a.id.localeCompare(b.id);
  });
  return sorted;
}

export type ApplicationGroup = {
  key: string;
  offers: ApplicationSummary[];
};

export function getApplicationGroupKey(offer: ApplicationSummary, column: ApplicationColumnId): string {
  const value = getApplicationColumnValue(offer, column);
  if (value === null) return '';
  if (column === 'createdAt' || column === 'updatedAt' || column === 'followup') {
    return value.slice(0, 10);
  }
  return value;
}

function compareGroupKeys(a: string, b: string, column: ApplicationColumnId) {
  if (column === 'status') return (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99);
  if (column === 'score') return (Number(a) || 0) - (Number(b) || 0);
  if (column === 'createdAt' || column === 'updatedAt' || column === 'followup') return a.localeCompare(b);
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

export function groupApplications(
  offers: ApplicationSummary[],
  grouping: ApplicationGrouping,
): ApplicationGroup[] {
  const groups = new Map<string, ApplicationSummary[]>();
  for (const offer of offers) {
    const key = getApplicationGroupKey(offer, grouping.column);
    const bucket = groups.get(key);
    if (bucket) bucket.push(offer);
    else groups.set(key, [offer]);
  }

  const direction = grouping.direction === 'asc' ? 1 : -1;
  return Array.from(groups.entries())
    .sort(([keyA], [keyB]) => {
      if (!keyA && !keyB) return 0;
      if (!keyA) return 1;
      if (!keyB) return -1;
      return compareGroupKeys(keyA, keyB, grouping.column) * direction;
    })
    .map(([key, bucket]) => ({ key, offers: bucket }));
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const safePageSize = pageSize > 0 ? pageSize : DEFAULT_VIEW_CONFIG.pageSize;
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    total: items.length,
    start,
    end: Math.min(start + safePageSize, items.length),
  };
}

export function formatApplicationTimestamp(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
