import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UMAMI_CONVERSION_EVENTS,
  isUmamiDoNotTrack,
  normalizeUmamiPath,
  normalizeUmamiTitle,
  sanitizeUmamiReferrer,
  shouldTrackUmamiPath,
  stripSensitiveSearch,
  umamiPagePayload,
} from '@/lib/umami';

test('the central DNT guard accepts the same disabled values as the pinned Umami tracker', () => {
  for (const value of [1, '1', 'yes']) assert.equal(isUmamiDoNotTrack(value), true);
  for (const value of [0, '0', 'no', null, undefined, false]) assert.equal(isUmamiDoNotTrack(value), false);
});

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
  assert.equal(payload.title, 'Matchply | Editor');
  assert.doesNotMatch(JSON.stringify(payload), /token|secret|@/);
  assert.ok(UMAMI_CONVERSION_EVENTS.includes('offer_pasted'));
  assert.ok(UMAMI_CONVERSION_EVENTS.includes('diff_viewed'));
  assert.ok(UMAMI_CONVERSION_EVENTS.includes('signup_completed'));
  assert.ok(UMAMI_CONVERSION_EVENTS.includes('cv_downloaded'));
});
