import { NextRequest, NextResponse } from 'next/server';
import { requireProductContext, auditActorFields } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { SubscriptionAccessError } from '@/lib/permissions';
import { enqueueNetworking } from '@/lib/people/ai';
import { id, choice } from '@/lib/people/validation';
import { NETWORKING_ACTIONS, PeopleError, type NetworkingPayload } from '@/lib/people/types';
import { log } from '@/lib/logger';
import { aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { AccountSuspendedError, ActorEpochMismatchError, ImpersonationEndedError, SupportActionBlockedError } from '@/lib/request-errors';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireProductContext({ allowGuest: true, feature: 'networking' });
    const origin = req.headers.get('origin');
    const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.nextUrl.protocol.slice(0, -1);
    const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || req.nextUrl.host;
    let expectedOrigin: string;
    try { expectedOrigin = new URL(`${protocol}://${host}`).origin; } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
    if (origin && origin !== expectedOrigin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const userId = ctx.effectiveUser!.id;
    if (Number(req.headers.get('content-length')) > 8000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    const body = await req.json();
    if (!body || typeof body !== 'object' || JSON.stringify(body).length > 8000) throw new PeopleError('PEOPLE_INVALID_REQUEST');
    if (!NETWORKING_ACTIONS.includes(body.action)) throw new PeopleError('PEOPLE_INVALID_CHOICE');
    const payload: NetworkingPayload = { personId: id(body.personId), requestId: id(body.requestId), action: choice(body.action, NETWORKING_ACTIONS, 'next_step') };
    if (body.threadId) payload.threadId = id(body.threadId);
    if (body.importId) payload.importId = id(body.importId);
    if (body.offerId) payload.offerId = id(body.offerId);
    if (body.includeCandidate !== undefined) { if (typeof body.includeCandidate !== 'boolean') throw new PeopleError('PEOPLE_INVALID_REQUEST'); payload.includeCandidate = body.includeCandidate; }
    if (payload.action === 'parse_conversation' && (!payload.importId || !payload.threadId)) throw new PeopleError('PEOPLE_REQUIRED');
    consumeRateLimit(`networking:${userId}`, 6, 60000);
    const job = await enqueueNetworking(userId, payload, ctx.realUser?.id || userId);
    void createAuditLog('networking_enqueued', userId, null, { personId: payload.personId, jobId: job.id, action: payload.action }, auditActorFields(ctx));
    return NextResponse.json({ jobId: job.id }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const usageError = aiUsageErrorResponse(error); if (usageError) return usageError;
    if (error instanceof AccountSuspendedError || error instanceof ActorEpochMismatchError || error instanceof ImpersonationEndedError || error instanceof SupportActionBlockedError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof PeopleError || error instanceof RateLimitError || error instanceof SubscriptionAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'PEOPLE_INVALID_REQUEST' }, { status: 400 });
    if (error instanceof Error && error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    log({ event: 'networking_enqueue_failed', level: 'error' });
    return NextResponse.json({ error: 'NETWORKING_UNAVAILABLE' }, { status: 500 });
  }
}
