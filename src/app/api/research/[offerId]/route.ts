import { NextResponse } from 'next/server';
import { requireProductContext, auditActorFields } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import { getResearchQuota, getResearchRunForUser, enqueueResearchForOffer } from '@/lib/research/queue';
import { SubscriptionAccessError } from '@/lib/permissions';
import { ApplicationNotFoundError } from '@/lib/application-service';
import { AccountSuspendedError, ImpersonationEndedError, SupportActionBlockedError } from '@/lib/request-errors';

function errorResponse(error: unknown) {
  if (error instanceof SubscriptionAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ApplicationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof AccountSuspendedError || error instanceof ImpersonationEndedError || error instanceof SupportActionBlockedError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
}

async function currentUser() {
  const ctx = await requireProductContext({ feature: 'deepResearch' });
  return ctx.effectiveUser ? { id: ctx.effectiveUser.id, email: ctx.effectiveUser.email || null, ctx } : null;
}

export async function GET(_req: Request, { params }: { params: { offerId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const research = await enqueueResearchForOffer(user.id, params.offerId, {
      trigger: 'dashboard',
      retryFailed: body?.retry === true,
    });
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
