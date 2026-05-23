import Stripe from 'stripe';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  const userId = subscription.metadata.userId;

  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
  };

  if (userId) {
    await db.update(users).set(values).where(eq(users.id, userId));
    return;
  }

  await db
    .update(users)
    .set(values)
    .where(eq(users.stripeCustomerId, customerId));
}
