import { NextResponse } from 'next/server';
import { getActor, type RequestActor } from '@/lib/actor';
import { assertPublicOfferUrl } from '@/lib/offer-import/public-page';
import { enqueueImportOfferJob } from '@/lib/ai-jobs/queue';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { AccountSuspendedError, ActorEpochMismatchError, ImpersonationEndedError, SupportActionBlockedError } from '@/lib/request-errors';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let actor: RequestActor | null;
  try { actor = await getActor({ allowGuest: true }); }
  catch (error) {
    if (error instanceof AccountSuspendedError || error instanceof ActorEpochMismatchError ||
        error instanceof ImpersonationEndedError || error instanceof SupportActionBlockedError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    log({ event: 'offer_import_actor_unavailable', level: 'error' });
    return NextResponse.json({ error: 'OFFER_IMPORT_UNAVAILABLE' }, { status: 503 });
  }
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Cookie-authenticated requests must originate from this site.
  const origin = req.headers.get('origin');
  const requestUrl = new URL(req.url);
  const forwardedProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = ['http', 'https'].includes(forwardedProtocol || '') ? forwardedProtocol : requestUrl.protocol.slice(0, -1);
  let expectedOrigin: string;
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || requestUrl.host;
  try { expectedOrigin = new URL(`${protocol}://${host}`).origin; }
  catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  if (origin && origin !== expectedOrigin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.url !== 'string' || body.url.length > 2_000 ||
      typeof body.requestId !== 'string' || !UUID.test(body.requestId)) {
    return NextResponse.json({ error: 'OFFER_URL_INVALID' }, { status: 400 });
  }
  let url: string;
  try { url = assertPublicOfferUrl(body.url).toString(); }
  catch { return NextResponse.json({ error: 'OFFER_URL_INVALID' }, { status: 400 }); }
  try {
    consumeRateLimit(`ai:offer-import:${actor.userId}`, 8, 10 * 60_000);
    if (actor.kind === 'guest') {
      // The edge proxy supplies real-ip or appends the connecting client to the chain.
      const ip = (req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown').slice(0, 64);
      consumeRateLimit(`ai:offer-import-ip:${ip}`, 8, 10 * 60_000);
    }
    const job = await enqueueImportOfferJob(actor.userId, { url, requestId: body.requestId }, actor.realUserId);
    return NextResponse.json({ jobId: job.id }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'OFFER_RATE_LIMITED' }, { status: 429 });
    if (error instanceof Error && error.message === 'OFFER_REQUEST_CONFLICT') return NextResponse.json({ error: error.message }, { status: 409 });
    log({ event: 'offer_import_enqueue_failed', level: 'error', userId: actor.userId });
    return NextResponse.json({ error: 'OFFER_IMPORT_UNAVAILABLE' }, { status: 503 });
  }
}
