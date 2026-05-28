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

export const stripe = new Stripe(STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10' as any,
});
