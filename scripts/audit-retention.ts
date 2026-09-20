import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../src/db';
import { auditLogs } from '../src/db/schema';

const ORDINARY_DAYS = 90;
const ADMIN_DAYS = 365;

/** Daily maintenance. Do not run a historical purge during the first deploy. */
export async function purgeExpiredAuditLogs(now = new Date()) {
  const ordinaryCutoff = new Date(now.getTime() - ORDINARY_DAYS * 24 * 60 * 60 * 1000);
  const adminCutoff = new Date(now.getTime() - ADMIN_DAYS * 24 * 60 * 60 * 1000);
  const [ordinary] = await db.delete(auditLogs).where(and(
    eq(auditLogs.category, 'ordinary'),
    lt(auditLogs.createdAt, ordinaryCutoff),
  )).returning({ id: auditLogs.id });
  const [admin] = await db.delete(auditLogs).where(and(
    eq(auditLogs.category, 'admin'),
    lt(auditLogs.createdAt, adminCutoff),
  )).returning({ id: auditLogs.id });
  void ordinary;
  void admin;
  const [{ remaining }] = await db.select({ remaining: sql<number>`cast(count(*) as int)` }).from(auditLogs);
  return { remaining: Number(remaining || 0) };
}

if (process.argv[1]?.includes('audit-retention')) {
  purgeExpiredAuditLogs().then((result) => {
    console.log(JSON.stringify({ event: 'audit_retention', ...result }));
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
