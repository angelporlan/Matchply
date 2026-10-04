import { NextRequest, NextResponse } from 'next/server';
import { requireBillingContext } from '@/lib/request-context';
import { getOwnedCheckoutSession, BillingError } from '@/lib/billing-service';
import { retrieveCurrentStripeSubscription, syncStripeSubscription } from '@/lib/stripe-subscription-sync';
import { stripeSubscriptionPeriodEnd, subscriptionHasConfirmedAccess } from '@/lib/billing-policy';
import { log } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireBillingContext();
    const session = await getOwnedCheckoutSession(ctx.realUser.id, req.nextUrl.searchParams.get('session_id') || '');
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return NextResponse.json({ status: 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
    const subscription = await retrieveCurrentStripeSubscription(subscriptionId);
    await syncStripeSubscription(subscription, { recordConversions: false });
    return NextResponse.json({
      status: subscriptionHasConfirmedAccess(subscription) ? subscription.status : subscription.status === 'canceled' ? 'canceled' : 'pending',
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1_000).toISOString() : null,
      currentPeriodEnd: stripeSubscriptionPeriodEnd(subscription)?.toISOString() || null,
      interval: subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'annual' : 'monthly',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    log({ event: 'stripe_checkout_status_failed', level: 'warn', error });
    return NextResponse.json({ error: error instanceof BillingError ? error.code : 'status_unavailable' }, { status: error instanceof BillingError ? error.status : 400 });
  }
}

export const dynamic = 'force-dynamic';
