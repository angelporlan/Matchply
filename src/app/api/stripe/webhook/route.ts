import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

async function syncSubscription(subscription: Stripe.Subscription) {
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

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('Stripe-Signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
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
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription;

        if (typeof subscriptionId === 'string') {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription;

        if (typeof subscriptionId === 'string') {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
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
        console.log(`Unhandled Stripe Webhook Event Type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook processing error:', error);
    return new NextResponse('Webhook processing failed', { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
