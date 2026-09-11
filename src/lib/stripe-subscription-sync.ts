import Stripe from 'stripe';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { log } from '@/lib/logger';

export function stripeSubscriptionPatch(subscription: Pick<Stripe.Subscription, 'id' | 'status' | 'customer' | 'metadata'>) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  return {
    userId: subscription.metadata?.userId || null,
    customerId,
    values: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    },
  };
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const { userId, customerId, values } = stripeSubscriptionPatch(subscription);
  log({
    event: 'stripe_subscription_sync',
    userId: userId || undefined,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
  });

  if (userId) {
    await db.update(users).set(values).where(eq(users.id, userId));
    return;
  }

  await db
    .update(users)
    .set(values)
    .where(eq(users.stripeCustomerId, customerId));
}
