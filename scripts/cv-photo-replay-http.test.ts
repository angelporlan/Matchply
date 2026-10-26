import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const database = process.env.PHOTO_REPLAY_TEST_DATABASE_URL, baseUrl = process.env.PHOTO_REPLAY_TEST_APP_URL;
test('guest and registered CV photo writes are repeatable and concurrent without a conflict', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!, baseUrl!].every(value => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db');
  const { users, cvs, cvPhotos } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { default: bcrypt } = await import('bcryptjs');
  const ids: string[] = [], password = randomUUID();
  const avatar = { mime: 'image/jpeg', data: readFileSync('scripts/fixtures/person-avatar.jpg').toString('base64') };
  try {
    for (const guest of [true, false]) {
      const cookies = new Map<string, string>();
      const request = async (path: string, method = 'GET', body?: object) => {
        const headers = new Headers({ Origin: baseUrl!, 'Content-Type': 'application/json', Cookie: Array.from(cookies).map(([key, value]) => `${key}=${value}`).join('; ') });
        const response = await fetch(new URL(path, baseUrl), { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
        for (const cookie of response.headers.getSetCookie()) { const [key, ...value] = cookie.split(';')[0].split('='); cookies.set(key, value.join('=')); }
        return response;
      };
      let userId: string;
      if (guest) {
        assert.equal((await request('/api/guest?redirect=/try')).status, 307);
        const token = cookies.get('matchply_guest'); assert.ok(token);
        const [user] = await db.select({ id: users.id }).from(users).where(eq(users.guestTokenHash, createHash('sha256').update(decodeURIComponent(token)).digest('hex')));
        assert.ok(user); userId = user.id; ids.push(userId);
        const account = await request('/api/account/avatar', 'POST', { avatar });
        assert.equal(account.status, 401); assert.equal((await account.json()).code, 'ACCOUNT_REQUIRED');
      } else {
        userId = randomUUID(); ids.push(userId);
        const email = `photo-replay-${userId}@example.test`;
        await db.insert(users).values({ id: userId, email, passwordHash: bcrypt.hashSync(password, 4) });
        const csrf = await (await request('/api/auth/csrf')).json();
        const response = await fetch(new URL('/api/auth/callback/credentials', baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: Array.from(cookies).map(([key, value]) => `${key}=${value}`).join('; ') },
          body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${baseUrl}/dashboard` }), redirect: 'manual' });
        for (const cookie of response.headers.getSetCookie()) { const [key, ...value] = cookie.split(';')[0].split('='); cookies.set(key, value.join('=')); }
      }
      const content = '# Synthetic photo owner\n\nOriginal CV is preserved.';
      const [cv] = await db.insert(cvs).values({ userId, title: 'Replay fixture', content, isBase: true }).returning({ id: cvs.id });
      const path = `/api/cv/${cv.id}/photo`;
      const uploaded = await Promise.all([request(path, 'POST', { avatar }), request(path, 'POST', { avatar })]);
      assert.deepEqual(uploaded.map(response => response.status), [200, 200]);
      const states = await Promise.all(uploaded.map(response => response.json()));
      assert.deepEqual(states[0], states[1]); assert.equal(states[0].source, 'custom');
      assert.equal((await db.select().from(cvPhotos).where(eq(cvPhotos.cvId, cv.id))).length, 1);
      const toggled = await Promise.all([request(path, 'PATCH', { enabled: true }), request(path, 'PATCH', { enabled: true })]);
      assert.deepEqual(toggled.map(response => response.status), [200, 200]);
      assert.equal((await request(states[0].url)).status, 200);
      const reset = await Promise.all([request(path, 'DELETE'), request(path, 'DELETE')]);
      assert.deepEqual(reset.map(response => response.status), [200, 200]);
      assert.deepEqual(await reset[0].json(), await reset[1].json());
      assert.equal((await db.select({ content: cvs.content }).from(cvs).where(eq(cvs.id, cv.id)))[0].content, content);
    }
  } finally { if (ids.length) await db.delete(users).where(inArray(users.id, ids)); await pool.end(); }
});
