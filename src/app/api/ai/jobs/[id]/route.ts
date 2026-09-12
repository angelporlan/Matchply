import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getAiJobForUser } from '@/lib/ai-jobs/queue';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await getAiJobForUser(actor.userId, params.id);
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
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
