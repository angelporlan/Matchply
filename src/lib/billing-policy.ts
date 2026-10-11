import type Stripe from 'stripe';
import { BILLING_OFFERS, getAppUrl, type BillingInterval } from '@/lib/stripe';

export const PRO_TRIAL_DAYS = 7;

export function isTrustedBillingOrigin(origin: string | null) {
  try { return origin === new URL(getAppUrl()).origin; }
  catch { return false; }
}

export function readBillingInterval(value: unknown): BillingInterval | null {
  if (value === undefined || value === null || value === '') return 'monthly';
  return value === 'monthly' || value === 'annual' ? value : null;
}

export function isExpectedBillingPrice(price: Pick<Stripe.Price, 'active' | 'currency' | 'unit_amount' | 'type' | 'recurring'>, interval: BillingInterval) {
  const offer = BILLING_OFFERS[interval];
  return price.active && price.type === 'recurring' && price.currency === offer.currency
    && price.unit_amount === offer.amount && price.recurring?.interval === offer.recurringInterval
    && price.recurring.interval_count === 1 && price.recurring.usage_type === 'licensed';
}

/** Older webhook payloads remain immutable after an API upgrade. */
export function stripeInvoiceSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== 'object') return null;
  const record = invoice as Record<string, unknown>;
  const parent = record.parent as { subscription_details?: { subscription?: unknown } } | null;
  const subscription = parent?.subscription_details?.subscription ?? record.subscription;
  if (typeof subscription === 'string') return subscription;
  if (subscription && typeof subscription === 'object' && 'id' in subscription && typeof subscription.id === 'string') return subscription.id;
  return null;
}

export function stripeSubscriptionPeriodEnd(subscription: Pick<Stripe.Subscription, 'items'> & { current_period_end?: number }) {
  const periods = subscription.items.data.map((item) => item.current_period_end).filter((value) => Number.isFinite(value));
  const end = periods.length ? Math.min(...periods) : subscription.current_period_end;
  return typeof end === 'number' && Number.isFinite(end) ? new Date(end * 1_000) : null;
}

export function hasPriorPaidOrTrialSubscription(subscription: Pick<Stripe.Subscription, 'status' | 'trial_start'>) {
  return Boolean(subscription.trial_start) || !['incomplete', 'incomplete_expired'].includes(subscription.status);
}

export function subscriptionHasConfirmedAccess(subscription: Pick<Stripe.Subscription, 'status' | 'trial_end' | 'latest_invoice' | 'items'> & { current_period_end?: number }, now = new Date()) {
  if (subscription.status === 'trialing') return Boolean(subscription.trial_end && subscription.trial_end * 1_000 > now.getTime());
  if (subscription.status !== 'active') return false;
  const invoice = subscription.latest_invoice;
  const periodEnd = stripeSubscriptionPeriodEnd(subscription);
  return Boolean(invoice && typeof invoice !== 'string' && invoice.status === 'paid' && periodEnd && periodEnd.getTime() > now.getTime());
}
