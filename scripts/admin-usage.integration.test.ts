import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const testUrl = process.env.USAGE_TEST_DATABASE_URL;
test('only registered administrators can exceed plan usage while preserving accounting', { skip: !testUrl }, async t => {
  const target = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && target.pathname.includes('test'), 'Use an isolated local test database');
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users, usagePeriods, planConfigs } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { defaultPlanConfig } = await import('@/lib/plan-config');
  const { getUserPlan } = await import('@/lib/plan-store');
  const usage = await import('@/lib/usage');
  await db.insert(planConfigs).values({ id: 1, version: 1, config: defaultPlanConfig() }).onConflictDoNothing();
  const fixtures: string[] = [];
  const makeUser = async (values: Partial<typeof users.$inferInsert> = {}) => {
    const id = randomUUID(); fixtures.push(id);
    await db.insert(users).values({ id, email: `admin-usage-${id}@example.test`, ...values });
    return id;
  };
  const buckets = ['general', 'matching', 'discovery'] as const;
  const input = (bucket: typeof buckets[number], units = 1) => ({ bucket, units, requestId: randomUUID(), action: 'admin_usage_fixture', input: { bucket, units } });
  const codeIs = (code: string) => (error: unknown) => error instanceof usage.UsageError && error.code === code;
  try {
    for (const pro of [false, true]) {
      await t.test(`${pro ? 'Pro' : 'Free'} admin can exceed all three allowances without losing reservations or idempotency`, async () => {
        const userId = await makeUser({ role: 'admin', subscriptionStatus: pro ? 'active' : 'none' });
        const before = await usage.getUsageSnapshot(userId);
        assert.equal(before.plan, pro ? 'pro' : 'free');
        for (const bucket of buckets) {
          const limit = before.usage[bucket].limit;
          const used = pro && bucket === 'matching' ? 494 : limit + 4;
          await db.insert(usagePeriods).values({ userId, bucket, periodStart: usage.utcUsageMonth(), used });
          const request = input(bucket);
          const operation = await usage.beginUsage(userId, request);
          assert.equal((await usage.getUsageAllowance(userId, bucket)).reserved, 1);
          await assert.rejects(usage.beginUsage(userId, request), codeIs('OPERATION_IN_PROGRESS'));
          assert.equal((await db.transaction(tx => usage.reserveUsage(tx, userId, request))).id, operation.id);
          await assert.rejects(db.transaction(tx => usage.reserveUsage(tx, userId, { ...request, input: { changed: true } })), codeIs('OPERATION_CONFLICT'));
          await db.transaction(tx => usage.consumeUsage(tx, operation.id, { saved: true }));
          await db.transaction(tx => usage.consumeUsage(tx, operation.id, { duplicate: true }));
          assert.equal((await usage.beginUsage(userId, request)).id, operation.id);

          const concurrent = await Promise.all([usage.beginUsage(userId, input(bucket, 2)), usage.beginUsage(userId, input(bucket, 3))]);
          assert.equal((await usage.getUsageAllowance(userId, bucket)).reserved, 5);
          await db.transaction(tx => usage.consumeUsage(tx, concurrent[0].id, { partial: true }, 1));
          for (const pending of concurrent) await db.transaction(tx => usage.releaseUsage(tx, pending.id));
          const snapshot = await usage.getUsageSnapshot(userId);
          assert.equal(snapshot.plan, before.plan);
          assert.deepEqual(snapshot.limits, before.limits);
          assert.deepEqual(snapshot.usage[bucket], {
            used: used + 2, reserved: 0, remaining: 0, limit, unlimited: true,
            resetAt: usage.nextUsageMonth(usage.utcUsageMonth()).toISOString(),
          });
          assert.deepEqual(await usage.getUsageAllowance(userId, bucket), snapshot.usage[bucket]);
        }
        // A later request reads the persisted role again; previous use is retained.
        await db.update(users).set({ role: 'user' }).where(eq(users.id, userId));
        for (const bucket of buckets) {
          await assert.rejects(usage.beginUsage(userId, input(bucket)), codeIs('QUOTA_EXCEEDED'));
          const allowance = await usage.getUsageAllowance(userId, bucket);
          assert.equal(allowance.unlimited, undefined);
          assert.ok(allowance.used > allowance.limit);
        }
      });
    }
    await t.test('a different normal owner and a guest with an admin role do not inherit the exemption', async () => {
      for (const isGuest of [false, true]) {
        const userId = await makeUser({ isGuest, role: isGuest ? 'admin' : 'user' });
        const snapshot = await usage.getUsageSnapshot(userId);
        await db.insert(usagePeriods).values(buckets.map(bucket => ({ userId, bucket,
          periodStart: isGuest ? new Date(0) : usage.utcUsageMonth(), used: snapshot.usage[bucket].limit,
        })));
        for (const bucket of buckets) {
          await assert.rejects(usage.beginUsage(userId, input(bucket)), codeIs('QUOTA_EXCEEDED'));
          assert.equal((await usage.getUsageAllowance(userId, bucket)).unlimited, undefined);
        }
      }
    });
    await t.test('zero monthly limits still allow admin usage; normal accounts remain blocked', async () => {
      const admin = await makeUser({ role: 'admin' }), normal = await makeUser();
      const rollback = new Error('ROLLBACK_ZERO_LIMIT_FIXTURE');
      try {
        await db.transaction(async tx => {
          const { config } = await getUserPlan(admin, tx);
          config.free = { ...config.free, generalAiMonthly: 0, matchingMonthly: 0, discoveryMonthly: 0, matchBatchSize: 0 };
          await tx.update(planConfigs).set({ config }).where(eq(planConfigs.id, 1));
          for (const bucket of buckets) {
            const operation = await usage.reserveUsage(tx, admin, input(bucket));
            await usage.consumeUsage(tx, operation.id, { saved: true });
            const allowance = await usage.getUsageAllowance(admin, bucket, tx);
            assert.equal(allowance.limit, 0); assert.equal(allowance.used, 1); assert.equal(allowance.unlimited, true);
            await assert.rejects(usage.reserveUsage(tx, normal, input(bucket)), codeIs('PLAN_REQUIRED'));
          }
          throw rollback;
        });
      } catch (error) { if (error !== rollback) throw error; }
    });
    await t.test('a suspended administrator cannot use the exemption', async () => {
      const userId = await makeUser({ role: 'admin', accountStatus: 'suspended' });
      await assert.rejects(usage.beginUsage(userId, input('general')), /Unauthorized/);
    });
  } finally {
    if (fixtures.length) await db.delete(users).where(inArray(users.id, fixtures));
    await pool.end();
  }
});
