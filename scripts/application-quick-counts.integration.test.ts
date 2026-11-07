import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dateFilterRange } from '@/lib/application-filter-bounds';
const target = process.env.CRM_TEST_DATABASE_URL;

test('application funnel counts all active rows with private SQL totals and independent quick presets', { skip: !target }, async () => {
  const url = new URL(target!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = target;
  const { db, pool } = await import('@/db');
  const { users, jobOffers } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { listApplicationQuickCounts, loadApplicationsWorkspace } = await import('@/lib/application-list-query');
  const ids = [randomUUID(), randomUUID()], now = new Date(), today = dateFilterRange({ date: 'today' }, now).start!;
  const current = new Date(today.valueOf() + 3_600_000), yesterday = new Date(today.valueOf() - 3_600_000);
  try {
    await db.insert(users).values(ids.map(id => ({ id, email: `funnel-${id}@example.test` })));
    const statuses = [...Array<string>(27).fill('interested'), 'applied', 'applied', 'interview', 'archived:interested'];
    await db.insert(jobOffers).values(statuses.map((status, index) => ({ userId: ids[0], title: 'Synthetic funnel', company: 'Synthetic company', status, createdAt: index === 0 ? yesterday : current, isFavorite: index === 27, rawReport: 'PRIVATE_HEAVY_REPORT' })));
    await db.insert(jobOffers).values({ userId: ids[1], title: 'Synthetic funnel', company: 'Other owner', status: 'applied', createdAt: current });
    const query = { userId: ids[0], filters: { status: 'applied', date: 'today' as const }, now };
    assert.deepEqual(await listApplicationQuickCounts(query), { all: 30, today: 29, interested: 27, applied: 2, interview: 1, offer: 0, rejected: 0 });
    const page = await loadApplicationsWorkspace({ ...query, filters: { excludedStatuses: ['archived'] }, sort: { key: 'updatedAt', direction: 'desc' }, pageSize: 25 });
    assert.equal(page.items.length, 25); assert.equal(page.quickCounts.all, 30);
    assert.ok(!JSON.stringify(page).includes('PRIVATE_HEAVY_REPORT'));
    assert.equal((await listApplicationQuickCounts({ ...query, filters: { favoritesOnly: true } })).applied, 1);
    assert.equal((await listApplicationQuickCounts({ ...query, filters: { search: 'no match' } })).all, 0);
    await db.delete(jobOffers).where(eq(jobOffers.userId, ids[0]));
    assert.equal((await listApplicationQuickCounts(query)).all, 0);
  } finally { await db.delete(users).where(inArray(users.id, ids)); await pool.end(); }
});
