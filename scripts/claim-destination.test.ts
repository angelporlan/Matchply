import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClaimRedirect } from '@/lib/claim-destination';
import { safeInternalPath } from '@/lib/auth-intent';

const CV_ID = '11111111-1111-1111-1111-111111111111';

test('claim with a draft and the default next opens the adapted CV editor', () => {
  assert.equal(
    resolveClaimRedirect({ claimed: true, cvId: CV_ID, nextPath: '/dashboard' }),
    `/editor/${CV_ID}`,
  );
});

test('claim with an explicit checkout next keeps checkout', () => {
  const next = '/api/stripe/checkout?source=landing-pricing';
  assert.equal(
    resolveClaimRedirect({ claimed: true, cvId: CV_ID, nextPath: next }),
    next,
  );
});

test('a claimed account with no CV opens the activation screen', () => {
  assert.equal(
    resolveClaimRedirect({ claimed: true, cvId: null, nextPath: '/dashboard' }),
    '/try',
  );
  assert.equal(
    resolveClaimRedirect({
      claimed: true,
      cvId: null,
      nextPath: '/api/stripe/checkout?source=landing-pricing',
    }),
    '/api/stripe/checkout?source=landing-pricing',
  );
});

test('claim without a cookie stays on the default next', () => {
  assert.equal(
    resolveClaimRedirect({ claimed: false, cvId: null, nextPath: safeInternalPath(null) }),
    '/dashboard',
  );
});

test('safeInternalPath still rejects external and protocol-relative targets', () => {
  assert.equal(safeInternalPath(null), '/dashboard');
  assert.equal(safeInternalPath(''), '/dashboard');
  assert.equal(safeInternalPath('https://evil.example/phish'), '/dashboard');
  assert.equal(safeInternalPath('//evil.example/phish'), '/dashboard');
  assert.equal(safeInternalPath('/editor/abc?saved=1'), '/editor/abc?saved=1');
  assert.equal(safeInternalPath('/api/stripe/checkout?source=overwrite-guard'), '/api/stripe/checkout?source=overwrite-guard');
});
