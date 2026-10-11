import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { PlanDb } from '@/lib/plan-store';

const testUrl = process.env.PLANS_LOCK_TEST_DATABASE_URL;

test('guest claim, quota release and publication retain a consistent lock order', { skip: !testUrl }, async t => {
  const target = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && target.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users } = await import('@/db/schema');
  const { eq, inArray, sql } = await import('drizzle-orm');
  const usage = await import('@/lib/usage');
  const { lockCvUser } = await import('@/lib/cv-access');
  const { assertUsagePublication } = await import('@/lib/ai-cv-publication');
  const fixtures: string[] = [];
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(complete => { resolve = complete; });
    return { promise, resolve };
  };
  const accounts = async () => {
    // Force account < guest so sorting those two IDs would invert the original actor order.
    const accountId = `00000000-${randomUUID().slice(9)}`, guestId = `ffffffff-${randomUUID().slice(9)}`;
    fixtures.push(accountId, guestId);
    await db.insert(users).values([{ id: accountId, email: `locks-${accountId}@example.test` }, { id: guestId, email: `locks-${guestId}@example.test`, isGuest: true }]);
    const operation = await usage.beginUsage(guestId, { bucket: 'general', action: 'lock_fixture', requestId: randomUUID(), input: {} });
    return { accountId, guestId, operation };
  };
  const waitForAdvisory = async (name: string) => {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const result = await db.execute(sql`SELECT 1 FROM pg_stat_activity WHERE application_name=${name} AND wait_event_type='Lock' AND wait_event='advisory'`);
      if (result.rows.length) return;
      await delay(5);
    }
    assert.fail(`Transaction ${name} did not reach its intended advisory lock`);
  };
  const instrument = (tx: PlanDb, before: (call: number) => Promise<void>, after: (call: number) => Promise<void> = async () => {}) => {
    let calls = 0;
    return new Proxy(tx, { get(target, property, receiver) {
      if (property === 'execute') return async (...args: Parameters<PlanDb['execute']>) => {
        const call = ++calls; await before(call);
        const result = await target.execute(...args); await after(call); return result;
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  try {
    await t.test('release that read the old guest owner cannot deadlock a post-claim publisher', async () => {
      const { accountId, guestId, operation } = await accounts();
      const claimLocked = deferred(), allowClaim = deferred(), releasePaused = deferred(), allowRelease = deferred();
      const work: Promise<unknown>[] = [];
      const claim = db.transaction(async tx => {
        await lockCvUser(tx, accountId); await lockCvUser(tx, guestId); claimLocked.resolve();
        await allowClaim.promise;
        await usage.transferGuestUsage(tx, guestId, accountId);
        await tx.delete(users).where(eq(users.id, guestId));
      });
      work.push(claim);
      try {
      await claimLocked.promise;
      const releaseName = `release-${randomUUID()}`;
      const release = db.transaction(async tx => {
        await tx.execute(sql`SELECT set_config('application_name',${releaseName},true)`);
        await tx.execute(sql`SET LOCAL lock_timeout='3s'`);
        return usage.releaseUsage(instrument(tx, async call => {
          if (call === 2) { releasePaused.resolve(); await allowRelease.promise; }
        }), operation.id);
      });
      work.push(release);
      await waitForAdvisory(releaseName);
      allowClaim.resolve(); await claim; await releasePaused.promise;
      const publishName = `publish-${randomUUID()}`;
      const publication = db.transaction(async tx => {
        await tx.execute(sql`SELECT set_config('application_name',${publishName},true)`);
        await tx.execute(sql`SET LOCAL lock_timeout='3s'`);
        return assertUsagePublication(tx, guestId, operation.id);
      });
      work.push(publication);
      const finished = Promise.allSettled([release, publication]);
      await waitForAdvisory(publishName); allowRelease.resolve();
      const [released, published] = await finished;
      assert.equal(released.status, 'fulfilled');
      assert.equal(published.status, 'rejected');
      assert.equal((published as PromiseRejectedResult).reason.code, 'OPERATION_RELEASED');
      assert.equal((await usage.getUsageSnapshot(accountId)).usage.general.reserved, 0);
      } finally {
        allowClaim.resolve(); allowRelease.resolve();
        await Promise.allSettled(work);
      }
    });
    await t.test('a duplicate claim with a previously captured cookie does not invert publication locks', async () => {
      const { accountId, guestId, operation } = await accounts();
      await db.transaction(async tx => {
        await usage.transferGuestUsage(tx, guestId, accountId);
        await tx.delete(users).where(eq(users.id, guestId));
      });
      const guestLocked = deferred(), allowPublication = deferred();
      const publication = db.transaction(async tx => {
        await tx.execute(sql`SET LOCAL lock_timeout='3s'`);
        return assertUsagePublication(instrument(tx, async () => {}, async call => {
          if (call === 1) { guestLocked.resolve(); await allowPublication.promise; }
        }), guestId, operation.id);
      });
      await guestLocked.promise;
      const duplicate = db.transaction(async tx => {
        await tx.execute(sql`SET LOCAL lock_timeout='3s'`);
        await usage.transferGuestUsage(tx, guestId, accountId);
      });
      const finished = Promise.allSettled([publication, duplicate]);
      // The duplicate must finish while the original guest lock remains held.
      try { await duplicate; }
      finally { allowPublication.resolve(); await finished; }
      const [published, repeated] = await finished;
      assert.equal(published.status, 'fulfilled');
      assert.equal((published as PromiseFulfilledResult<string>).value, accountId);
      assert.equal(repeated.status, 'fulfilled');
      await db.transaction(tx => usage.releaseUsage(tx, operation.id));
    });
  } finally {
    await db.delete(users).where(inArray(users.id, fixtures));
    await pool.end();
  }
});
