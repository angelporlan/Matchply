import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { problemReports } from '@/db/schema';
import { parseProblemReport, type ProblemReportInput } from '@/lib/problem-report-schema';

/** Durable acknowledgement; a retry of the same report never inserts a second row. */
export async function saveProblemReport(input: ProblemReportInput) {
  const values = parseProblemReport(input);
  if (!values) return false;
  const inserted = await db.insert(problemReports).values(values).onConflictDoNothing().returning({ id: problemReports.id });
  if (inserted.length) return true;
  const [existing] = await db.select({ requestId: problemReports.requestId, step: problemReports.step, route: problemReports.route, comment: problemReports.comment })
    .from(problemReports).where(eq(problemReports.id, values.id)).limit(1);
  return Boolean(existing && existing.requestId === values.requestId && existing.step === values.step && existing.route === values.route && existing.comment === values.comment);
}

export async function listProblemReports(requestId?: string, page = 1, now = new Date()) {
  const id = typeof requestId === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(requestId) ? requestId : undefined;
  if (requestId && !id) return { rows: [], total: 0, page: 1, pages: 1 };
  const where = and(gte(problemReports.createdAt, new Date(now.getTime() - 30 * 86400_000)), id ? eq(problemReports.requestId, id) : undefined);
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(problemReports).where(where);
  const pages = Math.max(1, Math.ceil(count.total / 50)), current = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
  const rows = await db.select().from(problemReports).where(where).orderBy(desc(problemReports.createdAt), desc(problemReports.id)).limit(50).offset((current - 1) * 50);
  return { rows, total: count.total, page: current, pages };
}

export async function cleanupProblemReports(now = new Date()) {
  const result = await db.execute(sql`delete from ${problemReports} where ${problemReports.id} in
    (select ${problemReports.id} from ${problemReports} where ${problemReports.createdAt} < ${new Date(now.getTime() - 30 * 86400_000)} order by ${problemReports.createdAt} limit 10000)`);
  return result.rowCount || 0;
}
