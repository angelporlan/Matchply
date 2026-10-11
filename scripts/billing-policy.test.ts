import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { hasPriorPaidOrTrialSubscription, isExpectedBillingPrice, isTrustedBillingOrigin, PRO_TRIAL_DAYS, readBillingInterval, stripeInvoiceSubscriptionId, stripeSubscriptionPeriodEnd, subscriptionHasConfirmedAccess } from '@/lib/billing-policy';
import { assignPaywallVariant } from '@/lib/monetization';
import { stripeSubscriptionPatch } from '@/lib/stripe-subscription-sync';
import { getStripePriceId, STRIPE_PRICE_ID_PRO } from '@/lib/stripe';

function price(interval: 'month' | 'year', amount: number) {
  return { active: true, currency: 'eur', unit_amount: amount, type: 'recurring', recurring: { interval, interval_count: 1, usage_type: 'licensed' } } as Stripe.Price;
}

test('offers require exact active EUR monthly/yearly recurring prices', () => {
  assert.equal(isExpectedBillingPrice(price('month', 1_000), 'monthly'), true);
  assert.equal(isExpectedBillingPrice(price('year', 9_600), 'annual'), true);
  assert.equal(isExpectedBillingPrice(price('year', 10_000), 'annual'), false);
  assert.equal(isExpectedBillingPrice({ ...price('month', 1_000), active: false }, 'monthly'), false);
  assert.equal(isExpectedBillingPrice({ ...price('month', 1_000), currency: 'usd' }, 'monthly'), false);
  assert.equal(isExpectedBillingPrice(price('month', 9_600), 'annual'), false);
  assert.equal(isExpectedBillingPrice({ ...price('month', 1_000), recurring: { ...price('month', 1_000).recurring!, interval_count: 2 } }, 'monthly'), false);
});

test('billing interval is an allowlist and the default is monthly', () => {
  assert.equal(readBillingInterval(undefined), 'monthly');
  assert.equal(readBillingInterval('annual'), 'annual');
  assert.equal(readBillingInterval('price_external'), null);
  assert.equal(readBillingInterval('year'), null);
  assert.equal(PRO_TRIAL_DAYS, 7);
});

test('the optional monthly placeholder preserves the legacy monthly Price alias', () => {
  const previous = process.env.STRIPE_TEST_PRICE_ID_PRO_MONTHLY;
  try {
    process.env.STRIPE_TEST_PRICE_ID_PRO_MONTHLY = 'price_...';
    assert.equal(getStripePriceId('monthly'), STRIPE_PRICE_ID_PRO);
    process.env.STRIPE_TEST_PRICE_ID_PRO_MONTHLY = 'price_newmonthly';
    assert.equal(getStripePriceId('monthly'), 'price_newmonthly');
  } finally {
    if (previous === undefined) delete process.env.STRIPE_TEST_PRICE_ID_PRO_MONTHLY;
    else process.env.STRIPE_TEST_PRICE_ID_PRO_MONTHLY = previous;
  }
});

test('billing mutations trust the configured public origin, including reverse proxies', () => {
  const previous = process.env.NEXTAUTH_URL;
  try {
    process.env.NEXTAUTH_URL = 'https://matchply.example/';
    assert.equal(isTrustedBillingOrigin('https://matchply.example'), true);
    assert.equal(isTrustedBillingOrigin('http://localhost:3000'), false);
    assert.equal(isTrustedBillingOrigin('https://attacker.example'), false);
    assert.equal(isTrustedBillingOrigin(null), false);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});

test('normalizes subscription ids in immutable old invoice events and the new API', () => {
  assert.equal(stripeInvoiceSubscriptionId({ subscription: 'sub_old' }), 'sub_old');
  assert.equal(stripeInvoiceSubscriptionId({ subscription: { id: 'sub_expanded' } }), 'sub_expanded');
  assert.equal(stripeInvoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } } }), 'sub_new');
  assert.equal(stripeInvoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: 'sub_new_expanded' } } } }), 'sub_new_expanded');
  assert.equal(stripeInvoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } }, subscription: 'sub_old' }), 'sub_new');
  assert.equal(stripeInvoiceSubscriptionId({}), null);
});

test('period end follows subscription items and supports old snapshots', () => {
  const items = { data: [{ current_period_end: 2_000 }, { current_period_end: 3_000 }] } as Stripe.ApiList<Stripe.SubscriptionItem>;
  assert.equal(stripeSubscriptionPeriodEnd({ items })?.getTime(), 2_000_000);
  assert.equal(stripeSubscriptionPeriodEnd({ items: { data: [] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>, current_period_end: 4_000 })?.getTime(), 4_000_000);
});

test('an abandoned incomplete checkout does not consume a trial; a prior trial or paid subscription does', () => {
  assert.equal(hasPriorPaidOrTrialSubscription({ status: 'incomplete_expired', trial_start: null }), false);
  assert.equal(hasPriorPaidOrTrialSubscription({ status: 'incomplete', trial_start: null }), false);
  assert.equal(hasPriorPaidOrTrialSubscription({ status: 'canceled', trial_start: 1_000 }), true);
  assert.equal(hasPriorPaidOrTrialSubscription({ status: 'active', trial_start: null }), true);
});

test('pending asynchronous payment does not activate access, a current trial or paid invoice does', () => {
  const now = new Date(1_000_000);
  const items = { data: [{ current_period_end: 1_100 }] } as Stripe.ApiList<Stripe.SubscriptionItem>;
  assert.equal(subscriptionHasConfirmedAccess({ status: 'trialing', trial_end: 1_100, latest_invoice: null, items }, now), true);
  assert.equal(subscriptionHasConfirmedAccess({ status: 'trialing', trial_end: 900, latest_invoice: null, items }, now), false);
  assert.equal(subscriptionHasConfirmedAccess({ status: 'active', trial_end: null, latest_invoice: { status: 'paid' } as Stripe.Invoice, items }, now), true);
  assert.equal(subscriptionHasConfirmedAccess({ status: 'active', trial_end: null, latest_invoice: { status: 'paid' } as Stripe.Invoice, items: { data: [{ current_period_end: 900 }] } as Stripe.ApiList<Stripe.SubscriptionItem> }, now), false);
  assert.equal(subscriptionHasConfirmedAccess({ status: 'active', trial_end: null, latest_invoice: { status: 'open' } as Stripe.Invoice, items }, now), false);
  assert.equal(subscriptionHasConfirmedAccess({ status: 'past_due', trial_end: null, latest_invoice: { status: 'paid' } as Stripe.Invoice, items }, now), false);
});

test('subscription synchronization projects annual/trial/cancellation details', () => {
  const snapshot = { id: 'sub_test', customer: 'cus_test', status: 'trialing', metadata: { userId: 'user_test' }, items: { data: [{ current_period_end: 2_000, price: { id: 'price_annual', recurring: { interval: 'year' } } }] }, trial_end: 1_800, cancel_at_period_end: true } as unknown as Stripe.Subscription;
  const patch = stripeSubscriptionPatch(snapshot);
  assert.equal(patch.values.billingInterval, 'annual');
  assert.equal(patch.values.stripePriceId, 'price_annual');
  assert.equal(patch.values.stripeTrialEnd?.getTime(), 1_800_000);
  assert.equal(patch.values.stripeCurrentPeriodEnd?.getTime(), 2_000_000);
  assert.equal(patch.values.stripeCancelAtPeriodEnd, true);
});

test('paywall assignment is stable for a user/version and distributes both variants', () => {
  const users = Array.from({ length: 1_000 }, (_, n) => `test-user-${n}`);
  const assigned = users.map(user => assignPaywallVariant(user, 1));
  assert.deepEqual(users.map(user => assignPaywallVariant(user, 1)), assigned);
  assert.ok(assigned.filter(variant => variant === 'a').length > 400);
  assert.ok(assigned.filter(variant => variant === 'b').length > 400);
  assert.ok(users.some((user, n) => assignPaywallVariant(user, 2) !== assigned[n]));
});
