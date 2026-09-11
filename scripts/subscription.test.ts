import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessFeature,
  canCreateCv,
  canUseCvTemplate,
  getAccessTier,
  getAllowedCvTemplate,
  HARVARD_TEMPLATE,
} from '@/lib/subscription';

test('guests and free users stay off Pro features', () => {
  assert.equal(getAccessTier('none', { isGuest: true }), 'guest');
  assert.equal(getAccessTier('none'), 'free');
  assert.equal(getAccessTier('active'), 'pro');
  assert.equal(getAccessTier('trialing'), 'pro');

  assert.equal(canAccessFeature('none', 'kanban'), false);
  assert.equal(canAccessFeature('none', 'kanban', { isGuest: true }), false);
  assert.equal(canAccessFeature('active', 'kanban'), true);
  assert.equal(canAccessFeature('active', 'advancedAi'), true);
});

test('CV caps and Harvard fallback match the paid plan', () => {
  assert.equal(canCreateCv('none', 0), true);
  assert.equal(canCreateCv('none', 1), false);
  assert.equal(canCreateCv('none', 2, { isGuest: true }), true);
  assert.equal(canCreateCv('none', 3, { isGuest: true }), false);
  assert.equal(canCreateCv('active', 40), true);

  assert.equal(canUseCvTemplate('none', 'swiss'), false);
  assert.equal(getAllowedCvTemplate('none', 'swiss'), HARVARD_TEMPLATE);
  assert.equal(getAllowedCvTemplate('active', 'swiss'), 'swiss');
});
