import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const targetUrl = process.env.ADMIN_TABLE_TEST_DATABASE_URL;
test('admin tables filter and sort the full database before paginating', { skip: !targetUrl }, async t => {
  const target = new URL(targetUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]', 'db'].includes(target.hostname));
  assert.ok(target.pathname.endsWith('_test'));
  process.env.DATABASE_URL = targetUrl;
  const { db, pool } = await import('@/db');
  const { users, auditLogs } = await import('@/db/schema');
  const { inArray } = await import('drizzle-orm');
  const { listAdminUsers } = await import('@/lib/admin/users');
  const { listAdminAuditLogs, parseAuditQuery } = await import('@/lib/admin/audit-query');
  const now = new Date('2026-10-04T10:00:00Z');
  const ids = Array.from({ length: 31 }, () => randomUUID());
  const logs = Array.from({ length: 33 }, () => randomUUID());
  const query = (column: string, operator: string, value = '', extra = {}) => ({ columnFilters: JSON.stringify([{ column, operator, value, ...extra }]) });
  try {
    await db.insert(users).values(ids.map((id, i) => ({
      id, name: i === 30 ? 'Literal %_ match' : `Person ${String(i).padStart(2, '0')}`,
      email: `admin-tables-${id}@example.test`, isGuest: i === 29,
      role: i === 28 ? 'admin' : 'user', accountStatus: i === 27 ? 'suspended' : 'active',
      subscriptionStatus: i === 26 ? 'active' : i === 25 ? 'trialing' : 'none',
      proGrantedUntil: i === 24 ? new Date('2026-10-20T12:00:00Z') : null,
      lastSeenAt: i === 30 ? new Date('2026-10-04T12:00:00Z') : null,
      createdAt: new Date(`2026-09-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`),
    })));
    await db.insert(auditLogs).values(logs.map((id, i) => ({
      id, action: i === 32 ? 'system_repair' : 'crm_favorite_set', category: i === 32 ? 'admin' : 'ordinary',
      userId: i === 32 ? null : ids[0], actorUserId: i === 32 ? null : ids[0], affectedUserId: i === 32 ? null : ids[30],
      userEmail: null, details: 'HEAVY_AUDIT_DETAILS', createdAt: new Date(now.valueOf() + i * 1_000),
    })));

    await t.test('user filters work beyond the first page, with plan and null activity handling', async () => {
      assert.equal((await listAdminUsers({}, now)).total, 30);
      const named = await listAdminUsers(query('name', 'contains', 'Person 28'), now);
      assert.equal(named.total, 1); assert.equal(named.rows[0].id, ids[28]);
      assert.equal((await listAdminUsers(query('name', 'contains', '%_'), now)).rows[0].id, ids[30]);
      assert.equal((await listAdminUsers(query('lastSeenAt', 'isNotEmpty'), now)).total, 1);
      assert.equal((await listAdminUsers(query('plan', 'in', '', { values: ['granted'] }), now)).rows[0].id, ids[24]);
      assert.equal((await listAdminUsers({ plan: 'pro' }, now)).total, 3);
      const sorted = await listAdminUsers({ sort: 'name', dir: 'asc', pageSize: '10', page: '999' }, now);
      assert.equal(sorted.query.page, 3); assert.equal(sorted.rows.length, 10);
      const state = await listAdminUsers(query('status', 'in', '', { values: ['suspended'] }), now);
      assert.equal(state.rows[0].id, ids[27]);
    });

    await t.test('audit searches resolve actor and affected identities, and preserve system events', async () => {
      const actor = await listAdminAuditLogs(query('actorUserId', 'equals', 'Person 00'), now);
      assert.equal(actor.total, 32); assert.equal(actor.rows.length, 25);
      assert.equal(actor.rows[0].actorName, 'Person 00');
      const affected = await listAdminAuditLogs(query('affectedUserId', 'contains', '%_'), now);
      assert.equal(affected.total, 32); assert.equal(affected.rows[0].affectedName, 'Literal %_ match');
      assert.equal((await listAdminAuditLogs({ q: 'Literal %_' }, now)).total, 32);
      const systems = await listAdminAuditLogs(query('actorUserId', 'isEmpty'), now);
      assert.equal(systems.total, 1); assert.equal(systems.rows[0].action, 'system_repair');
      assert.ok(!JSON.stringify(actor.rows).includes('HEAVY_AUDIT_DETAILS'));
      const excluded = await listAdminAuditLogs(query('actorUserId', 'notEquals', 'Person 00'), now);
      assert.equal(excluded.total, 1);
      const older = await listAdminAuditLogs({ sort: 'createdAt', dir: 'asc', pageSize: '10' }, now);
      assert.equal(older.rows[0].id, logs[0]);
      assert.equal(parseAuditQuery({ sort: 'details', page: 'Infinity' }).sort, 'createdAt');
    });
  } finally {
    await db.delete(auditLogs).where(inArray(auditLogs.id, logs));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
