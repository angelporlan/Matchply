import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUmamiPath,
  normalizeUmamiTitle,
  sanitizeUmamiReferrer,
  shouldTrackUmamiPath,
  stripSensitiveSearch,
  umamiPagePayload,
} from '@/lib/umami';

test('Umami payloads drop ids, emails and admin paths', () => {
  assert.equal(shouldTrackUmamiPath('/admin/users'), false);
  assert.equal(shouldTrackUmamiPath('/dashboard'), true);
  assert.equal(normalizeUmamiPath('/editor/abc123'), '/editor/:cvId');
  assert.equal(
    normalizeUmamiPath('/dashboard/applications/offer/11111111-2222-4333-a444-555555555555'),
    '/dashboard/applications/offer/:id',
  );
  assert.equal(normalizeUmamiTitle('CV de Ana 11111111-2222-4333-a444-555555555555'), 'CV de Ana');
  assert.equal(sanitizeUmamiReferrer('https://linkedin.com/in/someone?email=a@b.c'), 'https://linkedin.com');
  assert.equal(stripSensitiveSearch('?email=a@b.c&page=2'), '?page=2');
  const payload = umamiPagePayload({
    pathname: '/editor/cv-title',
    title: 'Editor — Mi CV',
    search: '?token=secret',
    referrer: 'https://google.com/search?q=ana',
  });
  assert.equal(payload.url, '/editor/:cvId');
  assert.equal(payload.referrer, 'https://google.com');
  assert.doesNotMatch(JSON.stringify(payload), /token|secret|@/);
});
