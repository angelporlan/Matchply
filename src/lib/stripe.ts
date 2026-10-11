import Stripe from 'stripe';

export const STRIPE_MODE = (process.env.STRIPE_MODE || 'test') as 'test' | 'production';

export const STRIPE_SECRET_KEY = STRIPE_MODE === 'production'
  ? process.env.STRIPE_PROD_SECRET_KEY
  : process.env.STRIPE_TEST_SECRET_KEY;

export const STRIPE_WEBHOOK_SECRET = STRIPE_MODE === 'production'
  ? process.env.STRIPE_PROD_WEBHOOK_SECRET
  : process.env.STRIPE_TEST_WEBHOOK_SECRET;

export const STRIPE_PRICE_ID_PRO = STRIPE_MODE === 'production'
  ? process.env.STRIPE_PROD_PRICE_ID_PRO
  : process.env.STRIPE_TEST_PRICE_ID_PRO;

export type BillingInterval = 'monthly' | 'annual';

export const BILLING_OFFERS = {
  monthly: { amount: 1_000, currency: 'eur', recurringInterval: 'month' },
  annual: { amount: 9_600, currency: 'eur', recurringInterval: 'year' },
} as const;

export function getStripePriceId(interval: BillingInterval) {
  const prefix = STRIPE_MODE === 'production' ? 'STRIPE_PROD' : 'STRIPE_TEST';
  const configured = process.env[`${prefix}_PRICE_ID_PRO_${interval === 'monthly' ? 'MONTHLY' : 'ANNUAL'}`]?.trim();
  return interval === 'monthly'
    ? configured && configured !== 'price_...' ? configured : STRIPE_PRICE_ID_PRO
    : configured;
}

export const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_test_not_configured', {
  apiVersion: '2026-09-30.endive',
  timeout: 10_000,
  maxNetworkRetries: 2,
});

export const getAppUrl = () => {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
};
