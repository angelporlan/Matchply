import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const database = process.env.GUEST_REDIRECT_TEST_DATABASE_URL, baseUrl = process.env.GUEST_REDIRECT_TEST_APP_URL;
test('guest entry never redirects to an external URL', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!, baseUrl!].every(value => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db'); const { users } = await import('@/db/schema'); const { eq } = await import('drizzle-orm');
  const hashes: string[] = [];
  try {
    for (const destination of ['https://example.test/steal', '//example.test/path', '/try']) {
      const url = new URL('/api/guest', baseUrl); url.searchParams.set('redirect', destination);
      const response = await fetch(url, { redirect: 'manual', headers: { 'X-Real-IP': '198.18.203.27' } });
      assert.equal(response.status, 307);
      const location = new URL(response.headers.get('location')!);
      assert.equal(location.origin, new URL(baseUrl!).origin); assert.equal(location.pathname, '/try');
      const cookie = response.headers.getSetCookie().find(value => value.startsWith('matchply_guest=')); assert.ok(cookie);
      hashes.push(createHash('sha256').update(cookie.split(';')[0].slice('matchply_guest='.length)).digest('hex'));
    }
  } finally { for (const hash of hashes) await db.delete(users).where(eq(users.guestTokenHash, hash)); await pool.end(); }
});
