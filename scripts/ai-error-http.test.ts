import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.AI_ERROR_TEST_DATABASE_URL, baseUrl = process.env.AI_ERROR_TEST_APP_URL;
test('job HTTP responses hide legacy provider details for authenticated and guest owners', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!, baseUrl!].every(value => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db');
  const { users, aiJobs } = await import('@/db/schema');
  const { inArray } = await import('drizzle-orm');
  const { default: bcrypt } = await import('bcryptjs');
  const ids: string[] = [], password = randomUUID();
  try {
    for (const guest of [false, true]) {
      const cookies = new Map<string, string>();
      const request = async (path: string, init: RequestInit = {}) => {
        const headers = new Headers(init.headers);
        headers.set('Cookie', Array.from(cookies).map(([key, value]) => `${key}=${value}`).join('; '));
        const response = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: 'manual' });
        for (const cookie of response.headers.getSetCookie()) {
          const [key, ...value] = cookie.split(';')[0].split('='); cookies.set(key, value.join('='));
        }
        return response;
      };
      let userId: string;
      if (guest) {
        const response = await request('/api/guest?redirect=/try');
        assert.equal(response.status, 307);
        // The response identifies the synthetic session so teardown stays scoped.
        const cookie = [...cookies].find(([key]) => key.includes('guest'));
        assert.ok(cookie);
        const { createHash } = await import('node:crypto');
        const { eq } = await import('drizzle-orm');
        const [session] = await db.select({ userId: users.id }).from(users)
          .where(eq(users.guestTokenHash, createHash('sha256').update(decodeURIComponent(cookie[1])).digest('hex')));
        assert.ok(session); userId = session.userId; ids.push(userId);
      } else {
        userId = randomUUID(); ids.push(userId);
        const email = `ai-error-${userId}@example.test`;
        await db.insert(users).values({ id: userId, email, passwordHash: bcrypt.hashSync(password, 4) });
        const csrf = await (await request('/api/auth/csrf')).json();
        await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${baseUrl}/dashboard` }) });
      }
      const [job] = await db.insert(aiJobs).values({ userId, kind: 'optimize_cv_variants', status: 'failed',
        payload: {}, lastError: 'Incorrect OPENAI_API_KEY sk-private; set .env on VPS',
        result: { variants: [{ modeId: 'optimize_adapted', status: 'error', error: 'private upstream project' }] },
      }).returning({ id: aiJobs.id });
      const response = await request(`/api/ai/jobs/${job.id}`);
      assert.equal(response.status, 200);
      const raw = await response.text();
      assert.doesNotMatch(raw, /OPENAI|API_KEY|sk-private|\.env|VPS|upstream project/);
      assert.match(raw, /Inténtalo de nuevo/);
    }
  } finally {
    if (ids.length) await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
