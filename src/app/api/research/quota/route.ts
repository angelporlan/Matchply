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
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
}
