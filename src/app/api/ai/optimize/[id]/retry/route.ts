import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { consumeRateLimit } from '@/lib/rate-limit';
import { aiRequestId, aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { retryCvOptimization } from '@/lib/cv-optimization/service';
import { isOptimizeModeId, type OptimizeModeId } from '@/lib/optimize-modes';
import { log } from '@/lib/logger';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    consumeRateLimit(`ai:optimize:${actor.userId}`, 8, 10 * 60_000);
    const body = await req.json();
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(params.id) || !Array.isArray(body.modes) || !body.modes.length || body.modes.length > 3 || !body.modes.every((m: unknown) => typeof m === 'string' && isOptimizeModeId(m))) return NextResponse.json({ error: 'Modos inválidos.' }, { status: 400 });
    return NextResponse.json(await retryCvOptimization(actor.userId, params.id, Array.from(new Set(body.modes)) as OptimizeModeId[], aiRequestId(req, body.requestId)), { status: 202 });
  } catch (error) {
    const response = aiUsageErrorResponse(error); if (response) return response;
    log({ event: 'cv_variant_retry_failed', level: 'error', error });
    return NextResponse.json({ error: 'No se pudo iniciar el reintento.' }, { status: 500 });
  }
}
