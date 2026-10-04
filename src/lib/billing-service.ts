import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { billingCheckoutAttempts, users } from '@/db/schema';
import { stripe, getAppUrl, STRIPE_SECRET_KEY, type BillingInterval } from '@/lib/stripe';
import { areTrialRemindersVerified, getBillingPrices, isBillingPortalReady, isMonetizationEnabled } from '@/lib/billing-catalog';
import { hasPriorPaidOrTrialSubscription, PRO_TRIAL_DAYS } from '@/lib/billing-policy';
import { getPaywallPresentation, recordMonetizationEvent } from '@/lib/monetization';
import { safeInternalPath } from '@/lib/auth-intent';
import { syncStripeSubscription } from '@/lib/stripe-subscription-sync';

export class BillingError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) { super(message); this.name = 'BillingError'; }
}

export const billingUserColumns = {
  id: users.id, email: users.email, name: users.name, isGuest: users.isGuest, accountStatus: users.accountStatus,
  stripeCustomerId: users.stripeCustomerId, stripeSubscriptionId: users.stripeSubscriptionId,
  subscriptionStatus: users.subscriptionStatus, stripeTrialUsedAt: users.stripeTrialUsedAt, stripePaidAt: users.stripePaidAt,
};

type BillingUser = { stripeCustomerId: string | null; stripeTrialUsedAt: Date | null; stripePaidAt: Date | null };

async function customerSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100, expand: ['data.latest_invoice'] });
  return { subscriptions: subscriptions.data, more: subscriptions.has_more };
}

export async function isUserTrialEligible(user: BillingUser) {
  if (user.stripeTrialUsedAt || user.stripePaidAt) return false;
  if (!user.stripeCustomerId) return true;
  if (!STRIPE_SECRET_KEY) return false;
  const history = await customerSubscriptions(user.stripeCustomerId);
  return !history.more && !history.subscriptions.some(hasPriorPaidOrTrialSubscription);
}

export async function createUserCheckout(input: { userId: string; interval: BillingInterval; requestId: string; source?: string; returnTo?: string }) {
  if (!STRIPE_SECRET_KEY) throw new BillingError('billing_unavailable', 'La compra no está disponible.', 503);
  const newOffersReady = isMonetizationEnabled() && await isBillingPortalReady();
  if (input.interval === 'annual' && !newOffersReady) throw new BillingError('billing_unavailable', 'La compra no está disponible.', 503);
  const price = (await getBillingPrices())[input.interval];
  if (!price) throw new BillingError('price_unavailable', 'Este plan aún no está disponible. Elige otra modalidad.', 503);
  const presentation = await getPaywallPresentation(input.userId);
  const origin = getAppUrl();
  const returnTo = safeInternalPath(input.returnTo, '/dashboard/subscription');
  const source = input.source || 'subscription';

  return db.transaction(async (tx) => {
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext(${`billing:${input.userId}`})) as locked`);
    if (!(lock.rows[0] as { locked: boolean } | undefined)?.locked) throw new BillingError('checkout_in_progress', 'Ya hay una compra en preparación. Vuelve a intentarlo.', 409);
    const [user] = await tx.select(billingUserColumns).from(users).where(eq(users.id, input.userId)).for('update').limit(1);
    if (!user || user.isGuest || user.accountStatus !== 'active') throw new BillingError('billing_forbidden', 'Esta cuenta no puede comprar una suscripción.', 403);
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name || undefined, metadata: { userId: user.id } }, { idempotencyKey: `matchply-customer:${user.id}` });
      customerId = customer.id;
      await tx.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
    }

    const history = await customerSubscriptions(customerId);
    const subscribed = history.subscriptions.find((subscription) => ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete'].includes(subscription.status));
    if (subscribed) {
      await syncStripeSubscription(subscribed, { database: tx, recordConversions: false });
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}${returnTo}` });
      return { url: portal.url };
    }
    const trialEligible = newOffersReady && areTrialRemindersVerified() && !user.stripeTrialUsedAt && !user.stripePaidAt && !history.more && !history.subscriptions.some(hasPriorPaidOrTrialSubscription);
    const [previous] = await tx.select().from(billingCheckoutAttempts).where(eq(billingCheckoutAttempts.userId, user.id)).limit(1);
    if (previous?.requestId === input.requestId && previous.interval !== input.interval) throw new BillingError('checkout_request_conflict', 'Esta solicitud ya pertenece a otra modalidad.', 409);
    if (previous?.sessionId && previous.expiresAt && previous.expiresAt.getTime() > Date.now()) {
      const session = await stripe.checkout.sessions.retrieve(previous.sessionId);
      const sameTrialTerms = session.metadata?.trialDays === String(trialEligible ? PRO_TRIAL_DAYS : 0);
      if (session.status === 'open' && previous.interval === input.interval && sameTrialTerms && session.url) return { url: session.url };
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
    }
    const metadata = {
      userId: user.id, source, interval: input.interval,
      experimentVersion: String(presentation.experimentVersion),
      ...(presentation.variant ? { variant: presentation.variant } : {}), returnTo,
      trialDays: String(trialEligible ? PRO_TRIAL_DAYS : 0),
    };
    // A request UUID supplies the entropy; its identifier must survive network retries.
    const suffix = Array.from(createHash('sha256').update(`${user.id}:${input.requestId}`).digest().subarray(0, 8), value => String.fromCharCode(97 + value % 26)).join('');
    let session;
    try { session = await stripe.checkout.sessions.create({
      customer: customerId, line_items: [{ price: price.id, quantity: 1 }], mode: 'subscription', payment_method_collection: 'always',
      success_url: `${origin}/dashboard/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${returnTo}${returnTo.includes('?') ? '&' : '?'}checkout=cancel`,
      allow_promotion_codes: true, customer_update: { name: 'auto', address: 'auto' },
      subscription_data: { metadata, ...(trialEligible ? { trial_period_days: PRO_TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } } : {}) },
      metadata, integration_identifier: `matchply-plans-${suffix}`,
    }, { idempotencyKey: `matchply-checkout:${user.id}:${input.requestId}` }); }
    catch (error) {
      if (error instanceof Error && 'type' in error && error.type === 'StripeIdempotencyError') throw new BillingError('checkout_request_conflict', 'Esta solicitud ya pertenece a otra compra. Vuelve a empezar.', 409);
      throw error;
    }
    if (!session.url) throw new BillingError('checkout_unavailable', 'No se pudo preparar la compra.', 502);
    await tx.insert(billingCheckoutAttempts).values({ userId: user.id, requestId: input.requestId, interval: input.interval, sessionId: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1_000) })
      .onConflictDoUpdate({ target: billingCheckoutAttempts.userId, set: { requestId: input.requestId, interval: input.interval, sessionId: session.id, url: session.url, expiresAt: new Date(session.expires_at * 1_000), updatedAt: new Date() } });
    await recordMonetizationEvent({ userId: user.id, event: 'checkout_started', source, externalId: `checkout:${session.id}`, experimentVersion: presentation.experimentVersion, variant: presentation.variant, metadata: { interval: input.interval } }, tx);
    return { url: session.url };
  });
}

/** A return URL is only a read/repair path. Signed webhooks remain authoritative. */
export async function getOwnedCheckoutSession(userId: string, sessionId: string) {
  if (!/^cs_[a-zA-Z0-9_]{1,240}$/.test(sessionId)) throw new BillingError('invalid_session', 'Sesión de compra no válida.');
  const [user] = await db.select({ customerId: users.stripeCustomerId }).from(users).where(eq(users.id, userId)).limit(1);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!user || session.metadata?.userId !== userId || customerId !== user.customerId) throw new BillingError('session_forbidden', 'Sesión de compra no disponible.', 403);
  return session;
}
