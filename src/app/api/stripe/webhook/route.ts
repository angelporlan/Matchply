import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { processStripeWebhook } from '@/lib/stripe-webhook';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const started = Date.now();
  if (!STRIPE_WEBHOOK_SECRET) {
    log({ event: 'stripe_webhook_misconfigured', level: 'error', route: '/api/stripe/webhook' });
    return NextResponse.json({ error: 'webhook_unavailable' }, { status: 503 });
  }
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('Stripe-Signature') || '', STRIPE_WEBHOOK_SECRET); }
  catch (error) {
    log({ event: 'stripe_webhook_invalid_signature', level: 'warn', route: '/api/stripe/webhook', error });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }
  try {
    const result = await processStripeWebhook(event);
    log({ event: 'stripe_webhook_processed', route: '/api/stripe/webhook', stripeEvent: event.type, durationMs: Date.now() - started, duplicate: result.duplicate });
    return NextResponse.json({ received: true });
  } catch (error) {
    log({ event: 'stripe_webhook_failed', level: 'error', route: '/api/stripe/webhook', stripeEvent: event.type, durationMs: Date.now() - started, error });
    return NextResponse.json({ error: 'webhook_processing_failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
