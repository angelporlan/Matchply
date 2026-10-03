import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERWRITE_UPGRADE_HREF, decideFreeOverwrite } from '@/lib/free-overwrite-guard';

test('a free user with one CV is blocked from silent reuse until replace is confirmed', () => {
  assert.deepEqual(
    decideFreeOverwrite({ isGuest: false, canCreate: false, replacesBase: false, confirmed: false }),
    { action: 'confirm', replacesBase: false },
  );
  assert.deepEqual(
    decideFreeOverwrite({ isGuest: false, canCreate: false, replacesBase: false, confirmed: true }),
    { action: 'reuse' },
  );
});

test('a base CV is identified when the free plan would replace it', () => {
  const decision = decideFreeOverwrite({
    isGuest: false,
    canCreate: false,
    replacesBase: true,
    confirmed: false,
  });
  assert.equal(decision.action, 'confirm');
  if (decision.action === 'confirm') assert.equal(decision.replacesBase, true);
});

test('guests and users who can still create a CV are not asked to replace', () => {
  assert.equal(
    decideFreeOverwrite({ isGuest: true, canCreate: false, replacesBase: true, confirmed: false }).action,
    'create',
  );
  assert.equal(
    decideFreeOverwrite({ isGuest: false, canCreate: true, replacesBase: false, confirmed: false }).action,
    'create',
  );
});

test('the PRO action from the guard opens checkout with the overwrite source', () => {
  assert.equal(OVERWRITE_UPGRADE_HREF, '/api/stripe/checkout?source=overwrite-guard');
});
