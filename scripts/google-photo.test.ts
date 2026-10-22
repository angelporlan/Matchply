import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchGooglePhoto, isGooglePhotoUrl } from '@/lib/avatar/google-photo';

test('account pictures only use the explicit Google HTTPS picture hosts', () => {
  assert.equal(isGooglePhotoUrl('https://lh3.googleusercontent.com/photo'), true);
  for (const url of ['http://lh3.googleusercontent.com/p', 'https://lh3.googleusercontent.com.evil.test/p', 'https://127.0.0.1/p', 'https://lh3.googleusercontent.com:444/p', 'https://user:pass@lh3.googleusercontent.com/p', '/api/account/avatar']) assert.equal(isGooglePhotoUrl(url), false);
});
test('remote photo downloads enforce host, type and bounded stream bytes without redirects or cookies', async t => {
  const jpeg = readFileSync('scripts/fixtures/person-avatar.jpg');
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  });
  assert.equal(await fetchGooglePhoto('http://localhost/photo'), null);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal((await fetchGooglePhoto('https://lh3.googleusercontent.com/p'))?.bytes, jpeg.toString('base64'));
  fetchMock.mock.mockImplementation(async () => new Response('not an image', { headers: { 'Content-Type': 'text/html' } }));
  assert.equal(await fetchGooglePhoto('https://lh3.googleusercontent.com/p'), null);
  fetchMock.mock.mockImplementation(async () => new Response(new Uint8Array(256 * 1024 + 1), { headers: { 'Content-Type': 'image/jpeg' } }));
  assert.equal(await fetchGooglePhoto('https://lh3.googleusercontent.com/p'), null);
});
