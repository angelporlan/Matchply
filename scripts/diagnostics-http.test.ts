import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.DIAGNOSTICS_TEST_DATABASE_URL, baseUrl = process.env.DIAGNOSTICS_TEST_APP_URL;
test('diagnostics accepts bounded safe reports and only administrators can read the error index', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!, baseUrl!].every(url => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db');
  const { users, operationalErrors } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { default: bcrypt } = await import('bcryptjs');
  const ids = [randomUUID(), randomUUID()], requestId = randomUUID(), password = randomUUID();
  function client() {
    const cookies = new Map<string, string>();
    return async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers); headers.set('Cookie', Array.from(cookies).map(([key, value]) => `${key}=${value}`).join('; '));
      const response = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: 'manual' });
      for (const cookie of response.headers.getSetCookie()) { const [key, ...value] = cookie.split(';')[0].split('='); cookies.set(key, value.join('=')); }
      return response;
    };
  }
  const options = (body: unknown): RequestInit => ({ method: 'POST', headers: { Origin: new URL(baseUrl!).origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const anonymous = client();
    const report = { requestId, code: 'NETWORK_ERROR', step: 'optimization', route: '/editor/private-candidate?token=secret' };
    assert.equal((await anonymous('/api/diagnostics/errors', { ...options(report), headers: { Origin: 'https://other.example.org', 'Content-Type': 'application/json' } })).status, 403);
    assert.equal((await anonymous('/api/diagnostics/errors', options({ ...report, raw: 'SQL private' }))).status, 400);
    assert.equal((await anonymous('/api/diagnostics/errors', options({ ...report, code: 'SQL private' }))).status, 400);
    assert.equal((await anonymous('/api/diagnostics/errors', options({ ...report, digest: 'x'.repeat(3000) }))).status, 413);
    const accepted = await anonymous('/api/diagnostics/errors', options(report));
    assert.equal(accepted.status, 202); assert.equal((await accepted.json()).requestId, requestId);
    let records: Array<typeof operationalErrors.$inferSelect> = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      records = await db.select().from(operationalErrors).where(eq(operationalErrors.requestId, requestId));
      if (records.length) break; await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(records[0]?.source, 'browser'); assert.equal(records[0]?.code, 'NETWORK_ERROR'); assert.equal(records[0]?.route, '/editor/:cvId');
    assert.doesNotMatch(JSON.stringify(records), /private-candidate|token|secret/);
    await db.insert(users).values(ids.map((id, index) => ({ id, email: `diagnostics-${id}@example.test`, passwordHash: bcrypt.hashSync(password, 4), role: index === 0 ? 'admin' : 'user' })));
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      const request = client(), csrf = await (await request('/api/auth/csrf')).json();
      await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: `diagnostics-${id}@example.test`, password, callbackUrl: `${baseUrl}/dashboard` }) });
      assert.equal((await (await request('/api/auth/session')).json()).user.id, id);
      const response = await request(`/admin/errors?requestId=${requestId}`);
      const body = await response.text();
      if (index === 0) { assert.equal(response.status, 200); assert.match(body, new RegExp(requestId)); assert.match(body, /NETWORK_ERROR/); }
      else { assert.doesNotMatch(body, /browser_optimization_failed/); assert.doesNotMatch(body, /Errores operativos/); }
    }
    assert.doesNotMatch(await (await anonymous(`/admin/errors?requestId=${requestId}`)).text(), /browser_optimization_failed/);
  } finally {
    await db.delete(operationalErrors).where(eq(operationalErrors.requestId, requestId));
    await db.delete(users).where(inArray(users.id, ids)); await pool.end();
  }
});
