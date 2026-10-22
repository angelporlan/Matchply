import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const target = process.env.PERFORMANCE_TEST_DATABASE_URL;

test('request-local plan reuse preserves access and snapshots with fewer selects', { skip: !target }, async () => {
  const url = new URL(target!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = target;
  const { db, pool } = await import('@/db');
  const { users, cvs, aiJobs } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { getUserPlan } = await import('@/lib/plan-store');
  const { getUsageSnapshot } = await import('@/lib/usage');
  const { getCvAccess } = await import('@/lib/cv-access');
  const { getAiJobForUser } = await import('@/lib/ai-jobs/queue');
  const { ObservedPool } = await import('@/lib/observed-pool');
  const ids = Array.from({ length: 4 }, () => randomUUID());
  let selects = 0;
  const tracked = new Proxy(db, { get(object, key) {
    if (key === 'select') return (...args: unknown[]) => { selects++; return Reflect.apply(object.select, object, args); };
    const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
  } });
  try {
    await db.insert(users).values(ids.map((id, i) => ({ id, email: `perf-${id}@example.test`, isGuest: i === 0, subscriptionStatus: i === 2 ? 'active' : 'none', role: i === 3 ? 'admin' : 'user' })));
    for (const userId of ids) {
      await db.insert(cvs).values(Array.from({ length: 20 }, (_, i) => ({ userId, title: `CV ${i}`, content: '# Private', isBase: i < 2, isPrincipal: i === 0 })));
      selects = 0;
      const context = await getUserPlan(userId, tracked);
      const reused = await Promise.all([getUsageSnapshot(userId, tracked, context), getCvAccess(userId, tracked, context)]);
      assert.equal(selects, 5);
      selects = 0;
      const separate = await Promise.all([getUsageSnapshot(userId, tracked), getCvAccess(userId, tracked)]);
      assert.equal(selects, 7); assert.deepEqual(reused, separate);
      await assert.rejects(getCvAccess(randomUUID(), tracked, context), /Unauthorized/);
    }
    const context = await getUserPlan(ids[2]);
    await db.update(users).set({ subscriptionStatus: 'none' }).where(eq(users.id, ids[2]));
    assert.equal((await getUsageSnapshot(ids[2])).plan, 'free');
    assert.equal(context.plan, 'pro', 'snapshots are local values, never a global permission cache');
    await db.update(users).set({ accountStatus: 'suspended' }).where(eq(users.id, ids[2]));
    await assert.rejects(getUserPlan(ids[2]), /Unauthorized/);
    const [job] = await db.insert(aiJobs).values({ userId: ids[1], kind: 'import_offer', payload: { url: 'https://example.test' }, resolvedAiConfig: { private: true } }).returning();
    const observed = await getAiJobForUser(ids[1], job.id);
    assert.equal(observed?.status, job.status); assert.equal(observed?.kind, job.kind);
    assert.ok(!('resolvedAiConfig' in observed!));
    assert.equal(await getAiJobForUser(ids[0], job.id), null);
    const single = new ObservedPool({ connectionString: target, max: 1 }, () => { throw new Error('telemetry unavailable'); });
    const held = await single.connect();
    try {
      const waiting = single.connect();
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(single.waitingCount, 1);
      held.release(); const next = await waiting; next.release();
      await single.query('select 1'); // pg.query uses the callback form of connect.
      assert.equal(single.acquisitionStats().count, 3);
      assert.ok(single.acquisitionStats().maxMs >= 20);
    } finally { await single.end(); }
    await assert.rejects(single.connect(), /end/);
  } finally { await db.delete(users).where(inArray(users.id, ids)); await pool.end(); }
});
