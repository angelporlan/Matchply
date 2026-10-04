import { NextRequest, NextResponse } from 'next/server';
import { requireBillingContext } from '@/lib/request-context';
import { getBillingIntervalState, scheduleBillingInterval } from '@/lib/billing-interval';
import { BillingError } from '@/lib/billing-service';
import { isTrustedBillingOrigin, readBillingInterval } from '@/lib/billing-policy';
import { log } from '@/lib/logger';

function failure(error: unknown) {
  log({ event: 'stripe_interval_failed', level: 'warn', route: '/api/stripe/interval', error });
  const status = error instanceof BillingError ? error.status : error instanceof Error && 'status' in error ? Number(error.status) : error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
  return NextResponse.json({ error: error instanceof BillingError ? error.code : 'interval_unavailable', message: error instanceof BillingError ? error.message : 'No se pudo gestionar la periodicidad.' }, { status });
}

export async function GET() {
  try { const ctx = await requireBillingContext(); return NextResponse.json(await getBillingIntervalState(ctx.realUser.id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  if (!isTrustedBillingOrigin(req.headers.get('origin'))) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  try {
    const ctx = await requireBillingContext(); const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || !['monthly', 'annual'].includes(body.interval)
      || typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) return NextResponse.json({ error: 'invalid_interval_change' }, { status: 400 });
    return NextResponse.json(await scheduleBillingInterval({ userId: ctx.realUser.id, interval: readBillingInterval(body.interval)!, requestId: body.requestId }));
  } catch (error) { return failure(error); }
}

export const dynamic = 'force-dynamic';
