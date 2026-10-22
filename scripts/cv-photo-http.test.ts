import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const database = process.env.CV_PHOTO_TEST_DATABASE_URL, baseUrl = process.env.CV_PHOTO_TEST_APP_URL;
test('CV photo API enforces ownership, origin, upload bounds and PDF photo selection', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!, baseUrl!].every(value => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db');
  const { users, cvs } = await import('@/db/schema');
  const { inArray } = await import('drizzle-orm');
  const { default: bcrypt } = await import('bcryptjs');
  const { saveProfilePhoto } = await import('@/lib/avatar/profile');
  const ids = [randomUUID(), randomUUID()], password = randomUUID();
  const avatar = { mime: 'image/jpeg', data: readFileSync('scripts/fixtures/person-avatar.jpg').toString('base64') };
  function client() {
    const cookies = new Map<string, string>();
    return async (path: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers); headers.set('Cookie', Array.from(cookies).map(([key, value]) => `${key}=${value}`).join('; '));
      const response = await fetch(new URL(path, baseUrl), { ...options, headers, redirect: 'manual' });
      for (const cookie of response.headers.getSetCookie()) { const [key, ...value] = cookie.split(';')[0].split('='); cookies.set(key, value.join('=')); }
      return response;
    };
  }
  const options = (method: string, body?: object): RequestInit => ({ method, headers: { Origin: new URL(baseUrl!).origin, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  try {
    await db.insert(users).values(ids.map(id => ({ id, email: `cv-photo-http-${id}@example.test`, passwordHash: bcrypt.hashSync(password, 4), subscriptionStatus: 'active' })));
    const [cv, otherCv] = await db.insert(cvs).values(ids.map(userId => ({ userId, title: 'Photo HTTP fixture', content: '# Candidate\n\n**Email:** candidate@example.test' }))).returning();
    await saveProfilePhoto(ids[0], avatar);
    const owner = client(), anonymous = client();
    const csrf = await (await owner('/api/auth/csrf')).json();
    await owner('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: `cv-photo-http-${ids[0]}@example.test`, password, callbackUrl: `${baseUrl}/dashboard` }) });
    assert.equal((await (await owner('/api/auth/session')).json()).user.id, ids[0]);
    const path = `/api/cv/${cv.id}/photo`;
    assert.equal((await anonymous(path, options('POST', { avatar }))).status, 401);
    assert.equal((await owner(path)).status, 404);
    assert.equal((await owner(path, { ...options('PATCH', { enabled: true }), headers: { Origin: 'https://other.example.test', 'Content-Type': 'application/json' } })).status, 403);
    assert.equal((await owner(`/api/cv/${otherCv.id}/photo`, options('POST', { avatar }))).status, 404);
    assert.equal((await owner(path, options('PATCH', { enabled: true }))).status, 200);
    const image = await owner(path); assert.equal(image.status, 200); assert.equal(image.headers.get('Content-Type'), 'image/jpeg');
    assert.equal(image.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(avatar.data, 'base64'));
    const pdf = await owner(`/api/pdf?cvId=${cv.id}`); assert.equal(pdf.status, 200);
    assert.ok(Buffer.from(await pdf.arrayBuffer()).toString('latin1').includes('/Subtype /Image'));
    const preview = await owner('/api/pdf', options('POST', { content: cv.content, cvId: otherCv.id, showPhoto: true })); assert.equal(preview.status, 404);
    assert.equal((await owner(path, options('POST', { avatar: { mime: 'image/svg+xml', data: '<svg/>' } }))).status, 400);
    assert.equal((await owner(path, { ...options('POST'), body: 'x'.repeat(360_000) })).status, 413);
    const custom = await owner(path, options('POST', { avatar })); assert.equal(custom.status, 200); assert.equal((await custom.json()).source, 'custom');
    assert.equal((await owner(path, options('DELETE'))).status, 200);
    assert.equal((await (await owner(`${path}?metadata=1`)).json()).source, 'account');
    assert.equal((await owner(path, options('PATCH', { enabled: false }))).status, 200);
    const plain = await owner(`/api/pdf?cvId=${cv.id}`); assert.equal(plain.status, 200);
    assert.ok(!Buffer.from(await plain.arrayBuffer()).toString('latin1').includes('/Subtype /Image'));
  } finally { await db.delete(users).where(inArray(users.id, ids)); await pool.end(); }
});
