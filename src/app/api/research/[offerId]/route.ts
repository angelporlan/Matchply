import { log } from '@/lib/logger';
import { publicErrorBody } from '@/lib/public-errors';
import { NextResponse } from 'next/server';
import { requireProductContext, auditActorFields } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import { getResearchQuota, getResearchRunForUser, enqueueResearchForOffer } from '@/lib/research/queue';
import { SubscriptionAccessError } from '@/lib/permissions';
import { ApplicationNotFoundError } from '@/lib/application-service';
import { AccountSuspendedError, ImpersonationEndedError, SupportActionBlockedError } from '@/lib/request-errors';
import { aiUsageErrorResponse } from '@/lib/ai-usage-http';

function errorResponse(error: unknown) {
  log({ event: 'research_request_failed', level: 'error', error });
  const response = aiUsageErrorResponse(error); if (response) return response;
  if (error instanceof SubscriptionAccessError) return NextResponse.json(publicErrorBody(error), { status: error.status });
  if (error instanceof ApplicationNotFoundError) return NextResponse.json(publicErrorBody('OFFER_NOT_FOUND'), { status: 404 });
  if (error instanceof AccountSuspendedError || error instanceof ImpersonationEndedError || error instanceof SupportActionBlockedError) {
    return NextResponse.json(publicErrorBody(error), { status: error.status });
  }
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json(publicErrorBody('AUTH_REQUIRED'), { status: 401 });
  }
  return NextResponse.json({ ...publicErrorBody(error) }, { status: 500 });
}

async function currentUser() {
  const ctx = await requireProductContext({ feature: 'deepResearch' });
  return ctx.effectiveUser ? { id: ctx.effectiveUser.id, email: ctx.effectiveUser.email || null, ctx } : null;
}

export async function GET(_req: Request, { params }: { params: { offerId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json(publicErrorBody('AUTH_REQUIRED'), { status: 401 });
    const [research, quota] = await Promise.all([
      getResearchRunForUser(user.id, params.offerId),
      getResearchQuota(user.id),
    ]);
    if (!research) return NextResponse.json({ research: null, quota });
    return NextResponse.json({ research, quota });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: { offerId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json(publicErrorBody('AUTH_REQUIRED'), { status: 401 });
    const body = await req.json().catch(() => ({}));
    const research = await enqueueResearchForOffer(user.id, params.offerId, {
      trigger: 'dashboard',
      retryFailed: body?.retry === true,
    });
    if (!research.accepted) return NextResponse.json({
      error: 'Has agotado las acciones de IA de este mes.', code: 'QUOTA_EXCEEDED', bucket: 'general',
      usage: await getResearchQuota(user.id), research,
    }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
    await createAuditLog('research_requested', user.id, user.email, {
      offerId: params.offerId,
      runId: research.run?.id || null,
      status: research.status,
    }, auditActorFields(user.ctx));
    return NextResponse.json({
      accepted: research.accepted,
      runId: research.run?.id || null,
      status: research.status,
      research,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
