import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { operationalErrors } from '@/db/schema';
import { errorEventValues, type ErrorEventInput } from '@/lib/diagnostics-schema';

export async function recordErrorEvent(input: ErrorEventInput) {
  const values = errorEventValues(input);
  if (values) await db.insert(operationalErrors).values(values);
}

export async function listOperationalErrors(requestId?: string, page = 1, now = new Date()) {
  const id = typeof requestId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(requestId) ? requestId : undefined;
  if (requestId && !id) return { rows: [], total: 0, page: 1, pages: 1 };
  const where = and(gte(operationalErrors.createdAt, new Date(now.getTime() - 30 * 86400_000)),
    id ? or(eq(operationalErrors.requestId, id), eq(operationalErrors.traceId, id), eq(operationalErrors.digest, id)) : undefined);
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(operationalErrors).where(where);
  const pages = Math.max(1, Math.ceil(count.total / 50));
  const current = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
  const rows = await db.select().from(operationalErrors).where(where).orderBy(desc(operationalErrors.createdAt), desc(operationalErrors.id)).limit(50).offset((current - 1) * 50);
  return { rows, total: count.total, page: current, pages };
}

/** Bounded retention batch, invoked hourly by the existing AI worker. */
export async function cleanupOperationalErrors(now = new Date()) {
  const result = await db.execute(sql`delete from ${operationalErrors} where ${operationalErrors.id} in
    (select ${operationalErrors.id} from ${operationalErrors} where ${operationalErrors.createdAt} < ${new Date(now.getTime() - 30 * 86400_000)} order by ${operationalErrors.createdAt} limit 10000)`);
  return result.rowCount || 0;
}
