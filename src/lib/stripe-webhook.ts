import { eq, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '@/db';
import { stripeWebhookEvents } from '@/db/schema';
import { retrieveCurrentStripeSubscription, syncStripeSubscription } from '@/lib/stripe-subscription-sync';
import { stripeInvoiceSubscriptionId } from '@/lib/billing-policy';
import { log } from '@/lib/logger';

export async function processStripeWebhook(event: Stripe.Event) {
  return db.transaction(async (tx) => {
    // Duplicate concurrent deliveries cannot both fulfill. Failed work rolls the marker back.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stripe-event:${event.id}`}))`);
    const [processed] = await tx.select({ id: stripeWebhookEvents.id }).from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, event.id)).limit(1);
    if (processed) return { duplicate: true };
    let subscriptionId: string | null = null;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        subscriptionId = stripeInvoiceSubscriptionId(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.trial_will_end':
        subscriptionId = (event.data.object as Stripe.Subscription).id;
        break;
      default:
        log({ event: 'stripe_webhook_ignored', stripeEvent: event.type });
    }
    if (subscriptionId) await syncStripeSubscription(await retrieveCurrentStripeSubscription(subscriptionId), { database: tx });
    await tx.insert(stripeWebhookEvents).values({ id: event.id, eventType: event.type });
    return { duplicate: false };
  });
}

