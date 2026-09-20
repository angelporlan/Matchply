import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { resolveMadridCreatedRange } from '@/lib/madrid-time';

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
};

function read(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export function parseAuditQuery(searchParams: Record<string, string | string[] | undefined>, now = new Date()): AuditListQuery & { range: ReturnType<typeof resolveMadridCreatedRange> } {
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
    page: Math.max(1, Number(read(searchParams, 'page')) || 1),
    pageSize: [25, 50, 100].includes(Number(read(searchParams, 'pageSize'))) ? Number(read(searchParams, 'pageSize')) : 25,
    range: resolveMadridCreatedRange({
      preset: read(searchParams, 'created'),
      from: read(searchParams, 'from'),
      to: read(searchParams, 'to'),
      now,
    }),
  };
}

export async function listAdminAuditLogs(searchParams: Record<string, string | string[] | undefined>) {
  const query = parseAuditQuery(searchParams);
  const filters = [];
  if (query.action) filters.push(eq(auditLogs.action, query.action));
  if (query.category !== 'all') filters.push(eq(auditLogs.category, query.category));
  if (query.actorId) filters.push(eq(auditLogs.actorUserId, query.actorId));
  if (query.affectedId) filters.push(eq(auditLogs.affectedUserId, query.affectedId));
  if (query.range) {
    filters.push(gte(auditLogs.createdAt, query.range.start));
    filters.push(sql`${auditLogs.createdAt} < ${query.range.end}`);
  }
  if (query.q) {
    const like = `%${query.q}%`;
    filters.push(sql`(
      ${auditLogs.action} ilike ${like}
      or coalesce(${auditLogs.userEmail}, '') ilike ${like}
      or coalesce(${auditLogs.details}, '') ilike ${like}
    )`);
  }
  const where = filters.length ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.pageSize;
  const [countRow] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditLogs).where(where);
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      userEmail: auditLogs.userEmail,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorUserId: auditLogs.actorUserId,
      affectedUserId: auditLogs.affectedUserId,
      supportSessionId: auditLogs.supportSessionId,
      requestId: auditLogs.requestId,
      category: auditLogs.category,
      ipAddress: auditLogs.ipAddress,
    })
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(query.pageSize)
    .offset(offset);

  return {
    query,
    total: Number(countRow?.count || 0),
    pageCount: Math.max(1, Math.ceil(Number(countRow?.count || 0) / query.pageSize)),
    rows,
  };
}

export async function listAuditActions() {
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(auditLogs.action)
    .limit(200);
  return rows.map((row) => row.action);
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
