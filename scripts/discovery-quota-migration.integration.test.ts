import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const testUrl = process.env.DISCOVERY_TEST_DATABASE_URL;
test('discovery quota migration preserves usage, history and custom limits and is idempotent', { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users, planConfigs, planConfigHistory, usagePeriods } = await import('@/db/schema');
  const { defaultPlanConfig, parsePlanConfig } = await import('@/lib/plan-config');
  const { getUsageAllowance, utcUsageMonth } = await import('@/lib/usage');
  const { eq, sql } = await import('drizzle-orm');
  const migration = await readFile('drizzle/0040_discovery_allowance.sql', 'utf8');
  const rollback = new Error('ROLL_BACK_MIGRATION_FIXTURE');
  try {
    await db.transaction(async tx => {
      const [current] = await tx.select().from(planConfigs).where(eq(planConfigs.id, 1)).for('update');
      const [latest] = await tx.select({ version: sql<number>`max(${planConfigHistory.version})` }).from(planConfigHistory);
      const version = Math.max(current.version, latest.version ?? 0) + 100;
      const legacy: any = defaultPlanConfig(); legacy.version = version; legacy.free.generalAiMonthly = 17;
      for (const plan of ['free', 'pro', 'guest']) { delete legacy[plan].discoveryMonthly; legacy[plan].researchMonthly = plan === 'pro' ? 10 : 0; }
      legacy.paywall.copy.b.es.body = 'Texto personalizado: {researchMonthly} investigaciones profundas.';
      legacy.paywall.copy.b.en.body = 'Custom copy: {researchMonthly} deep research reports.';
      await tx.update(planConfigs).set({ version, config: legacy }).where(eq(planConfigs.id, 1));
      await tx.insert(planConfigHistory).values({ version, config: legacy });
      const owner = randomUUID();
      await tx.insert(users).values({ id: owner, email: `${owner}@migration.test` });
      await tx.insert(usagePeriods).values(['general', 'matching', 'research'].map((bucket, index) => ({ userId: owner, bucket, periodStart: utcUsageMonth(), used: index + 3, reserved: 1 })));
      const before = await tx.select().from(usagePeriods).where(eq(usagePeriods.userId, owner));
      await tx.execute(sql.raw(migration));
      const [updated] = await tx.select().from(planConfigs).where(eq(planConfigs.id, 1));
      const config = parsePlanConfig(updated.config);
      assert.equal(updated.version, version + 1); assert.equal(config.free.generalAiMonthly, 17);
      assert.equal(config.free.discoveryMonthly, 10); assert.equal(config.pro.discoveryMonthly, 100);
      assert.match(config.paywall.copy.b.es.body, /^Texto personalizado: \{discoveryMonthly\} candidaturas encontradas por IA/);
      assert.equal((updated.config as any).free.researchMonthly, undefined);
      assert.deepEqual(await tx.select().from(usagePeriods).where(eq(usagePeriods.userId, owner)), before);
      assert.equal((await getUsageAllowance(owner, 'discovery', tx)).used, 0, 'old research reports do not spend the new discovery quota');
      const [historic] = await tx.select().from(planConfigHistory).where(eq(planConfigHistory.version, version));
      assert.deepEqual(historic.config, legacy);
      await tx.execute(sql.raw(migration));
      const [same] = await tx.select().from(planConfigs).where(eq(planConfigs.id, 1));
      assert.equal(same.version, version + 1); assert.deepEqual(same.config, updated.config);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await pool.end(); }
});
