import { NextRequest, NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/request-context';
import { getMonetizationMetrics } from '@/lib/monetization';
import { log } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    await requireAdminContext();
    const raw = req.nextUrl.searchParams.get('version');
    const version = raw ? Number(raw) : undefined;
    if (version !== undefined && (!Number.isSafeInteger(version) || version < 1 || version > 1_000_000)) return NextResponse.json({ error: 'invalid_experiment_version' }, { status: 400 });
    return NextResponse.json(await getMonetizationMetrics(version), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    log({ event: 'monetization_metrics_failed', level: 'warn', error });
    return NextResponse.json({ error: 'metrics_unavailable' }, { status: error instanceof Error && 'status' in error ? Number(error.status) : 500 });
  }
}

export const dynamic = 'force-dynamic';
