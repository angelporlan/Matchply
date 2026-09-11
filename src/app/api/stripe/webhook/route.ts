import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import Stripe from 'stripe';
import { syncStripeSubscription } from '@/lib/stripe-subscription-sync';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const started = Date.now();
  const body = await req.text();
  const signature = req.headers.get('Stripe-Signature') || '';
  const webhookSecret = STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    log({ event: 'stripe_webhook_misconfigured', level: 'error', route: '/api/stripe/webhook' });
    return new NextResponse('Stripe webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    log({ event: 'stripe_webhook_invalid_signature', level: 'warn', route: '/api/stripe/webhook', error: err });
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription;

        if (typeof subscriptionId === 'string') {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncStripeSubscription(subscription);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription;

        if (typeof subscriptionId === 'string') {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncStripeSubscription(subscription);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await db
          .update(users)
          .set({
            stripeSubscriptionId: null,
            subscriptionStatus: 'canceled',
          })
          .where(eq(users.stripeSubscriptionId, subscription.id));
        break;
      }

      default:
        log({ event: 'stripe_webhook_ignored', route: '/api/stripe/webhook', stripeEvent: event.type });
    }

    log({
      event: 'stripe_webhook_processed',
      route: '/api/stripe/webhook',
      stripeEvent: event.type,
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ received: true });
  } catch (error: any) {
    log({
      event: 'stripe_webhook_failed',
      level: 'error',
      route: '/api/stripe/webhook',
      stripeEvent: event.type,
      durationMs: Date.now() - started,
      error,
    });
    return new NextResponse('Webhook processing failed', { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
