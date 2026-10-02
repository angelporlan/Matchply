import test from 'node:test';
import assert from 'node:assert/strict';
import { coldRegisterDestination, resolveTryGate, trialCvMarkdown } from '@/lib/try-entry';

test('a visitor without a session is sent to create a guest and return to /try', () => {
  assert.deepEqual(
    resolveTryGate({ hasViewer: false, cvCount: 0, offerCount: 0 }),
    { kind: 'redirect', href: '/api/guest?redirect=/try' },
  );
});

test('a guest or account that already has a CV or candidacy goes to the dashboard', () => {
  assert.deepEqual(
    resolveTryGate({ hasViewer: true, cvCount: 1, offerCount: 0 }),
    { kind: 'redirect', href: '/dashboard' },
  );
  assert.deepEqual(
    resolveTryGate({ hasViewer: true, cvCount: 0, offerCount: 2 }),
    { kind: 'redirect', href: '/dashboard' },
  );
});

test('an empty guest or a new account stays on the adapt screen', () => {
  assert.deepEqual(
    resolveTryGate({ hasViewer: true, cvCount: 0, offerCount: 0 }),
    { kind: 'entry' },
  );
});

test('a cold register with no guest draft opens /try', () => {
  assert.equal(coldRegisterDestination({ hasSession: false, hasGuestCookie: false }), '/try');
  assert.equal(coldRegisterDestination({ hasSession: false, hasGuestCookie: true }), null);
  assert.equal(coldRegisterDestination({ hasSession: true, hasGuestCookie: false }), null);
});

test('plain pasted text becomes markdown and an existing heading is kept', () => {
  assert.equal(trialCvMarkdown('  Ana Ruiz\nBackend  '), '# CV\n\nAna Ruiz\nBackend');
  assert.equal(trialCvMarkdown('# Ana\n\nBackend'), '# Ana\n\nBackend');
  assert.equal(trialCvMarkdown('   '), '');
});
