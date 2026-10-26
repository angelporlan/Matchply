import { publicErrorBody } from '@/lib/public-errors';
import { log } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { requireProductContext } from '@/lib/request-context';
import { getResearchQuota } from '@/lib/research/queue';
import { SubscriptionAccessError } from '@/lib/permissions';

export async function GET() {
  try {
    const ctx = await requireProductContext({ feature: 'deepResearch' });
    return NextResponse.json({ quota: await getResearchQuota(ctx.effectiveUser!.id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return NextResponse.json(publicErrorBody(error), { status: error.status });
    }
    log({ event: 'research_quota_failed', level: 'error', error });
    const unauthorized = error instanceof Error && error.message === 'Unauthorized';
    return NextResponse.json(publicErrorBody(error), { status: unauthorized ? 401 : 500 });
  }
}
