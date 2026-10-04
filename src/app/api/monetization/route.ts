import { NextRequest, NextResponse } from 'next/server';
import { requireProductContext } from '@/lib/request-context';
import { getPaywallPresentation, recordMonetizationEvent, MONETIZATION_CLIENT_EVENTS, monetizationClientEventId, type MonetizationClientEvent } from '@/lib/monetization';
import { log } from '@/lib/logger';
import { isTrustedBillingOrigin } from '@/lib/billing-policy';

export async function GET() {
  try {
    const ctx = await requireProductContext({ allowGuest: true });
    if (!ctx.effectiveUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json(await getPaywallPresentation(ctx.effectiveUser.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: 'unauthorized' }, { status: error instanceof Error && 'status' in error ? Number(error.status) : 401 });
  }
}

export async function POST(req: NextRequest) {
  if (!isTrustedBillingOrigin(req.headers.get('origin'))) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  try {
    const ctx = await requireProductContext({ allowGuest: true });
    if (!ctx.effectiveUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (ctx.impersonation) return NextResponse.json({ received: true });
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
    if (!MONETIZATION_CLIENT_EVENTS.includes(body.event) || typeof body.source !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.source)
      || (body.requestId !== undefined && (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.requestId)))) {
      return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
    }
    await recordMonetizationEvent({ userId: ctx.effectiveUser.id, event: body.event as MonetizationClientEvent, source: body.source, externalId: monetizationClientEventId(ctx.effectiveUser.id, body.requestId) });
    return NextResponse.json({ received: true });
  } catch (error) {
    log({ event: 'monetization_event_failed', level: 'warn', error });
    return NextResponse.json({ error: 'event_unavailable' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
