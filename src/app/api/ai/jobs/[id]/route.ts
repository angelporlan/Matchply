import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { ExternalAuthError, resolveExternalUser } from '@/lib/external-auth';
import { getAiJobForUser } from '@/lib/ai-jobs/queue';

export const dynamic = 'force-dynamic';

async function resolveUserId(req: NextRequest) {
  const actor = await getActor({ allowGuest: true });
  if (actor) return actor.userId;
  try {
    const user = await resolveExternalUser(req);
    return user.id;
  } catch (error) {
    if (error instanceof ExternalAuthError && error.status === 401) return null;
    throw error;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await getAiJobForUser(userId, params.id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      kind: job.kind,
      status: job.status,
      result: job.result,
      lastError: job.lastError,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (error: any) {
    if (error instanceof ExternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
