import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireBillingContext } from '@/lib/request-context';
import { createUserCheckout, BillingError } from '@/lib/billing-service';
import { readBillingInterval, isTrustedBillingOrigin } from '@/lib/billing-policy';
import { log } from '@/lib/logger';

/** Preserve bookmarked/auth-intent URLs without creating billing resources on GET. */
export function GET(req: NextRequest) {
  const target = new URL('/dashboard/subscription', req.url);
  for (const key of ['source', 'interval', 'template']) {
    const value = req.nextUrl.searchParams.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,64}$/.test(value)) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}

export async function POST(req: NextRequest) {
  if (!isTrustedBillingOrigin(req.headers.get('origin'))) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  try {
    const ctx = await requireBillingContext();
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'invalid_checkout' }, { status: 400 });
    const interval = readBillingInterval(body.interval);
    if (!interval || (body.source !== undefined && (typeof body.source !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.source)))
      || (body.requestId !== undefined && (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)))
      || (body.returnTo !== undefined && typeof body.returnTo !== 'string')) return NextResponse.json({ error: 'invalid_checkout' }, { status: 400 });
    return NextResponse.json(await createUserCheckout({ userId: ctx.realUser.id, interval, source: body.source, returnTo: body.returnTo, requestId: body.requestId || randomUUID() }));
  } catch (error) {
    log({ event: 'stripe_checkout_failed', level: 'warn', route: '/api/stripe/checkout', error });
    if (error instanceof BillingError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    const status = error instanceof Error && 'status' in error ? Number(error.status) : error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'checkout_unavailable', message: 'No se pudo abrir la compra.' }, { status });
  }
}

export const dynamic = 'force-dynamic';
