import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { db } from '@/db';
import { cvs } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { effectiveSubscriptionStatus } from '@/lib/subscription';
import { beginUsage, consumeUsage, releaseUsage, usageInputHash } from '@/lib/usage';
import { reserveCvTarget } from '@/lib/cv-access';
import { assertCvPublication } from '@/lib/ai-cv-publication';
import { aiRequestId, aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { consumeRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
// @ts-ignore
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  let operationId: string | null = null, targetId: string | null = null, userId: string | null = null;
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
    consumeRateLimit(`ai:import:${userId}`, 8, 10 * 60_000);
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const rawText = form.get('text');
    const targetCvId = typeof form.get('targetCvId') === 'string' ? form.get('targetCvId') as string : undefined;
    const confirmOverwrite = form.get('confirmOverwrite') === 'true';
    let text = '', title = 'Mi Currículum Base';
    if (file) {
      if (typeof file.arrayBuffer !== 'function' || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'El PDF debe ocupar como máximo 10 MB.' }, { status: 413 });
      title = file.name.replace(/\.[^/.]+$/, '');
      try { text = (await pdf(Buffer.from(await file.arrayBuffer()))).text || ''; }
      catch { return NextResponse.json({ error: 'No se pudo leer el archivo PDF. Intenta pegar el texto.' }, { status: 400 }); }
    } else if (typeof rawText === 'string') text = rawText;
    if (!text.trim()) return NextResponse.json({ error: 'Añade un PDF o el texto de tu currículum.' }, { status: 400 });
    const operation = await beginUsage(userId, { bucket: 'general', action: 'import_cv', requestId: aiRequestId(req, form.get('requestId')),
      input: { textHash: usageInputHash(text), title, targetCvId: targetCvId || null, confirmOverwrite },
    });
    if (operation.status === 'consumed') {
      const result = operation.result as { cvId?: string } | null;
      const [saved] = result?.cvId ? await db.select({ id: cvs.id, content: cvs.content }).from(cvs)
        .where(and(eq(cvs.id, result.cvId), eq(cvs.userId, userId))).limit(1) : [];
      if (!saved) return NextResponse.json({ error: 'El resultado guardado ya no existe.', code: 'RESULT_NOT_FOUND' }, { status: 410 });
      return new Response(`${saved.content}\n\n[METADATA:${JSON.stringify({ success: true, cvId: saved.id, replayed: true })}]`, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    operationId = operation.id;
    targetId = await db.transaction(tx => reserveCvTarget(tx, userId!, { targetCvId, confirmOverwrite, operationId: operation.id,
      values: { title, isBase: true, isPrincipal: true, templateName: 'harvard', accentColor: '#1a5f7a', fontFamily: 'helvetica', pageMargin: 36, scale: 1 },
    }));
    const stream = await AIService.importCVStream({ rawText: text, userSubscriptionStatus: effectiveSubscriptionStatus(actor), candidateName: actor.name || '' });
    const reader = stream.getReader(), decoder = new TextDecoder(), encoder = new TextEncoder();
    let cancelled = false;
    const response = new ReadableStream<Uint8Array>({
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
          if (!content.trim()) throw new Error('La IA no devolvió un currículum utilizable.');
          const publishedUserId = await db.transaction(async tx => {
            const ownerId = await assertCvPublication(tx, userId!, targetId!, operation.id);
            await tx.update(cvs).set({ isPrincipal: false, updatedAt: sql`${cvs.updatedAt}` }).where(eq(cvs.userId, ownerId));
            await tx.update(cvs).set({ content, title, isBase: true, isPrincipal: true, pendingUsageOperationId: null, optimizationId: null, activeOptimizeMode: null })
              .where(and(eq(cvs.id, targetId!), eq(cvs.userId, ownerId)));
            await consumeUsage(tx, operation.id, { cvId: targetId });
            return ownerId;
          });
          userId = publishedUserId;
          void createAuditLog(file ? 'cv_import_pdf' : 'cv_import_text', userId!, actor.email, { cvId: targetId, title, isPdf: !!file });
          revalidatePath('/dashboard');
          if (!cancelled) { controller.enqueue(encoder.encode(`\n\n[METADATA:${JSON.stringify({ success: true, cvId: targetId, operationId: operation.id })}]`)); controller.close(); }
        } catch (error) {
          await cleanup();
          log({ event: 'cv_import_stream_failed', level: 'error', userId: userId || undefined, error });
          if (!cancelled) { controller.enqueue(encoder.encode(`\n\n[ERROR:${error instanceof Error ? error.message : 'No se pudo guardar el CV.'}]`)); controller.close(); }
        }
      },
      async cancel() { cancelled = true; await reader.cancel().catch(() => {}); await cleanup(); },
    });
    return new Response(response, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
  } catch (error) {
    await cleanup();
    const response = aiUsageErrorResponse(error); if (response) return response;
    log({ event: 'cv_import_failed', level: 'error', userId: userId || undefined, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo importar el CV.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
