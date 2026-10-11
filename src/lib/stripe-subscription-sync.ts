import Stripe from 'stripe';
import { db } from '@/db';
import { cvPlanSelections, users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { stripeSubscriptionPeriodEnd } from '@/lib/billing-policy';
import { recordMonetizationEvent, type MonetizationDatabase } from '@/lib/monetization';
import { log } from '@/lib/logger';
import { getAccessTier, isProSubscription } from '@/lib/subscription';

type SubscriptionSnapshot = Pick<Stripe.Subscription, 'id' | 'status' | 'customer' | 'metadata'> & Partial<Pick<Stripe.Subscription, 'items' | 'trial_start' | 'trial_end' | 'cancel_at_period_end' | 'latest_invoice'>>;

export function stripeSubscriptionPatch(subscription: SubscriptionSnapshot) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const item = subscription.items?.data[0];
  const interval = item?.price.recurring?.interval;
  return {
    userId: subscription.metadata?.userId || null,
    customerId,
    values: {
      stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, subscriptionStatus: subscription.status,
      stripePriceId: item?.price.id ?? null,
      billingInterval: interval === 'month' ? 'monthly' : interval === 'year' ? 'annual' : null,
      stripeTrialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1_000) : null,
      stripeCurrentPeriodEnd: subscription.items ? stripeSubscriptionPeriodEnd({ items: subscription.items }) : null,
      stripeCancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    },
  };
}

export async function retrieveCurrentStripeSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
}

/** Uses fresh Stripe state rather than event timestamps, which are not a reliable order. */
export async function syncStripeSubscription(subscription: Stripe.Subscription, options: { recordConversions?: boolean; database?: MonetizationDatabase } = {}) {
  const { userId, customerId } = stripeSubscriptionPatch(subscription);
  const database = options.database || db;
  const [owner] = await database.select({ id: users.id, stripeCustomerId: users.stripeCustomerId }).from(users)
    .where(userId ? eq(users.id, userId) : eq(users.stripeCustomerId, customerId)).limit(1);
  if (!owner || (owner.stripeCustomerId && owner.stripeCustomerId !== customerId)) {
    log({ event: 'stripe_subscription_owner_missing', level: 'warn', stripeSubscriptionId: subscription.id });
    return;
  }
  // Existing contracts remain fulfillable even if paywall configuration is unavailable.
  // Only new Checkout metadata attributes a payment to an experiment.
  const rawVersion = Number(subscription.metadata.experimentVersion);
  const experimentVersion = Number.isSafeInteger(rawVersion) && rawVersion > 0 && rawVersion <= 1_000_000 ? rawVersion : null;
  const variant = subscription.metadata.variant === 'a' || subscription.metadata.variant === 'b' ? subscription.metadata.variant : null;
  let appliedStatus: string | null = null;
  const apply = async (tx: MonetizationDatabase) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`billing:${owner.id}`}))`);
    const latest = await retrieveCurrentStripeSubscription(subscription.id);
    const { values } = stripeSubscriptionPatch(latest);
    const [current] = await tx.select({ subscriptionId: users.stripeSubscriptionId, status: users.subscriptionStatus, stripePriceId: users.stripePriceId, stripePaidAt: users.stripePaidAt, stripeCurrentPeriodEnd: users.stripeCurrentPeriodEnd, stripeTrialEnd: users.stripeTrialEnd, proGrantedUntil: users.proGrantedUntil, isGuest: users.isGuest }).from(users).where(eq(users.id, owner.id)).for('update').limit(1);
    if (!current) return;
    // A delayed event for an older subscription must never replace a newer live subscription.
    if (current.subscriptionId && current.subscriptionId !== latest.id && ['active', 'trialing', 'past_due', 'unpaid', 'paused'].includes(current.status)) {
      const existing = await retrieveCurrentStripeSubscription(current.subscriptionId);
      if (!['canceled', 'incomplete_expired'].includes(existing.status)) return;
    }
    if (current.subscriptionId && current.subscriptionId !== latest.id && ['canceled', 'incomplete_expired'].includes(latest.status)) return;
    const invoice = typeof latest.latest_invoice === 'object' ? latest.latest_invoice : null;
    const paid = invoice?.status === 'paid' && invoice.amount_paid > 0;
    // A paid zero-amount invoice (for example a valid promotion) also grants access;
    // only a positive payment counts as a commercial conversion.
    const paidAt = invoice?.status === 'paid' && latest.status === 'active'
      ? new Date((invoice.status_transitions.paid_at || Math.floor(Date.now() / 1_000)) * 1_000) : null;
    await tx.update(users).set({
      ...values,
      ...(latest.status === 'trialing' || invoice?.status === 'paid' ? {} : { stripeCurrentPeriodEnd: undefined }),
      ...(latest.trial_start ? { stripeTrialUsedAt: sql`coalesce(${users.stripeTrialUsedAt}, ${new Date(latest.trial_start * 1_000)})` } : {}),
      ...(paidAt ? { stripePaidAt: sql`coalesce(${users.stripePaidAt}, ${paidAt})` } : {}),
    }).where(eq(users.id, owner.id));
    appliedStatus = latest.status;
    const nextTier = getAccessTier(latest.status, { ...current, ...values, stripePaidAt: paidAt || current.stripePaidAt, stripeCurrentPeriodEnd: latest.status === 'trialing' || invoice?.status === 'paid' ? values.stripeCurrentPeriodEnd : current.stripeCurrentPeriodEnd });
    if (isProSubscription(current.status) && nextTier === 'free' && (current.status !== latest.status || current.subscriptionId !== latest.id)) {
      await tx.delete(cvPlanSelections).where(eq(cvPlanSelections.userId, owner.id));
    }
    if (options.recordConversions !== false) {
      if (latest.trial_start) await recordMonetizationEvent({ userId: owner.id, event: 'trial_started', source: subscription.metadata.source || 'stripe', externalId: `trial:${subscription.id}`, experimentVersion, variant }, tx);
      if (paid && invoice) await recordMonetizationEvent({ userId: owner.id, event: 'subscription_paid', source: subscription.metadata.source || 'stripe', externalId: `first-paid:${owner.id}`, experimentVersion, variant, metadata: { invoiceId: invoice.id, amount: invoice.amount_paid, interval: values.billingInterval } }, tx);
    }
  };
  if (options.database) await apply(options.database);
  else await db.transaction(apply);
  log({ event: appliedStatus ? 'stripe_subscription_sync' : 'stripe_subscription_ignored', userId: owner.id, stripeSubscriptionId: subscription.id, subscriptionStatus: appliedStatus || subscription.status });
}
