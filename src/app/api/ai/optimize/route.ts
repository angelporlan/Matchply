import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import {
  canAccessFeature,
  canCreateCv,
  getAllowedCvTemplate,
} from '@/lib/subscription';

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = actor.userId;
    const body = await req.json();
    const {
      baseCvId,
      jobTitle,
      company,
      url,
      platform,
      jobDescription,
      promptId,
      addToKanban = true,
      targetCvId: requestedTargetCvId,
    } = body;

    if (!baseCvId || !jobTitle || !company || !jobDescription) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // 1. Obtener usuario para comprobar suscripción
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // 2. Obtener CV Base
    const [baseCv] = await db
      .select()
      .from(cvs)
      .where(eq(cvs.id, baseCvId))
      .limit(1);

    if (!baseCv) {
      return new NextResponse('Base CV not found', { status: 404 });
    }

    if (baseCv.userId !== userId) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    let targetCvId = requestedTargetCvId as string | null | undefined;
    if (!targetCvId) {
      const existingCvs = await db
        .select({ id: cvs.id })
        .from(cvs)
        .where(eq(cvs.userId, userId));

      if (!canCreateCv(user.subscriptionStatus, existingCvs.length, { isGuest: user.isGuest })) {
        if (user.isGuest) {
          return new NextResponse('Guest CV limit reached', { status: 403 });
        }

        // La optimización básica de Free sustituye su único CV en lugar de
        // crear una segunda versión guardada.
        targetCvId = baseCv.id;
      }
    }

    if (targetCvId) {
      const [targetCv] = await db
        .select({ id: cvs.id, userId: cvs.userId })
        .from(cvs)
        .where(eq(cvs.id, targetCvId))
        .limit(1);

      if (!targetCv || targetCv.userId !== userId) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const allowedTemplate = getAllowedCvTemplate(
      user.subscriptionStatus,
      baseCv.templateName,
      { isGuest: user.isGuest },
    );
    const shouldAddToKanban = Boolean(addToKanban)
      && canAccessFeature(user.subscriptionStatus, 'kanban', { isGuest: user.isGuest });
    const shouldSavePartialResult = Boolean(targetCvId) && targetCvId !== baseCv.id;

    // 3. Obtener el stream de IA
    const aiStream = await AIService.optimizeCVStream({
      baseCvMarkdown: baseCv.content,
      jobDescription: jobDescription,
      userSubscriptionStatus: user.subscriptionStatus,
      promptId: promptId,
      candidateName: user.name || ''
    });

    const reader = aiStream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const responseStream = new ReadableStream({
      async start(controller) {
        let accumulatedContent = '';
        let lastWriteTime = Date.now();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            accumulatedContent += text;
            controller.enqueue(value);

            // Guardar parcialmente en la base de datos de manera no bloqueante cada 3 segundos
            const now = Date.now();
            if (now - lastWriteTime > 3000) {
              lastWriteTime = now;
              if (targetCvId && shouldSavePartialResult) {
                await db.update(cvs)
                  .set({ content: accumulatedContent })
                  .where(eq(cvs.id, targetCvId))
                  .catch(err => console.error("[Optimize API] Error saving partial stream to DB:", err));
              }
            }
          }

          // 4. Guardar CV Optimizado
          let optimizedCvId = '';
          if (targetCvId) {
            await db
              .update(cvs)
              .set({
                content: accumulatedContent,
                title: `Optimizado - ${jobTitle} (${company})`,
                templateName: allowedTemplate,
              })
              .where(eq(cvs.id, targetCvId));
            optimizedCvId = targetCvId;
          } else {
            const [optimizedCv] = (await db
              .insert(cvs)
              .values({
                userId: userId,
                title: `Optimizado - ${jobTitle} (${company})`,
                content: accumulatedContent,
                isBase: false,
                templateName: allowedTemplate,
                accentColor: baseCv.accentColor,
                fontFamily: baseCv.fontFamily,
                pageMargin: baseCv.pageMargin,
                scale: baseCv.scale
              })
              .returning()) as any[];
            optimizedCvId = optimizedCv.id;
          }

          // Log de auditoría para optimización por IA
          await createAuditLog("cv_optimize_ai", userId, user.email, {
            baseCvId,
            optimizedCvId: optimizedCvId,
            jobTitle,
            company,
            platform,
            addToKanban: shouldAddToKanban,
          });

          // 5. Guardar Candidatura en Kanban
          if (shouldAddToKanban) {
            const [existingOffer] = await db
              .select()
              .from(jobOffers)
              .where(eq(jobOffers.cvId, optimizedCvId))
              .limit(1);

            if (!existingOffer) {
              await db.insert(jobOffers).values({
                userId: userId,
                cvId: optimizedCvId,
                title: jobTitle,
                company: company,
                url: url || null,
                platform: platform || 'other',
                description: jobDescription,
                status: 'interested'
              });
            }
          }

          revalidatePath('/dashboard');

          // Enviar metadatos al cliente para que sepa el cvId de redirección
          const metaString = `\n\n[METADATA:{"success":true,"cvId":"${optimizedCvId}"}]`;
          controller.enqueue(encoder.encode(metaString));
          controller.close();
        } catch (error: any) {
          console.error("Error en streaming/DB save de optimize CV:", error);
          const errString = `\n\n[ERROR:${error.message || 'Error guardando datos del CV'}]`;
          controller.enqueue(encoder.encode(errString));
          controller.close();
        }
      },
      cancel() {
        reader.cancel();
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    });
  } catch (error: any) {
    console.error('Error in optimization route:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
