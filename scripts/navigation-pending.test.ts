import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hrefMatchesLocation,
  isModifiedNavigationClick,
  navigationWaitState,
  splitHref,
} from '../src/lib/navigation-pending';

test('splitHref separates path and query', () => {
  assert.deepEqual(splitHref('/dashboard/profile?tab=account'), {
    pathname: '/dashboard/profile',
    search: 'tab=account',
  });
});

test('hrefMatchesLocation keeps confirmed route distinct from a pending tab', () => {
  assert.equal(hrefMatchesLocation('/dashboard', '/dashboard', ''), true);
  assert.equal(hrefMatchesLocation('/dashboard', '/dashboard/applications', ''), false);
  assert.equal(hrefMatchesLocation('/dashboard/profile?tab=account', '/dashboard/profile', 'tab=profile'), false);
  assert.equal(hrefMatchesLocation('/dashboard/profile?tab=account', '/dashboard/profile', 'tab=account'), true);
});

test('modified clicks do not start pending navigation', () => {
  assert.equal(isModifiedNavigationClick({ metaKey: true }), true);
  assert.equal(isModifiedNavigationClick({ ctrlKey: true }), true);
  assert.equal(isModifiedNavigationClick({ button: 1 }), true);
  assert.equal(isModifiedNavigationClick({ button: 0 }), false);
});

test('wait thresholds stay at 3s and 15s', () => {
  assert.deepEqual(navigationWaitState(0), { announceSlow: false, offerRecovery: false });
  assert.deepEqual(navigationWaitState(2_999), { announceSlow: false, offerRecovery: false });
  assert.deepEqual(navigationWaitState(3_000), { announceSlow: true, offerRecovery: false });
  assert.deepEqual(navigationWaitState(15_000), { announceSlow: true, offerRecovery: true });
});
