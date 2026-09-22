import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers } from '@/db/schema';
import {
  APPLICATION_PAGE_SIZES,
  APPLICATION_STATUSES,
  isApplicationDateColumn,
  type ApplicationColumnFilter,
  type ApplicationSortState,
  type ApplicationStatus,
  type ApplicationViewFilters,
} from '@/lib/application-views';
import {
  BOARD_COLUMN_PAGE_SIZE,
  SELECT_ALL_ID_LIMIT,
  columnDateRange,
  dateFilterRange,
  emptyStatusCounts,
  escapeIlikePattern,
  scoreFilterRange,
  type ApplicationStatusCounts,
} from '@/lib/application-filter-bounds';
import { applicationSummaryColumns, currentMatchScore, type ApplicationSummary } from '@/lib/job-offer-queries';

export type { ApplicationStatusCounts };

export type ApplicationListQuery = {
  userId: string;
  filters: ApplicationViewFilters;
  sort: ApplicationSortState;
  page?: number;
  pageSize?: number;
  now?: Date;
};

const STATUS_ORDER_SQL = sql`case ${jobOffers.status}
  when 'interested' then 0
  when 'applied' then 1
  when 'interview' then 2
  when 'offer' then 3
  when 'rejected' then 4
  when 'archived' then 5
  else 99 end`;

function archivedStatusSql() {
  return or(eq(jobOffers.status, 'archived'), sql`${jobOffers.status} like 'archived:%'`);
}

function statusEqualsSql(status: string) {
  if (status === 'archived') return archivedStatusSql();
  return eq(jobOffers.status, status);
}

function textColumn(column: ApplicationColumnFilter['column']) {
  switch (column) {
    case 'title':
      return jobOffers.title;
    case 'company':
      return jobOffers.company;
    case 'status':
      return jobOffers.status;
    case 'platform':
      return jobOffers.platform;
    case 'url':
      return jobOffers.url;
    case 'source':
      return jobOffers.source;
    case 'liveness':
      return jobOffers.livenessStatus;
    default:
      return null;
  }
}

function timestampColumn(column: ApplicationColumnFilter['column']) {
  if (column === 'createdAt') return jobOffers.createdAt;
  if (column === 'updatedAt') return jobOffers.updatedAt;
  if (column === 'followup') return jobOffers.nextFollowupDate;
  return null;
}

function columnFilterSql(filter: ApplicationColumnFilter, now: Date): SQL | undefined {
  if (isApplicationDateColumn(filter.column) || filter.column === 'followup') {
    const column = timestampColumn(filter.column);
    if (!column) return undefined;
    if (filter.operator === 'isEmpty') return isNull(column);
    if (filter.operator === 'isNotEmpty') return isNotNull(column);
    const range = columnDateRange(filter, now);
    const parts: SQL[] = [];
    if (range.start) parts.push(gte(column, range.start));
    if (range.end) parts.push(sql`${column} < ${range.end}`);
    return parts.length ? and(...parts) : undefined;
  }

  if (filter.column === 'score') {
    if (filter.operator === 'isEmpty') return sql`${currentMatchScore} is null`;
    if (filter.operator === 'isNotEmpty') return sql`${currentMatchScore} is not null`;
    if (filter.operator === 'equals' && filter.value) {
      return sql`${currentMatchScore} = ${Number(filter.value)}`;
    }
    if (filter.operator === 'notEquals' && filter.value) {
      return sql`${currentMatchScore} is distinct from ${Number(filter.value)}`;
    }
    const range = scoreFilterRange(filter);
    const parts: SQL[] = [sql`${currentMatchScore} is not null`];
    if (range.min !== undefined) parts.push(sql`${currentMatchScore} >= ${range.min}`);
    if (range.max !== undefined) parts.push(sql`${currentMatchScore} <= ${range.max}`);
    return and(...parts);
  }

  if (filter.operator === 'in') {
    const values = filter.values ?? [];
    if (values.length === 0) return undefined;
    if (filter.column === 'company') {
      return inArray(jobOffers.companyId, values);
    }
    if (filter.column === 'status') {
      return or(...values.map((value) => statusEqualsSql(value)));
    }
    const column = textColumn(filter.column);
    if (!column) return undefined;
    return inArray(column, values);
  }

  if (filter.column === 'cv') {
    if (filter.operator === 'isEmpty') return isNull(jobOffers.cvId);
    if (filter.operator === 'isNotEmpty') return isNotNull(jobOffers.cvId);
    return undefined;
  }

  const column = textColumn(filter.column);
  if (!column) return undefined;
  if (filter.operator === 'isEmpty') return sql`coalesce(${column}, '') = ''`;
  if (filter.operator === 'isNotEmpty') return sql`coalesce(${column}, '') <> ''`;
  const needle = escapeIlikePattern(filter.value.trim());
  if (!needle) return undefined;
  if (filter.operator === 'contains') return ilike(column, `%${needle}%`);
  if (filter.operator === 'notContains') return sql`not (${column} ilike ${`%${needle}%`})`;
  if (filter.operator === 'equals') return sql`lower(${column}) = ${filter.value.trim().toLowerCase()}`;
  if (filter.operator === 'notEquals') return sql`lower(coalesce(${column}, '')) <> ${filter.value.trim().toLowerCase()}`;
  return undefined;
}

export function applicationFilterSql(userId: string, filters: ApplicationViewFilters, now: Date) {
  const conditions: SQL[] = [eq(jobOffers.userId, userId)];
  const search = (filters.search || '').trim();
  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    conditions.push(or(
      ilike(jobOffers.title, pattern),
      ilike(jobOffers.company, pattern),
      ilike(jobOffers.platform, pattern),
      ilike(jobOffers.tldr, pattern),
    )!);
  }

  const status = filters.status || 'all';
  const columnFilters = filters.columnFilters ?? [];
  const hasExplicitStatusFilter = status !== 'all' || columnFilters.some((filter) => filter.column === 'status');
  if (status !== 'all') {
    conditions.push(statusEqualsSql(status)!);
  } else if (!hasExplicitStatusFilter) {
    const excluded = filters.excludedStatuses ?? [];
    if (excluded.length > 0) {
      const parts = excluded.map((value) => {
        if (value === 'archived') return sql`not (${archivedStatusSql()})`;
        return ne(jobOffers.status, value);
      });
      conditions.push(and(...parts)!);
    }
  }

  if (filters.cv === 'linked') conditions.push(isNotNull(jobOffers.cvId));
  if (filters.cv === 'unlinked') conditions.push(isNull(jobOffers.cvId));

  const createdRange = dateFilterRange(filters, now);
  if (createdRange.start) conditions.push(gte(jobOffers.createdAt, createdRange.start));
  if (createdRange.end) conditions.push(sql`${jobOffers.createdAt} < ${createdRange.end}`);

  if (filters.followup === 'withDate') conditions.push(isNotNull(jobOffers.nextFollowupDate));
  if (filters.followup === 'overdue') {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    conditions.push(and(isNotNull(jobOffers.nextFollowupDate), sql`${jobOffers.nextFollowupDate} < ${today}`)!);
  }

  for (const filter of columnFilters) {
    const sqlFilter = columnFilterSql(filter, now);
    if (sqlFilter) conditions.push(sqlFilter);
  }

  return and(...conditions)!;
}

function sortClauses(sort: ApplicationSortState) {
  const direction = sort.direction === 'asc' ? asc : desc;
  switch (sort.key) {
    case 'title':
      return [direction(jobOffers.title), asc(jobOffers.id)];
    case 'company':
      return [direction(jobOffers.company), asc(jobOffers.id)];
    case 'status':
      return [sort.direction === 'asc' ? STATUS_ORDER_SQL : sql`${STATUS_ORDER_SQL} desc`, asc(jobOffers.id)];
    case 'score':
      return [
        sort.direction === 'asc'
          ? sql`${currentMatchScore} asc nulls first`
          : sql`${currentMatchScore} desc nulls last`,
        asc(jobOffers.id),
      ];
    case 'followup':
      return [
        sort.direction === 'asc'
          ? sql`${jobOffers.nextFollowupDate} asc nulls last`
          : sql`${jobOffers.nextFollowupDate} desc nulls last`,
        asc(jobOffers.id),
      ];
    case 'createdAt':
      return [direction(jobOffers.createdAt), asc(jobOffers.id)];
    case 'updatedAt':
    default:
      return [direction(jobOffers.updatedAt), asc(jobOffers.id)];
  }
}

function normalizeOffer<T extends { status: string }>(offer: T): T {
  if (offer.status.startsWith('archived:')) return { ...offer, status: 'archived' };
  return offer;
}

export async function countApplicationsByStatus(userId: string): Promise<ApplicationStatusCounts> {
  const rows = await db
    .select({
      status: jobOffers.status,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId))
    .groupBy(jobOffers.status);

  const counts = emptyStatusCounts();
  for (const row of rows) {
    const status = row.status.startsWith('archived:') ? 'archived' : row.status;
    if ((APPLICATION_STATUSES as readonly string[]).includes(status)) {
      counts[status as ApplicationStatus] += Number(row.count) || 0;
    }
    counts.all += Number(row.count) || 0;
  }
  return counts;
}

export async function listApplicationsPage(query: ApplicationListQuery) {
  const now = query.now ?? new Date();
  const pageSize = (APPLICATION_PAGE_SIZES as readonly number[]).includes(query.pageSize || 0)
    ? query.pageSize!
    : 25;
  const where = applicationFilterSql(query.userId, query.filters, now);
  const orderBy = sortClauses(query.sort);

  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(jobOffers)
    .where(where);
  const total = Number(countRow?.count) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const offset = (page - 1) * pageSize;

  const items = await db
    .select(applicationSummaryColumns)
    .from(jobOffers)
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset(offset);

  return {
    items: items.map(normalizeOffer),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function listApplicationIds(query: Omit<ApplicationListQuery, 'page' | 'pageSize'>, limit = SELECT_ALL_ID_LIMIT) {
  const now = query.now ?? new Date();
  const rows = await db
    .select({ id: jobOffers.id })
    .from(jobOffers)
    .where(applicationFilterSql(query.userId, query.filters, now))
    .orderBy(...sortClauses(query.sort))
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function listApplicationsBoard(query: Omit<ApplicationListQuery, 'page' | 'pageSize'> & {
  limitPerStatus?: number;
  offsets?: Partial<Record<ApplicationStatus, number>>;
  statuses?: readonly ApplicationStatus[];
}) {
  const now = query.now ?? new Date();
  const limit = query.limitPerStatus ?? BOARD_COLUMN_PAGE_SIZE;
  const statuses = query.statuses ?? APPLICATION_STATUSES;
  const groups = await Promise.all(statuses.map(async (status) => {
    const offset = query.offsets?.[status] ?? 0;
    const filters: ApplicationViewFilters = {
      ...query.filters,
      status,
      excludedStatuses: [],
    };
    const items = await db
      .select(applicationSummaryColumns)
      .from(jobOffers)
      .where(applicationFilterSql(query.userId, filters, now))
      .orderBy(...sortClauses(query.sort))
      .limit(limit)
      .offset(offset);
    return items.map(normalizeOffer);
  }));
  return groups.flat();
}

export async function loadApplicationsWorkspace(query: ApplicationListQuery & { layout: 'table' | 'board' }) {
  const [statusCounts, list] = await Promise.all([
    countApplicationsByStatus(query.userId),
    query.layout === 'board'
      ? listApplicationsBoard(query).then((items) => ({
        items,
        total: items.length,
        page: 1,
        pageSize: items.length,
        totalPages: 1,
      }))
      : listApplicationsPage(query),
  ]);
  return { ...list, statusCounts };
}

export type ApplicationWorkspace = Awaited<ReturnType<typeof loadApplicationsWorkspace>>;
