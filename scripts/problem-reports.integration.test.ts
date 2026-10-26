import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const database = process.env.PROBLEM_REPORTS_TEST_DATABASE_URL;
test('problem reports acknowledge durable idempotent inserts, paginate, and expire only old records', { skip: !database }, async () => {
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(database!).hostname) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db');
  const { problemReports } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { saveProblemReport, listProblemReports, cleanupProblemReports } = await import('@/lib/problem-reports');
  const ids = [randomUUID(), randomUUID(), randomUUID()], requestId = randomUUID();
  const input = { id: ids[0], requestId, step: 'optimization' as const, route: '/editor/private-title?secret=value', comment: '<script>untrusted</script> $1 SELECT personal comment' };
  try {
    assert.deepEqual(await Promise.all([saveProblemReport(input), saveProblemReport(input)]), [true, true]);
    const records = await db.select().from(problemReports).where(eq(problemReports.id, ids[0]));
    assert.equal(records.length, 1); assert.equal(records[0].comment, input.comment); assert.equal(records[0].route, '/editor/:cvId');
    assert.equal(await saveProblemReport({ ...input, comment: 'Different body with reused ID' }), false);
    assert.equal((await listProblemReports(requestId)).total, 1);
    assert.equal((await listProblemReports("'; SELECT private")).total, 0);
    assert.equal(await saveProblemReport({ id: ids[1], requestId: null, step: 'page', route: '/try', comment: '' }), true);
    await saveProblemReport({ ...input, id: ids[2] });
    await db.update(problemReports).set({ createdAt: new Date(Date.now() - 31 * 86400_000) }).where(eq(problemReports.id, ids[2]));
    await cleanupProblemReports();
    assert.equal((await db.select().from(problemReports).where(eq(problemReports.id, ids[2]))).length, 0);
    assert.equal((await db.select().from(problemReports).where(inArray(problemReports.id, ids.slice(0,2)))).length, 2);
    const page = await listProblemReports(undefined, Number.MAX_SAFE_INTEGER);
    assert.ok(page.rows.length <= 50); assert.equal(page.page, page.pages);
  } finally { await db.delete(problemReports).where(inArray(problemReports.id, ids)); await pool.end(); }
});
