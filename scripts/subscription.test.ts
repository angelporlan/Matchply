import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessFeature,
  canCreateCv,
  canUseCvTemplate,
  getAccessTier,
  getAllowedCvTemplate,
  HARVARD_TEMPLATE,
  canGuestDownloadPdf,
  hasProAccess,
  isProGrantActive,
  getEffectivePlanSource,
  effectiveSubscriptionStatus,
} from '@/lib/subscription';

test('guests and free users stay off Pro features', () => {
  assert.equal(getAccessTier('none', { isGuest: true }), 'guest');
  assert.equal(getAccessTier('none'), 'free');
  assert.equal(getAccessTier('active'), 'pro');
  assert.equal(getAccessTier('trialing'), 'pro');

  assert.equal(canAccessFeature('none', 'applications'), false);
  assert.equal(canAccessFeature('none', 'applications', { isGuest: true }), false);
  assert.equal(canAccessFeature('active', 'applications'), true);
  assert.equal(canAccessFeature('active', 'advancedAi'), true);
});

test('CV caps and Harvard fallback match the paid plan', () => {
  assert.equal(canCreateCv('none', 0), true);
  assert.equal(canCreateCv('none', 1), false);
  assert.equal(canCreateCv('none', 2, { isGuest: true }), true);
  assert.equal(canCreateCv('none', 3, { isGuest: true }), false);
  assert.equal(canCreateCv('active', 40), true);
  assert.equal(canGuestDownloadPdf(0), true);
  assert.equal(canGuestDownloadPdf(1), false);
  assert.equal(canGuestDownloadPdf(2), false);

  assert.equal(canUseCvTemplate('none', 'harvard'), true);
  assert.equal(canUseCvTemplate('none', 'swiss'), false);
  assert.equal(getAllowedCvTemplate('none', 'swiss'), HARVARD_TEMPLATE);
  assert.equal(getAllowedCvTemplate('active', 'modern'), HARVARD_TEMPLATE);
  assert.equal(getAllowedCvTemplate('active', 'harvard'), 'harvard');
});

test('temporary Pro grants coexist with Stripe and expire', () => {
  const now = new Date('2026-09-20T10:00:00.000Z');
  const future = new Date('2026-10-20T21:59:59.000Z');
  const past = new Date('2026-09-01T00:00:00.000Z');
  assert.equal(isProGrantActive(future, now), true);
  assert.equal(isProGrantActive(past, now), false);
  assert.equal(hasProAccess({ subscriptionStatus: 'none', proGrantedUntil: future, now }), true);
  assert.equal(hasProAccess({ subscriptionStatus: 'canceled', proGrantedUntil: future, now }), true);
  assert.equal(hasProAccess({ subscriptionStatus: 'active', proGrantedUntil: past, now }), true);
  assert.equal(hasProAccess({ subscriptionStatus: 'trialing', now }), true);
  assert.equal(hasProAccess({ subscriptionStatus: 'none', isGuest: true, proGrantedUntil: future, now }), false);
  assert.equal(getEffectivePlanSource({ subscriptionStatus: 'trialing', proGrantedUntil: future, now }), 'trialing');
  assert.equal(getEffectivePlanSource({ subscriptionStatus: 'none', proGrantedUntil: future, now }), 'granted');
  assert.equal(effectiveSubscriptionStatus({ subscriptionStatus: 'none', proGrantedUntil: future, now }), 'active');
  assert.equal(canAccessFeature('none', 'applications', { proGrantedUntil: future, now }), true);
  assert.equal(canCreateCv('none', 40, { proGrantedUntil: future, now }), true);
});
