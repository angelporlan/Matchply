import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeSubscriptionPatch } from '@/lib/stripe-subscription-sync';

test('stripe subscription patch prefers metadata.userId and string customer ids', () => {
  const patch = stripeSubscriptionPatch({
    id: 'sub_123',
    status: 'active',
    customer: 'cus_abc',
    metadata: { userId: 'user-1' },
  });
  assert.equal(patch.userId, 'user-1');
  assert.equal(patch.customerId, 'cus_abc');
  assert.deepEqual(patch.values, {
    stripeCustomerId: 'cus_abc',
    stripeSubscriptionId: 'sub_123',
    subscriptionStatus: 'active',
  });
});

test('stripe subscription patch reads expanded customer objects', () => {
  const patch = stripeSubscriptionPatch({
    id: 'sub_123',
    status: 'canceled',
    customer: { id: 'cus_expanded' } as any,
    metadata: {},
  });
  assert.equal(patch.userId, null);
  assert.equal(patch.customerId, 'cus_expanded');
  assert.equal(patch.values.subscriptionStatus, 'canceled');
});
