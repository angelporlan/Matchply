import type Stripe from 'stripe';
import { stripe, STRIPE_SECRET_KEY, STRIPE_MODE, getStripePriceId, BILLING_OFFERS, type BillingInterval } from '@/lib/stripe';
import { isExpectedBillingPrice, PRO_TRIAL_DAYS } from '@/lib/billing-policy';
import { log } from '@/lib/logger';

export type BillingCatalogOffer = { available: boolean; amount: number; interval: BillingInterval };
export type BillingCatalog = {
  currency: 'EUR'; trialDays: number; trialEligible: boolean; discountPercent: number;
  monthly: BillingCatalogOffer; annual: BillingCatalogOffer;
};

let cached: { key: string; expires: number; value: Record<BillingInterval, Stripe.Price | null> } | null = null;
let portalCached: { expires: number; value: boolean } | null = null;

export function isMonetizationEnabled() { return process.env.STRIPE_MONETIZATION_ENABLED === 'true'; }
// Stripe's reminder-email setting is Dashboard-only; sandbox emails are never sent.
// A separate deployment guard keeps the annual offer usable while trials await verification.
export function areTrialRemindersVerified() { return process.env.STRIPE_TRIAL_REMINDERS_VERIFIED === 'true'; }

export async function isBillingPortalReady() {
  if (!STRIPE_SECRET_KEY) return false;
  if (portalCached && portalCached.expires > Date.now()) return portalCached.value;
  try {
    const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
    const configuration = configurations.data.find(item => item.active && item.is_default);
    const ready = Boolean(configuration?.features.subscription_cancel.enabled && configuration.features.subscription_cancel.mode === 'at_period_end');
    portalCached = { expires: Date.now() + 60_000, value: ready };
    return ready;
  } catch (error) {
    log({ event: 'stripe_portal_configuration_unavailable', level: 'warn', error });
    return false;
  }
}

export async function getBillingPrices() {
  const ids = { monthly: getStripePriceId('monthly'), annual: getStripePriceId('annual') };
  const key = `${STRIPE_MODE}:${ids.monthly}:${ids.annual}`;
  if (cached?.key === key && cached.expires > Date.now()) return cached.value;
  const prices: Record<BillingInterval, Stripe.Price | null> = { monthly: null, annual: null };
  await Promise.all((['monthly', 'annual'] as const).map(async (interval) => {
    const id = ids[interval];
    if (!STRIPE_SECRET_KEY || !id || !/^price_[A-Za-z0-9]+$/.test(id) || id === 'price_...') return;
    try {
      const price = await stripe.prices.retrieve(id);
      if (!isExpectedBillingPrice(price, interval)) {
        log({ event: 'stripe_price_invalid', level: 'warn', interval, priceId: id });
        return;
      }
      prices[interval] = price;
    } catch (error) {
      log({ event: 'stripe_price_unavailable', level: 'warn', interval, error });
    }
  }));
  cached = { key, expires: Date.now() + 60_000, value: prices };
  return prices;
}

export async function getBillingCatalog(trialEligible = false): Promise<BillingCatalog> {
  const prices = await getBillingPrices();
  const ready = isMonetizationEnabled() && await isBillingPortalReady();
  return {
    currency: 'EUR', trialDays: PRO_TRIAL_DAYS, trialEligible: ready && areTrialRemindersVerified() && trialEligible, discountPercent: 20,
    monthly: { available: Boolean(prices.monthly), amount: BILLING_OFFERS.monthly.amount / 100, interval: 'monthly' },
    annual: { available: ready && Boolean(prices.annual), amount: BILLING_OFFERS.annual.amount / 100, interval: 'annual' },
  };
}
