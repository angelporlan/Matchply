import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type Stripe from 'stripe';

const testUrl = process.env.BILLING_TEST_DATABASE_URL || process.env.USAGE_TEST_DATABASE_URL;

test('billing and experiment integration in an isolated local database with mocked Stripe', { skip: !testUrl }, async (t) => {
  const parsed = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /test/i.test(parsed.pathname), 'Use an isolated local test database');
  process.env.DATABASE_URL = testUrl;
  process.env.STRIPE_MODE = 'test';
  process.env.STRIPE_TEST_SECRET_KEY = 'sk_test_fixture';
  process.env.STRIPE_TEST_PRICE_ID_PRO_MONTHLY = 'price_monthlyfixture';
  process.env.STRIPE_TEST_PRICE_ID_PRO_ANNUAL = 'price_annualfixture';
  process.env.STRIPE_MONETIZATION_ENABLED = 'true';
  process.env.STRIPE_TRIAL_REMINDERS_VERIFIED = 'true';
  const { db, pool } = await import('@/db');
  const { users, planConfigs, billingCheckoutAttempts, monetizationEvents, stripeWebhookEvents, cvPlanSelections } = await import('@/db/schema');
  const { defaultPlanConfig } = await import('@/lib/plan-config');
  const { getPlanConfig } = await import('@/lib/plan-store');
  const { stripe } = await import('@/lib/stripe');
  const { createUserCheckout, isUserTrialEligible, getOwnedCheckoutSession } = await import('@/lib/billing-service');
  const { getBillingCatalog } = await import('@/lib/billing-catalog');
  const { getBillingIntervalState, scheduleBillingInterval } = await import('@/lib/billing-interval');
  const { syncStripeSubscription } = await import('@/lib/stripe-subscription-sync');
  const { processStripeWebhook } = await import('@/lib/stripe-webhook');
  const { getAccessTier } = await import('@/lib/subscription');
  const { getPaywallPresentation, recordMonetizationEvent, getMonetizationMetrics, recordFirstValue } = await import('@/lib/monetization');
  await db.insert(planConfigs).values({ id: 1, version: 1, config: defaultPlanConfig() }).onConflictDoNothing();
  const config = await getPlanConfig();
  const experimentVersion = config.paywall.experimentVersion;
  let assignedVariant: 'a' | 'b' = 'a';
  const userId = randomUUID();
  const anotherUserId = randomUUID();
  const eventIds: string[] = [];
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const subscriptions = new Map<string, Stripe.Subscription>();
  const schedules = new Map<string, Stripe.SubscriptionSchedule>();
  const scheduleUpdates: Stripe.SubscriptionScheduleUpdateParams[] = [];
  let scheduleCreates = 0;
  const createdParameters: Stripe.Checkout.SessionCreateParams[] = [];
  let customerCreates = 0;
  let sessionCreates = 0;
  let allowHistory = false;
  const original = {
    customerCreate: stripe.customers.create, pricesRetrieve: stripe.prices.retrieve,
    portalList: stripe.billingPortal.configurations.list, portalCreate: stripe.billingPortal.sessions.create,
    subList: stripe.subscriptions.list, subRetrieve: stripe.subscriptions.retrieve,
    sessionCreate: stripe.checkout.sessions.create, sessionRetrieve: stripe.checkout.sessions.retrieve, sessionExpire: stripe.checkout.sessions.expire,
    scheduleCreate: stripe.subscriptionSchedules.create, scheduleRetrieve: stripe.subscriptionSchedules.retrieve, scheduleUpdate: stripe.subscriptionSchedules.update,
  };
  stripe.customers.create = (async () => { customerCreates += 1; return { id: 'cus_fixture' }; }) as typeof stripe.customers.create;
  stripe.prices.retrieve = (async (id: string) => ({ id, active: true, currency: 'eur', unit_amount: id === 'price_annualfixture' ? 9600 : 1000, type: 'recurring', recurring: { interval: id === 'price_annualfixture' ? 'year' : 'month', interval_count: 1, usage_type: 'licensed' } })) as typeof stripe.prices.retrieve;
  stripe.billingPortal.configurations.list = (async () => ({ data: [{ active: true, is_default: true, features: { subscription_cancel: { enabled: true, mode: 'at_period_end' } } }] })) as unknown as typeof stripe.billingPortal.configurations.list;
  stripe.billingPortal.sessions.create = (async () => ({ url: 'https://billing.stripe.com/fixture' })) as typeof stripe.billingPortal.sessions.create;
  stripe.subscriptions.list = (async () => ({ data: allowHistory ? Array.from(subscriptions.values()) : [], has_more: false })) as unknown as typeof stripe.subscriptions.list;
  stripe.subscriptions.retrieve = (async (id: string) => { const value = subscriptions.get(id); assert.ok(value); return value; }) as typeof stripe.subscriptions.retrieve;
  stripe.checkout.sessions.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
    createdParameters.push(params); sessionCreates += 1;
    const session = { id: `cs_test_fixture${sessionCreates}`, status: 'open', url: `https://checkout.stripe.com/fixture${sessionCreates}`, expires_at: Math.floor(Date.now() / 1000) + 1800, customer: 'cus_fixture', metadata: params.metadata, subscription: null } as Stripe.Checkout.Session;
    sessions.set(session.id, session); return session;
  }) as typeof stripe.checkout.sessions.create;
  stripe.checkout.sessions.retrieve = (async (id: string) => { const value = sessions.get(id); assert.ok(value); return value; }) as typeof stripe.checkout.sessions.retrieve;
  stripe.checkout.sessions.expire = (async (id: string) => { const value = sessions.get(id); assert.ok(value); value.status = 'expired'; return value; }) as typeof stripe.checkout.sessions.expire;
  stripe.subscriptionSchedules.retrieve = (async (id: string) => { const value = schedules.get(id); assert.ok(value); return value; }) as typeof stripe.subscriptionSchedules.retrieve;
  stripe.subscriptionSchedules.create = (async (params: Stripe.SubscriptionScheduleCreateParams) => {
    const subscription = subscriptions.get(params.from_subscription!); assert.ok(subscription);
    if (subscription.schedule) return schedules.get(String(subscription.schedule))!;
    scheduleCreates += 1;
    const start = Math.floor(Date.now() / 1000) - 100;
    const end = subscription.items.data[0].current_period_end;
    const schedule = { id: `sub_sched_fixture${scheduleCreates}`, current_phase: { start_date: start, end_date: end }, metadata: {}, phases: [{
      start_date: start, end_date: end, items: [{ price: subscription.items.data[0].price, quantity: 1, discounts: [] }],
      discounts: [{ coupon: 'coupon_legacycontract' }], automatic_tax: { enabled: false }, default_tax_rates: [],
      collection_method: 'charge_automatically', default_payment_method: 'pm_legacycontract', metadata: { contract: 'legacy' },
      invoice_settings: { custom_fields: [{ name: 'Contract', value: 'Existing terms' }], days_until_due: null },
      trial_end: subscription.trial_end, proration_behavior: 'create_prorations',
    }] } as unknown as Stripe.SubscriptionSchedule;
    schedules.set(schedule.id, schedule); subscription.schedule = schedule.id; return schedule;
  }) as typeof stripe.subscriptionSchedules.create;
  stripe.subscriptionSchedules.update = (async (id: string, params: Stripe.SubscriptionScheduleUpdateParams) => {
    scheduleUpdates.push(params);
    const previous = schedules.get(id); assert.ok(previous);
    const updated = { ...previous, metadata: params.metadata, phases: params.phases } as unknown as Stripe.SubscriptionSchedule;
    schedules.set(id, updated); return updated;
  }) as typeof stripe.subscriptionSchedules.update;
  const snapshot = (id: string, status: Stripe.Subscription.Status, overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription => ({
    id, status, customer: 'cus_fixture', metadata: { userId, experimentVersion: String(experimentVersion), variant: assignedVariant }, trial_start: null, trial_end: null, cancel_at_period_end: false,
    items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400, price: { id: 'price_monthlyfixture', recurring: { interval: 'month' } } }] },
    latest_invoice: { id: `in_${id}`, status: 'open', amount_paid: 0, status_transitions: { paid_at: null } }, ...overrides,
  } as Stripe.Subscription);
  try {
    await db.insert(users).values([{ id: userId, email: `billing-${userId}@example.test` }, { id: anotherUserId, email: `billing-${anotherUserId}@example.test` }]);
    await t.test('first result eligibility and its event commit or roll back with publication', async () => {
      await assert.rejects(db.transaction(async tx => {
        await recordFirstValue(anotherUserId, tx);
        throw new Error('discarded publication');
      }), /discarded publication/);
      const [unchanged] = await db.select({ firstValueAt: users.firstValueAt }).from(users).where(eq(users.id, anotherUserId));
      assert.equal(unchanged.firstValueAt, null);
      assert.equal((await db.select({ id: monetizationEvents.id }).from(monetizationEvents).where(eq(monetizationEvents.userId, anotherUserId))).length, 0);
      await db.transaction(tx => recordFirstValue(anotherUserId, tx));
      const [ready] = await db.select({ firstValueAt: users.firstValueAt }).from(users).where(eq(users.id, anotherUserId));
      assert.ok(ready.firstValueAt);
      await db.transaction(tx => recordFirstValue(anotherUserId, tx));
      const [replayed] = await db.select({ firstValueAt: users.firstValueAt }).from(users).where(eq(users.id, anotherUserId));
      assert.equal(replayed.firstValueAt?.getTime(), ready.firstValueAt.getTime());
      const events = await db.select({ event: monetizationEvents.event }).from(monetizationEvents).where(eq(monetizationEvents.userId, anotherUserId));
      assert.equal(events.filter(event => event.event === 'first_value_ready').length, 1);
    });
    await t.test('presentation assigns one stable variant; impressions and first value are deduplicated', async () => {
      const first = await getPaywallPresentation(userId);
      const next = await getPaywallPresentation(userId);
      assert.equal(first.variant, next.variant);
      assert.ok(first.variant); assignedVariant = first.variant;
      assert.equal(first.experimentVersion, experimentVersion);
      assert.equal(first.limits.generalAiMonthly, config.pro.generalAiMonthly);
      await recordMonetizationEvent({ userId, event: 'paywall_view', source: 'fixture', externalId: `view:${userId}` });
      await recordMonetizationEvent({ userId, event: 'paywall_view', source: 'fixture', externalId: `view:${userId}` });
      await recordFirstValue(userId); await recordFirstValue(userId);
      const events = await db.select({ event: monetizationEvents.event }).from(monetizationEvents).where(eq(monetizationEvents.userId, userId));
      assert.equal(events.filter(value => value.event === 'paywall_view').length, 1);
      assert.equal(events.filter(value => value.event === 'first_value_ready').length, 1);
    });
    await t.test('repeat checkout reuses one customer/session and conflicting intervals are rejected', async () => {
      const requestId = randomUUID();
      const first = await createUserCheckout({ userId, interval: 'monthly', requestId, source: 'fixture' });
      const repeated = await createUserCheckout({ userId, interval: 'monthly', requestId, source: 'fixture' });
      assert.equal(first.url, repeated.url);
      assert.equal(customerCreates, 1); assert.equal(sessionCreates, 1);
      assert.equal(createdParameters[0].subscription_data?.trial_period_days, 7);
      assert.equal(createdParameters[0].payment_method_collection, 'always');
      await assert.rejects(createUserCheckout({ userId, interval: 'annual', requestId }), /otra modalidad/);
      await assert.rejects(getOwnedCheckoutSession(anotherUserId, 'cs_test_fixture1'), /no disponible/);
      await createUserCheckout({ userId, interval: 'annual', requestId: randomUUID() });
      assert.equal(sessions.get('cs_test_fixture1')?.status, 'expired');
      assert.equal(createdParameters[1].line_items?.[0].price, 'price_annualfixture');
    });
    await t.test('expired trial history makes a later account purchase ineligible', async () => {
      allowHistory = true;
      subscriptions.set('sub_oldtrial', snapshot('sub_oldtrial', 'canceled', { trial_start: 1000 }));
      assert.equal(await isUserTrialEligible({ stripeCustomerId: 'cus_fixture', stripeTrialUsedAt: null, stripePaidAt: null }), false);
      allowHistory = false; subscriptions.clear();
    });
    await t.test('annual remains available while the unverified reminder guard disables trial in catalog and checkout', async () => {
      process.env.STRIPE_TRIAL_REMINDERS_VERIFIED = 'false';
      const catalog = await getBillingCatalog(true);
      assert.equal(catalog.trialEligible, false); assert.equal(catalog.annual.available, true);
      const previous = sessionCreates;
      await createUserCheckout({ userId, interval: 'annual', requestId: randomUUID() });
      assert.equal(sessionCreates, previous + 1, 'An open trial session must not survive disabling trial offers');
      assert.equal(createdParameters.at(-1)?.subscription_data?.trial_period_days, undefined);
      await createUserCheckout({ userId, interval: 'monthly', requestId: randomUUID() });
      assert.equal(createdParameters.at(-1)?.subscription_data?.trial_period_days, undefined);
      process.env.STRIPE_TRIAL_REMINDERS_VERIFIED = 'true';
    });
    await t.test('parallel checkout requests cannot create duplicate hosted sessions', async () => {
      const before = sessionCreates;
      const results = await Promise.allSettled([
        createUserCheckout({ userId, interval: 'annual', requestId: randomUUID() }),
        createUserCheckout({ userId, interval: 'annual', requestId: randomUUID() }),
      ]);
      assert.ok(results.some(result => result.status === 'fulfilled'));
      for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.code, 'checkout_in_progress');
      assert.equal(sessionCreates, before + 1, 'Two concurrent requests create at most one session for the new interval');
    });
    await t.test('signed webhook duplicate marker and fresh provider state prevent stale activation', async () => {
      const subscription = snapshot('sub_current', 'trialing', { trial_start: Math.floor(Date.now() / 1000), trial_end: Math.floor(Date.now() / 1000) + 7 * 86400 });
      subscriptions.set(subscription.id, subscription);
      const event = { id: `evt_${randomUUID()}`, type: 'customer.subscription.created', data: { object: subscription } } as Stripe.Event;
      eventIds.push(event.id);
      const payload = JSON.stringify(event);
      const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_fixture' });
      const verified = stripe.webhooks.constructEvent(payload, signature, 'whsec_fixture');
      assert.equal((await processStripeWebhook(verified)).duplicate, false);
      assert.equal((await processStripeWebhook(verified)).duplicate, true);
      let [user] = await db.select().from(users).where(eq(users.id, userId));
      assert.equal(user.subscriptionStatus, 'trialing'); assert.ok(user.stripeTrialUsedAt); assert.ok(user.stripeTrialEnd);
      await db.insert(cvPlanSelections).values({ userId, baseCvId: randomUUID(), adaptedCvIds: [randomUUID()] });
      subscriptions.set(subscription.id, { ...subscription, status: 'canceled' });
      await syncStripeSubscription(subscription); // Deliberately pass a stale active/trial snapshot.
      [user] = await db.select().from(users).where(eq(users.id, userId));
      assert.equal(user.subscriptionStatus, 'canceled');
      assert.equal((await db.select().from(cvPlanSelections).where(eq(cvPlanSelections.userId, userId))).length, 0);
      await db.insert(cvPlanSelections).values({ userId, baseCvId: randomUUID(), adaptedCvIds: [randomUUID()] });
      await syncStripeSubscription(subscription);
      assert.equal((await db.select().from(cvPlanSelections).where(eq(cvPlanSelections.userId, userId))).length, 1, 'Repeated Free sync preserves the user selection');
    });
    await t.test('pending payments do not extend access and old canceled subscription cannot revoke a new one', async () => {
      const presentation = await getPaywallPresentation(userId);
      subscriptions.set('sub_new', snapshot('sub_new', 'active', { latest_invoice: { id: 'in_paidfixture', status: 'paid', amount_paid: 1000, status_transitions: { paid_at: Math.floor(Date.now() / 1000) } } as Stripe.Invoice }));
      subscriptions.get('sub_new')!.metadata.variant = presentation.variant!;
      await syncStripeSubscription(subscriptions.get('sub_new')!);
      const [paid] = await db.select().from(users).where(eq(users.id, userId));
      assert.equal(paid.stripeSubscriptionId, 'sub_new'); assert.ok(paid.stripePaidAt);
      const renewal = { ...subscriptions.get('sub_new')!, latest_invoice: { id: 'in_renewalfixture', status: 'paid', amount_paid: 1000, status_transitions: { paid_at: Math.floor(Date.now() / 1000) } } as Stripe.Invoice };
      subscriptions.set(renewal.id, renewal); await syncStripeSubscription(renewal);
      let conversions = await db.select({ externalId: monetizationEvents.externalId }).from(monetizationEvents).where(eq(monetizationEvents.userId, userId));
      assert.equal(conversions.filter(event => event.externalId === `first-paid:${userId}`).length, 1, 'Renewal does not count as another first payment');
      const old = snapshot('sub_current', 'canceled'); subscriptions.set(old.id, old);
      await syncStripeSubscription(old);
      let [current] = await db.select().from(users).where(eq(users.id, userId));
      assert.equal(current.stripeSubscriptionId, 'sub_new'); assert.equal(current.subscriptionStatus, 'active');
      const pending = snapshot('sub_new', 'active', { items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 100 * 86400, price: { id: 'price_monthlyfixture', recurring: { interval: 'month' } } }] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem> });
      subscriptions.set(pending.id, pending); await syncStripeSubscription(pending);
      [current] = await db.select().from(users).where(eq(users.id, userId));
      assert.equal(current.stripeCurrentPeriodEnd?.getTime(), paid.stripeCurrentPeriodEnd?.getTime());
      subscriptions.set('sub_new', { ...pending, status: 'canceled' }); await syncStripeSubscription(pending);
      const repurchase = snapshot('sub_repurchase', 'active', { metadata: { userId, experimentVersion: String(presentation.experimentVersion), variant: presentation.variant! }, latest_invoice: { id: 'in_repurchasefixture', status: 'paid', amount_paid: 9600, status_transitions: { paid_at: Math.floor(Date.now() / 1000) } } as Stripe.Invoice });
      subscriptions.set(repurchase.id, repurchase); await syncStripeSubscription(repurchase);
      conversions = await db.select({ externalId: monetizationEvents.externalId }).from(monetizationEvents).where(eq(monetizationEvents.userId, userId));
      assert.equal(conversions.filter(event => event.externalId === `first-paid:${userId}`).length, 1, 'Resubscription does not count as another first payment');
      const metrics = await getMonetizationMetrics(presentation.experimentVersion);
      assert.equal(metrics.experimentVersion, presentation.experimentVersion);
      assert.ok(metrics.variants.a.paid + metrics.variants.b.paid >= 1);
    });
    await t.test('an existing Stripe subscription repairs local state and goes to the portal without another checkout', async () => {
      await db.update(users).set({ stripeSubscriptionId: null, subscriptionStatus: 'canceled' }).where(eq(users.id, userId));
      const before = sessionCreates;
      allowHistory = true;
      const result = await createUserCheckout({ userId, interval: 'annual', requestId: randomUUID() });
      allowHistory = false;
      assert.equal(result.url, 'https://billing.stripe.com/fixture'); assert.equal(sessionCreates, before);
      const [current] = await db.select().from(users).where(eq(users.id, userId));
      assert.equal(current.stripeSubscriptionId, 'sub_repurchase'); assert.equal(current.subscriptionStatus, 'active');
    });
    await t.test('interval changes preserve current contract, start at renewal and replay without another schedule', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 10 * 86400;
      const legacy = snapshot('sub_legacycontract', 'active', {
        items: { data: [{ current_period_end: periodEnd, quantity: 1, price: { id: 'price_legacycontract', unit_amount: 700, currency: 'eur', recurring: { interval: 'month', usage_type: 'licensed' } } }] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
        latest_invoice: { status: 'paid', amount_paid: 700 } as Stripe.Invoice,
      });
      subscriptions.set(legacy.id, legacy);
      await db.update(users).set({ stripeCustomerId: 'cus_fixture', stripeSubscriptionId: legacy.id }).where(eq(users.id, userId));
      const requestId = randomUUID();
      const scheduled = await scheduleBillingInterval({ userId, interval: 'annual', requestId });
      assert.equal(scheduled.currentInterval, 'monthly'); assert.equal(scheduled.currentPrice?.amount, 7);
      assert.equal(scheduled.scheduled?.interval, 'annual');
      assert.equal(scheduled.scheduled?.effectiveAt, new Date(periodEnd * 1000).toISOString());
      const update = scheduleUpdates.at(-1)!;
      assert.equal(update.proration_behavior, 'none'); assert.equal(update.end_behavior, 'release');
      assert.equal(update.phases?.[0].items[0].price, 'price_legacycontract');
      assert.equal(update.phases?.[0].end_date, periodEnd);
      assert.deepEqual(update.phases?.[0].discounts, [{ coupon: 'coupon_legacycontract' }]);
      assert.equal(update.phases?.[0].default_payment_method, 'pm_legacycontract');
      assert.deepEqual(update.phases?.[0].invoice_settings?.custom_fields, [{ name: 'Contract', value: 'Existing terms' }]);
      assert.equal(update.phases?.[1].items[0].price, 'price_annualfixture');
      assert.equal(update.phases?.[1].start_date, periodEnd); assert.equal(update.phases?.[1].trial_end, undefined);
      assert.deepEqual(update.phases?.[1].duration, { interval: 'year', interval_count: 1 });
      const before = scheduleUpdates.length;
      assert.deepEqual(await scheduleBillingInterval({ userId, interval: 'annual', requestId }), scheduled);
      assert.equal(scheduleUpdates.length, before); assert.equal(scheduleCreates, 1);
      await assert.rejects(scheduleBillingInterval({ userId, interval: 'monthly', requestId }), { code: 'checkout_request_conflict' });
      await scheduleBillingInterval({ userId, interval: 'monthly', requestId: randomUUID() });
      assert.equal(scheduleUpdates.at(-1)?.phases?.length, 1, 'Keeping the existing interval removes only the future change');
      assert.equal((await getBillingIntervalState(userId)).scheduled, null);
    });
    await t.test('scheduled cancellation and schedules managed elsewhere cannot be changed', async () => {
      const legacy = subscriptions.get('sub_legacycontract')!;
      subscriptions.set(legacy.id, { ...legacy, cancel_at_period_end: true });
      await assert.rejects(scheduleBillingInterval({ userId, interval: 'annual', requestId: randomUUID() }), { code: 'cancellation_scheduled' });
      subscriptions.set(legacy.id, { ...legacy, schedule: 'sub_sched_foreign' });
      schedules.set('sub_sched_foreign', { id: 'sub_sched_foreign', metadata: { managedBy: 'different-service' }, phases: [] } as unknown as Stripe.SubscriptionSchedule);
      await assert.rejects(scheduleBillingInterval({ userId, interval: 'annual', requestId: randomUUID() }), { code: 'schedule_managed_elsewhere' });
      subscriptions.set(legacy.id, { ...legacy, customer: 'cus_someoneelse' });
      await assert.rejects(getBillingIntervalState(userId), { code: 'subscription_forbidden' });
    });
    await t.test('trial cancellation keeps access until its end and failed payment cannot extend it', async () => {
      const trial = snapshot('sub_canceltrial', 'trialing', {
        customer: 'cus_canceltrial', metadata: { userId: anotherUserId }, trial_start: Math.floor(Date.now() / 1000),
        trial_end: Math.floor(Date.now() / 1000) + 7 * 86400, cancel_at_period_end: true,
      });
      subscriptions.set(trial.id, trial);
      await db.update(users).set({ stripeCustomerId: 'cus_canceltrial' }).where(eq(users.id, anotherUserId));
      await syncStripeSubscription(trial);
      let [current] = await db.select().from(users).where(eq(users.id, anotherUserId));
      assert.equal(getAccessTier(current.subscriptionStatus, current), 'pro');
      assert.equal(current.stripeCancelAtPeriodEnd, true);
      subscriptions.set(trial.id, { ...trial, status: 'canceled' });
      await syncStripeSubscription(trial);
      [current] = await db.select().from(users).where(eq(users.id, anotherUserId));
      assert.equal(getAccessTier(current.subscriptionStatus, current), 'free');
      assert.equal(await isUserTrialEligible(current), false, 'Cancellation never restores the one-time trial');
      const failure = { ...trial, status: 'past_due' as const, cancel_at_period_end: false, latest_invoice: { status: 'open', amount_paid: 0 } as Stripe.Invoice };
      subscriptions.set(failure.id, failure); await syncStripeSubscription(failure);
      [current] = await db.select().from(users).where(eq(users.id, anotherUserId));
      assert.equal(getAccessTier(current.subscriptionStatus, current), 'free');
      assert.equal(current.stripePaidAt, null);
    });
  } finally {
    stripe.customers.create = original.customerCreate; stripe.prices.retrieve = original.pricesRetrieve;
    stripe.billingPortal.configurations.list = original.portalList; stripe.billingPortal.sessions.create = original.portalCreate;
    stripe.subscriptions.list = original.subList; stripe.subscriptions.retrieve = original.subRetrieve;
    stripe.checkout.sessions.create = original.sessionCreate; stripe.checkout.sessions.retrieve = original.sessionRetrieve; stripe.checkout.sessions.expire = original.sessionExpire;
    stripe.subscriptionSchedules.create = original.scheduleCreate; stripe.subscriptionSchedules.retrieve = original.scheduleRetrieve; stripe.subscriptionSchedules.update = original.scheduleUpdate;
    await db.delete(stripeWebhookEvents).where(inArray(stripeWebhookEvents.id, eventIds));
    await db.delete(billingCheckoutAttempts).where(eq(billingCheckoutAttempts.userId, userId));
    await db.delete(users).where(inArray(users.id, [userId, anotherUserId]));
    await pool.end();
  }
});
