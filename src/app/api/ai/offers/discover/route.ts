import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { requireUserFeature } from '@/lib/permissions';
import { aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { enqueueDiscovery, latestDiscovery } from '@/lib/offer-discovery/service';
import { DiscoveryError } from '@/lib/offer-discovery/types';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'no-store' };

function failure(error: unknown) {
  const usage = aiUsageErrorResponse(error);
  if (usage) return usage;
  if (error instanceof RateLimitError) return NextResponse.json({ error: 'DISCOVERY_RATE_LIMITED', code: 'DISCOVERY_RATE_LIMITED' }, { status: 429, headers });
  if (error instanceof DiscoveryError) return NextResponse.json({ error: error.message, code: error.message }, { status: 503, headers });
  log({ event: 'offer_discovery_request_failed', level: 'error', error });
  return NextResponse.json({ error: 'DISCOVERY_UNAVAILABLE', code: 'DISCOVERY_UNAVAILABLE' }, { status: 503, headers });
}

export async function GET() {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    await requireUserFeature(actor.userId, 'applications');
    return NextResponse.json({ job: await latestDiscovery(actor.userId) }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    await requireUserFeature(actor.userId, 'applications');
    const origin = req.headers.get('origin');
    const requestUrl = new URL(req.url);
    const forwardedProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const protocol = ['http', 'https'].includes(forwardedProtocol || '') ? forwardedProtocol : requestUrl.protocol.slice(0, -1);
    const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || requestUrl.host;
    if (origin && origin !== new URL(`${protocol}://${host}`).origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
    const body = await req.json().catch(() => null);
    if (!body || typeof body.requestId !== 'string' || !UUID.test(body.requestId) || Object.keys(body).some(key => key !== 'requestId')) {
      return NextResponse.json({ error: 'INVALID_REQUEST_ID', code: 'INVALID_REQUEST_ID' }, { status: 400, headers });
    }
    consumeRateLimit(`ai:discovery:${actor.userId}`, 3, 10 * 60_000);
    if (actor.kind === 'guest') {
      const ip = (req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown').slice(0, 64);
      consumeRateLimit(`ai:discovery-ip:${ip}`, 3, 10 * 60_000);
    }
    const job = await enqueueDiscovery(actor.userId, { requestId: body.requestId }, actor.realUserId);
    return NextResponse.json({ jobId: job.id }, { status: 202, headers });
  } catch (error) { return failure(error); }
}
