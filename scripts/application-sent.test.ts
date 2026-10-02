import test from 'node:test';
import assert from 'node:assert/strict';
import { decideApplicationSent, shouldAskIfSent } from '@/lib/application-sent';
import { madridYmd } from '@/lib/madrid-time';

test('yes sets applied and a follow-up five Madrid days later; no stays interested', () => {
  const now = new Date('2026-03-10T22:30:00.000Z');
  const yes = decideApplicationSent('yes', now);
  assert.equal(yes.status, 'applied');
  if (yes.status === 'applied') assert.equal(madridYmd(yes.nextFollowupDate), '2026-03-15');
  const no = decideApplicationSent('no', now);
  assert.deepEqual(no, { status: 'interested', nextFollowupDate: null });
});

test('the sent question is only for an interested candidacy that has not been answered', () => {
  assert.equal(shouldAskIfSent({ status: 'interested', mark: null }), true);
  assert.equal(shouldAskIfSent({ status: 'interested', mark: 'pending' }), true);
  assert.equal(shouldAskIfSent({ status: 'interested', mark: 'done' }), false);
  assert.equal(shouldAskIfSent({ status: 'applied', mark: null }), false);
});
