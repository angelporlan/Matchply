import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getAiJobForUser } from '@/lib/ai-jobs/queue';
import { readCurrentMatchBatchResult } from '@/lib/ai-jobs/match-batch-progress';
import { requireUserFeature } from '@/lib/permissions';

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

    if (job.kind === 'match_batch') {
      try { await requireUserFeature(actor.userId, 'applications'); }
      catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
    }

    return NextResponse.json({
      id: job.id,
      kind: job.kind,
      status: job.status,
      result: job.kind === 'match_batch' ? await readCurrentMatchBatchResult(job) : job.result,
      lastError: job.lastError,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
