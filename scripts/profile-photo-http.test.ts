import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const testUrl = process.env.PROFILE_PHOTO_TEST_DATABASE_URL;
const baseUrl = process.env.PROFILE_PHOTO_TEST_APP_URL;
test('profile photo API requires the account, enforces upload limits and refreshes the persisted session photo', { skip: !testUrl || !baseUrl }, async () => {
  const local = (url: string) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  assert.ok(local(testUrl!) && new URL(testUrl!).pathname.includes('test') && local(baseUrl!));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { default: bcrypt } = await import('bcryptjs');
  const ids = [randomUUID(), randomUUID()];
  const password = randomUUID();
  const bytes = readFileSync('scripts/fixtures/person-avatar.jpg');
  const avatar = { mime: 'image/jpeg', data: bytes.toString('base64') };

  function client() {
    const cookies = new Map<string, string>();
    return async (path: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      headers.set('Cookie', Array.from(cookies).map(([key, value]) => `${key}=${value}`).join('; '));
      const response = await fetch(new URL(path, baseUrl), { ...options, headers, redirect: 'manual' });
      for (const cookie of response.headers.getSetCookie()) {
        const [key, ...value] = cookie.split(';')[0].split('=');
        cookies.set(key, value.join('='));
      }
      return response;
    };
  }
  const uploadOptions = (value: unknown = avatar): RequestInit => ({ method: 'POST', headers: { Origin: baseUrl!, 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: value }) });
  async function login(request: ReturnType<typeof client>, id: string) {
    const csrf = await (await request('/api/auth/csrf')).json();
    const result = await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: `http-photo-${id}@example.test`, password, callbackUrl: `${baseUrl}/dashboard` }) });
    assert.ok([200, 302].includes(result.status));
    const session = await (await request('/api/auth/session')).json();
    assert.equal(session.user.id, id);
    return session;
  }
  try {
    await db.insert(users).values(ids.map(id => ({ id, name: 'Photo HTTP test', email: `http-photo-${id}@example.test`, passwordHash: bcrypt.hashSync(password, 4) })));
    const anonymous = client();
    assert.equal((await anonymous('/api/account/avatar')).status, 403);
    assert.equal((await anonymous('/api/account/avatar', uploadOptions())).status, 401);
    const owner = client(), other = client();
    await login(owner, ids[0]); await login(other, ids[1]);
    assert.equal((await owner('/api/account/avatar', { ...uploadOptions(), headers: { Origin: 'https://other.example.test', 'Content-Type': 'application/json' } })).status, 403);
    const saved = await owner('/api/account/avatar', uploadOptions());
    assert.equal(saved.status, 200);
    const { image } = await saved.json();
    const downloaded = await owner(image);
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('Content-Type'), 'image/jpeg');
    assert.equal(downloaded.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    assert.equal((await other(image)).status, 404);
    assert.equal((await anonymous(image)).status, 403);
    assert.equal((await owner('/api/account/avatar?v=old')).status, 404);
    assert.equal((await (await owner('/api/auth/session')).json()).user.image, image);
    assert.equal((await login(client(), ids[0])).user.image, image);
    assert.equal((await owner('/api/account/avatar', uploadOptions({ mime: 'image/svg+xml', data: '<svg/>' }))).status, 400);
    assert.equal((await owner('/api/account/avatar', { ...uploadOptions(), body: 'x'.repeat(360_000) })).status, 413);
    assert.equal((await (await owner('/api/auth/session')).json()).user.image, image);
    // A client session update cannot forge the user's picture.
    const csrf = await (await owner('/api/auth/csrf')).json();
    const updatedSession = await owner('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrfToken: csrf.csrfToken, data: { user: { image: 'https://forged.example.test/image' } } }) });
    assert.equal(updatedSession.status, 200);
    assert.equal((await updatedSession.json()).user.image, image);
    await db.update(users).set({ accountStatus: 'suspended' }).where(eq(users.id, ids[1]));
    assert.equal((await other('/api/account/avatar', uploadOptions())).status, 403);
    await db.update(users).set({ accountStatus: 'active', isGuest: true }).where(eq(users.id, ids[1]));
    assert.equal((await other('/api/account/avatar', uploadOptions())).status, 401);
  } finally {
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
