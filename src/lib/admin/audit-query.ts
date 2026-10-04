import { and, desc, eq, sql, type SQLWrapper } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { resolveMadridCreatedRange } from '@/lib/madrid-time';
import type { CrmFilter } from '@/lib/crm-views';
import { ADMIN_AUDIT_COLUMNS, adminPageNumber, legacyDateFilter, mergeAdminFilters, parseAdminColumnFilters } from './table-filters';
import { adminColumnFilterSql } from './table-filter-sql';
import { escapeIlikePattern } from '@/lib/application-filter-bounds';

const auditActor = alias(users, 'audit_actor');
const auditAffected = alias(users, 'audit_affected');

export type AuditListQuery = {
  q: string;
  action: string;
  actorId: string;
  affectedId: string;
  category: 'all' | 'ordinary' | 'admin';
  created: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  sort: string;
  dir: 'asc' | 'desc';
  columnFilters: CrmFilter[];
};

function read(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export function parseAuditQuery(searchParams: Record<string, string | string[] | undefined>, now = new Date()): AuditListQuery & { range: ReturnType<typeof resolveMadridCreatedRange> } {
  const range = resolveMadridCreatedRange({ preset: read(searchParams, 'created'), from: read(searchParams, 'from'), to: read(searchParams, 'to'), now });
  const legacy: CrmFilter[] = legacyDateFilter('createdAt', range);
  for (const [param, column] of [['action', 'action'], ['actorId', 'actorUserId'], ['affectedId', 'affectedUserId']]) {
    if (read(searchParams, param).trim()) legacy.push({ column, operator: param === 'action' ? 'equals' : 'contains', value: read(searchParams, param).trim() });
  }
  const category = read(searchParams, 'category');
  if (category === 'admin' || category === 'ordinary') legacy.push({ column: 'category', operator: 'in', value: '', values: [category] });
  return {
    q: read(searchParams, 'q').trim(),
    action: read(searchParams, 'action').trim(),
    actorId: read(searchParams, 'actorId').trim(),
    affectedId: read(searchParams, 'affectedId').trim(),
    category: read(searchParams, 'category') === 'admin' || read(searchParams, 'category') === 'ordinary'
      ? read(searchParams, 'category') as 'admin' | 'ordinary'
      : 'all',
    created: read(searchParams, 'created'),
    from: read(searchParams, 'from'),
    to: read(searchParams, 'to'),
    page: adminPageNumber(read(searchParams, 'page')),
    pageSize: [10, 25, 50, 100].includes(Number(read(searchParams, 'pageSize'))) ? Number(read(searchParams, 'pageSize')) : 25,
    sort: ADMIN_AUDIT_COLUMNS.some(column => column.id === read(searchParams, 'sort')) ? read(searchParams, 'sort') : 'createdAt',
    dir: read(searchParams, 'dir') === 'asc' ? 'asc' : 'desc',
    columnFilters: mergeAdminFilters(legacy, parseAdminColumnFilters(read(searchParams, 'columnFilters'), ADMIN_AUDIT_COLUMNS)),
    range,
  };
}

export async function listAdminAuditLogs(searchParams: Record<string, string | string[] | undefined>, now = new Date()) {
  const query = parseAuditQuery(searchParams, now);
  const columns: Record<string, SQLWrapper> = {
    createdAt: auditLogs.createdAt, action: auditLogs.action, userEmail: auditLogs.userEmail, category: auditLogs.category,
    actorUserId: sql`concat_ws(' ', ${auditLogs.actorUserId}::text, ${auditActor.name}, ${auditActor.email})`,
    affectedUserId: sql`concat_ws(' ', ${auditLogs.affectedUserId}::text, ${auditAffected.name}, ${auditAffected.email})`,
  };
  const filters = query.columnFilters.map(filter => {
    if (filter.column === 'actorUserId' || filter.column === 'affectedUserId') {
      const actor = filter.column === 'actorUserId' ? auditActor : auditAffected;
      const id = filter.column === 'actorUserId' ? auditLogs.actorUserId : auditLogs.affectedUserId;
      if (filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty') {
        return adminColumnFilterSql(filter, ADMIN_AUDIT_COLUMNS, { ...columns, [filter.column]: id }, now);
      }
      const parts = [sql`${id}::text`, actor.name, actor.email].map(column =>
        adminColumnFilterSql(filter, ADMIN_AUDIT_COLUMNS, { ...columns, [filter.column]: column }, now));
      const negative = filter.operator === 'notContains' || filter.operator === 'notEquals';
      return sql`(${sql.join(parts, negative ? sql` and ` : sql` or `)})`;
    }
    return adminColumnFilterSql(filter, ADMIN_AUDIT_COLUMNS, columns, now);
  });
  if (query.q) {
    const like = `%${escapeIlikePattern(query.q)}%`;
    filters.push(sql`(
      ${auditLogs.action} ilike ${like}
      or coalesce(${auditLogs.userEmail}, '') ilike ${like}
      or coalesce(${auditLogs.details}, '') ilike ${like}
      or ${columns.actorUserId} ilike ${like}
      or ${columns.affectedUserId} ilike ${like}
    )`);
  }
  const where = filters.length ? and(...filters) : undefined;
  const [countRow] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditLogs)
    .leftJoin(auditActor, eq(auditLogs.actorUserId, auditActor.id))
    .leftJoin(auditAffected, eq(auditLogs.affectedUserId, auditAffected.id))
    .where(where);
  const total = Number(countRow?.count || 0);
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  query.page = Math.min(query.page, pageCount);
  const offset = (query.page - 1) * query.pageSize;
  const sortColumn = query.sort === 'actorUserId'
    ? sql`coalesce(nullif(${auditActor.name}, ''), ${auditActor.email}, ${auditLogs.actorUserId}::text)`
    : query.sort === 'affectedUserId'
      ? sql`coalesce(nullif(${auditAffected.name}, ''), ${auditAffected.email}, ${auditLogs.affectedUserId}::text)`
      : columns[query.sort];
  const direction = query.dir === 'asc' ? sql`asc` : sql`desc`;
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      userEmail: auditLogs.userEmail,
      createdAt: auditLogs.createdAt,
      actorUserId: auditLogs.actorUserId,
      actorName: auditActor.name,
      actorEmail: auditActor.email,
      affectedUserId: auditLogs.affectedUserId,
      affectedName: auditAffected.name,
      affectedEmail: auditAffected.email,
      category: auditLogs.category,
    })
    .from(auditLogs)
    .leftJoin(auditActor, eq(auditLogs.actorUserId, auditActor.id))
    .leftJoin(auditAffected, eq(auditLogs.affectedUserId, auditAffected.id))
    .where(where)
    .orderBy(sql`${sortColumn} ${direction} nulls last`, sql`${auditLogs.id} ${direction}`)
    .limit(query.pageSize)
    .offset(offset);

  return {
    query,
    total,
    pageCount,
    rows,
  };
}

export async function getUserActivityLogs(userId: string, page = 1, pageSize = 25) {
  const offset = (Math.max(1, page) - 1) * pageSize;
  const where = sql`(${auditLogs.userId} = ${userId} or ${auditLogs.affectedUserId} = ${userId})`;
  const [countRow] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditLogs).where(where);
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorUserId: auditLogs.actorUserId,
      category: auditLogs.category,
    })
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(pageSize)
    .offset(offset);
  return { total: Number(countRow?.count || 0), rows };
}
