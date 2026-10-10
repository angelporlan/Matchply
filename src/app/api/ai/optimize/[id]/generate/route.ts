import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { consumeRateLimit } from '@/lib/rate-limit';
import { aiRequestId, aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { generateCvOptimizationMode } from '@/lib/cv-optimization/service';
import { isOptimizeModeId } from '@/lib/optimize-modes';
import { log } from '@/lib/logger';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    consumeRateLimit(`ai:optimize:${actor.userId}`, 8, 10 * 60_000);
    const body = await req.json();
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(params.id) || typeof body.mode !== 'string' || !isOptimizeModeId(body.mode)) return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 });
    return NextResponse.json(await generateCvOptimizationMode(actor.userId, params.id, body.mode, aiRequestId(req, body.requestId)), { status: 202 });
  } catch (error) {
    const response = aiUsageErrorResponse(error); if (response) return response;
    log({ event: 'cv_variant_admission_failed', level: 'error', error });
    return NextResponse.json({ error: 'No se pudo iniciar esta versión.' }, { status: 500 });
  }
}
