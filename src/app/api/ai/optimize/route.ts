import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { consumeRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { resolveOfferIdentity } from '@/lib/offer-fields';
import { aiRequestId, aiUsageErrorResponse, AiUsageHttpError } from '@/lib/ai-usage-http';
import { enqueueCvOptimization } from '@/lib/cv-optimization/service';
import { randomUUID } from 'node:crypto';

export async function POST(req: NextRequest) {
  let requestId: string = randomUUID();
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) throw new AiUsageHttpError(401, 'AUTH_REQUIRED', 'Tu sesión ha terminado. Vuelve a entrar para continuar.');
    consumeRateLimit(`ai:optimize:${actor.userId}`, 8, 10 * 60_000);
    const body = await req.json();
    requestId = aiRequestId(req, body.requestId);
    const description = typeof body.jobDescription === 'string' ? body.jobDescription.trim() : '';
    const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
    if (typeof body.baseCvId !== 'string' || !uuid.test(body.baseCvId) || !description || description.length > 120_000 || (body.targetCvId && !uuid.test(body.targetCvId)) || (body.jobOfferId && !uuid.test(body.jobOfferId))) throw new AiUsageHttpError(400, 'INVALID_OPTIMIZE_INPUT', 'Selecciona un CV y una oferta válidos.');
    const identity = resolveOfferIdentity({ jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : '', company: typeof body.company === 'string' ? body.company : '', jobDescription: description });
    const result = await enqueueCvOptimization(actor.userId, { baseCvId: body.baseCvId, targetCvId: body.targetCvId,
      confirmOverwrite: body.confirmOverwrite === true, requestId, ...identity, jobDescription: description,
      url: typeof body.url === 'string' ? body.url : null, platform: ['linkedin','infojobs','indeed','other'].includes(body.platform) ? body.platform : 'other', addToApplications: body.addToApplications !== false, jobOfferId: body.jobOfferId });
    log({ event: 'cv_optimize_admitted', requestId, jobId: result.jobId, userId: actor.userId, route: '/api/ai/optimize' });
    return NextResponse.json({ ...result, requestId }, { status: 202, headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId } });
  } catch (error) {
    log({ event: 'cv_optimize_admission_failed', requestId, route: '/api/ai/optimize', level: 'error', error });
    const response = aiUsageErrorResponse(error);
    if (response) { response.headers.set('x-request-id', requestId); return response; }
    return NextResponse.json({ error: 'No se pudo iniciar la optimización. Puedes reintentar.', requestId }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
export const dynamic = 'force-dynamic';
