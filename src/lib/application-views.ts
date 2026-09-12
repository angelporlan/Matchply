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

export const APPLICATION_STATUSES = ['interested', 'applied', 'interview', 'offer', 'rejected'] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

export type ApplicationViewFilters = {
  search?: string;
  status?: string;
  cv?: ApplicationCvFilter;
  date?: ApplicationDateFilter;
  startDate?: string;
  endDate?: string;
  followup?: ApplicationFollowupFilter;
};

export type ApplicationSortState = {
  key: ApplicationSortKey;
  direction: ApplicationSortDirection;
};

export type ApplicationViewConfig = {
  columns: ApplicationColumnId[];
  filters: ApplicationViewFilters;
  sort: ApplicationSortState;
  pageSize: number;
};

export const APPLICATION_PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_VIEW_CONFIG: ApplicationViewConfig = {
  columns: DEFAULT_APPLICATION_COLUMNS,
  filters: { status: 'all', cv: 'all', date: 'all', followup: 'all' },
  sort: { key: 'updatedAt', direction: 'desc' },
  pageSize: 25,
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
      filters: { status: 'interested', cv: 'all', date: 'all', followup: 'all' },
      sort: { key: 'score', direction: 'desc' },
    },
  },
  {
    id: 'applied',
    nameKey: 'applications.views.system.applied',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      filters: { status: 'applied', cv: 'all', date: 'all', followup: 'all' },
      sort: { key: 'updatedAt', direction: 'desc' },
    },
  },
  {
    id: 'interview',
    nameKey: 'applications.views.system.interview',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      filters: { status: 'interview', cv: 'all', date: 'all', followup: 'all' },
      sort: { key: 'updatedAt', direction: 'desc' },
    },
  },
  {
    id: 'followup',
    nameKey: 'applications.views.system.followup',
    config: {
      ...DEFAULT_VIEW_CONFIG,
      columns: ['title', 'company', 'status', 'followup', 'updatedAt'],
      filters: { status: 'all', cv: 'all', date: 'all', followup: 'withDate' },
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

export function normalizeViewConfig(input: unknown): ApplicationViewConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<ApplicationViewConfig>;
  const rawFilters = (raw.filters && typeof raw.filters === 'object' ? raw.filters : {}) as ApplicationViewFilters;

  const columns = Array.isArray(raw.columns)
    ? Array.from(new Set(raw.columns.filter(isColumnId)))
    : [];
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
    columns: columns.length > 0 ? columns : DEFAULT_APPLICATION_COLUMNS,
    filters: {
      search: typeof rawFilters.search === 'string' && rawFilters.search.trim() ? rawFilters.search : undefined,
      status,
      cv,
      date,
      startDate: typeof rawFilters.startDate === 'string' && rawFilters.startDate ? rawFilters.startDate : undefined,
      endDate: typeof rawFilters.endDate === 'string' && rawFilters.endDate ? rawFilters.endDate : undefined,
      followup,
    },
    sort: {
      key: isSortKey(raw.sort?.key) ? raw.sort!.key : DEFAULT_VIEW_CONFIG.sort.key,
      direction: raw.sort?.direction === 'asc' ? 'asc' : 'desc',
    },
    pageSize: isPageSize(raw.pageSize) ? raw.pageSize : DEFAULT_VIEW_CONFIG.pageSize,
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

export function filterApplications(
  offers: ApplicationSummary[],
  filters: ApplicationViewFilters,
  now: Date = new Date(),
) {
  const search = (filters.search || '').trim().toLowerCase();
  const status = filters.status || 'all';
  const cv = filters.cv || 'all';

  return offers.filter((offer) => {
    if (search) {
      const haystack = [offer.title, offer.company, offer.platform, offer.tldr]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (status !== 'all' && offer.status !== status) return false;
    if (cv === 'linked' && !offer.cvId) return false;
    if (cv === 'unlinked' && offer.cvId) return false;
    if (!matchesDateFilter(offer.createdAt, filters, now)) return false;
    if (!matchesFollowupFilter(offer, filters, now)) return false;
    return true;
  });
}

const STATUS_ORDER: Record<string, number> = {
  interested: 0,
  applied: 1,
  interview: 2,
  offer: 3,
  rejected: 4,
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
