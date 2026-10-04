import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { canAccessFeature, getAllowedCvTemplate, effectiveSubscriptionStatus, userEntitlements } from '@/lib/subscription';
import { formatCareerProfileContext } from '@/lib/profile-classification';
import { consumeRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { findOrCreateCompany } from '@/lib/company-service';
import { resolveOfferIdentity } from '@/lib/offer-fields';
import { beginUsage, consumeUsage, releaseUsage } from '@/lib/usage';
import { requireEditableCv, reserveCvTarget } from '@/lib/cv-access';
import { recordFirstValue } from '@/lib/monetization';
import { assertCvPublication } from '@/lib/ai-cv-publication';
import { aiRequestId, aiUsageErrorResponse, AiUsageHttpError } from '@/lib/ai-usage-http';

export async function POST(req: NextRequest) {
  let operationId: string | null = null;
  let targetId: string | null = null;
  let userId: string | null = null;
  const cleanup = async () => {
    if (!operationId) return;
    await db.transaction(async tx => {
      await releaseUsage(tx, operationId!);
      if (targetId) await tx.delete(cvs).where(and(eq(cvs.id, targetId), eq(cvs.pendingUsageOperationId, operationId!), eq(cvs.content, '')));
      if (targetId) await tx.update(cvs).set({ pendingUsageOperationId: null }).where(and(eq(cvs.id, targetId), eq(cvs.pendingUsageOperationId, operationId!)));
    });
  };
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return new NextResponse('Unauthorized', { status: 401 });
    userId = actor.userId;
    consumeRateLimit(`ai:optimize:${userId}`, 8, 10 * 60_000);
    const body = await req.json();
    const { baseCvId, jobTitle, company, url, platform, jobDescription, promptId, modeId, addToApplications = true, targetCvId, confirmOverwrite } = body;
    const description = typeof jobDescription === 'string' ? jobDescription.trim() : '';
    if (typeof baseCvId !== 'string' || !description) return new NextResponse('Missing required fields', { status: 400 });
    const { requestId: _requestId, ...input } = body;
    const operation = await beginUsage(userId, { bucket: 'general', requestId: aiRequestId(req, body.requestId), action: 'optimize_cv', input });
    if (operation.status === 'consumed') {
      const result = operation.result as { cvId?: string } | null;
      const [saved] = result?.cvId ? await db.select({ id: cvs.id, content: cvs.content }).from(cvs)
        .where(and(eq(cvs.id, result.cvId), eq(cvs.userId, userId))).limit(1) : [];
      if (!saved) return NextResponse.json({ error: 'El resultado guardado ya no existe.', code: 'RESULT_NOT_FOUND' }, { status: 410 });
      return new Response(`${saved.content}\n\n[METADATA:${JSON.stringify({ success: true, cvId: saved.id, replayed: true })}]`, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    operationId = operation.id;
    const [[user], [baseCv]] = await Promise.all([
      db.select({ id: users.id, email: users.email, name: users.name, subscriptionStatus: users.subscriptionStatus,
        isGuest: users.isGuest, proGrantedUntil: users.proGrantedUntil, careerProfile: users.careerProfile,
      }).from(users).where(eq(users.id, userId)).limit(1),
      db.select({ id: cvs.id, userId: cvs.userId, content: cvs.content, templateName: cvs.templateName, accentColor: cvs.accentColor,
        fontFamily: cvs.fontFamily, pageMargin: cvs.pageMargin, scale: cvs.scale,
      }).from(cvs).where(and(eq(cvs.id, baseCvId), eq(cvs.userId, userId))).limit(1),
    ]);
    if (!user || !baseCv) throw new AiUsageHttpError(404, 'CV_NOT_FOUND', 'El CV de origen ya no está disponible.');

    const identity = resolveOfferIdentity({ jobTitle: typeof jobTitle === 'string' ? jobTitle : '', company: typeof company === 'string' ? company : '', jobDescription: description });
    const allowedTemplate = getAllowedCvTemplate(user.subscriptionStatus, baseCv.templateName, userEntitlements(user));
    targetId = await db.transaction(async tx => {
      await requireEditableCv(tx, userId!, baseCvId);
      if (targetCvId) {
        const target = await requireEditableCv(tx, userId!, targetCvId);
        if (target.isBase) throw new AiUsageHttpError(403, 'BASE_CV_PROTECTED', 'Elige una versión adaptada como destino para conservar tu CV base.');
      }
      return reserveCvTarget(tx, userId!, { baseCvId, targetCvId, confirmOverwrite: confirmOverwrite === true, operationId: operation.id,
        values: { title: `Optimizado - ${identity.jobTitle} (${identity.company})`, isBase: false, isPrincipal: false,
          templateName: allowedTemplate, accentColor: baseCv.accentColor, fontFamily: baseCv.fontFamily, pageMargin: baseCv.pageMargin, scale: baseCv.scale },
      });
    });
    const aiStream = await AIService.optimizeCVStream({ baseCvMarkdown: baseCv.content, jobDescription: description,
      userSubscriptionStatus: effectiveSubscriptionStatus(user), promptId: modeId || promptId, modeId: modeId || promptId,
      candidateName: user.name || '', careerProfileContext: formatCareerProfileContext(user.careerProfile),
    });
    const reader = aiStream.getReader();
    const decoder = new TextDecoder(); const encoder = new TextEncoder();
    let cancelled = false;
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let content = '';
        try {
          while (!cancelled) {
            const chunk = await reader.read(); if (chunk.done) break;
            content += decoder.decode(chunk.value, { stream: true });
            if (!cancelled) controller.enqueue(chunk.value);
          }
          content += decoder.decode();
          if (cancelled || req.signal.aborted) throw new Error('AI_REQUEST_CANCELLED');
          if (!content.trim()) throw new Error('La IA no ha devuelto un currículum utilizable.');
          const publishedUserId = await db.transaction(async tx => {
            const ownerId = await assertCvPublication(tx, userId!, targetId!, operation.id);
            await tx.update(cvs).set({ content, title: `Optimizado - ${identity.jobTitle} (${identity.company})`,
              templateName: allowedTemplate, pendingUsageOperationId: null,
            }).where(and(eq(cvs.id, targetId!), eq(cvs.userId, ownerId)));
            if (Boolean(addToApplications) && canAccessFeature(user.subscriptionStatus, 'applications', userEntitlements(user))) {
              const companyRecord = await findOrCreateCompany(ownerId, identity.company, tx);
              const [existing] = await tx.select({ id: jobOffers.id }).from(jobOffers).where(and(eq(jobOffers.userId, ownerId), eq(jobOffers.cvId, targetId!))).limit(1);
              if (!existing) await tx.insert(jobOffers).values({ userId: ownerId, cvId: targetId!, title: identity.jobTitle,
                company: companyRecord?.name || identity.company, companyId: companyRecord?.id || null,
                url: url || null, platform: platform || 'other', description, status: 'interested' });
            }
            await consumeUsage(tx, operation.id, { cvId: targetId });
            await recordFirstValue(ownerId, tx);
            return ownerId;
          });
          userId = publishedUserId;
          void createAuditLog('cv_optimize_ai', userId!, user.email, { baseCvId, optimizedCvId: targetId, jobTitle: identity.jobTitle, company: identity.company });
          revalidatePath('/dashboard');
          if (!cancelled) { controller.enqueue(encoder.encode(`\n\n[METADATA:${JSON.stringify({ success: true, cvId: targetId, operationId: operation.id })}]`)); controller.close(); }
        } catch (error) {
          await cleanup();
          log({ event: 'cv_optimize_stream_failed', level: 'error', userId: userId || undefined, error });
          if (!cancelled) { controller.enqueue(encoder.encode(`\n\n[ERROR:${error instanceof Error ? error.message : 'No se pudo guardar el CV.'}]`)); controller.close(); }
        }
      },
      async cancel() { cancelled = true; await reader.cancel().catch(() => {}); await cleanup(); },
    });
    return new Response(responseStream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
  } catch (error) {
    await cleanup();
    const response = aiUsageErrorResponse(error); if (response) return response;
    log({ event: 'cv_optimize_failed', level: 'error', userId: userId || undefined, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo adaptar el CV.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
