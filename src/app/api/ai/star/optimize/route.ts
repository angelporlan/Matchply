import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const {
      baseCvId,
      jobTitle,
      company,
      url,
      platform,
      jobDescription,
      missingKeywords,
      redFlags,
      addToKanban = true,
      targetCvId
    } = body;

    if (!baseCvId || !jobTitle || !company || !jobDescription || !missingKeywords || !redFlags || !targetCvId) {
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

    // 3. Obtener el stream de IA
    const aiStream = await AIService.optimizeSTARStream({
      cvMarkdown: baseCv.content,
      jobDescription: jobDescription,
      company: company,
      jobTitle: jobTitle,
      missingKeywords: missingKeywords,
      redFlags: redFlags,
      userSubscriptionStatus: user.subscriptionStatus,
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

            // Guardar parcialmente en la base de datos cada 3 segundos
            const now = Date.now();
            if (now - lastWriteTime > 3000) {
              lastWriteTime = now;
              await db.update(cvs)
                .set({ content: accumulatedContent })
                .where(eq(cvs.id, targetCvId))
                .catch(err => console.error("[STAR Optimize API] Error saving partial stream to DB:", err));
            }
          }

          // 4. Guardar CV Optimizado Final
          await db
            .update(cvs)
            .set({
              content: accumulatedContent,
              title: `Optimizado STAR - ${jobTitle} (${company})`
            })
            .where(eq(cvs.id, targetCvId));

          // Log de auditoría para optimización por IA STAR
          await createAuditLog("cv_optimize_ai_star", userId, user.email, {
            baseCvId,
            optimizedCvId: targetCvId,
            jobTitle,
            company,
            platform,
            addToKanban
          });

          // 5. Guardar Candidatura en Kanban
          if (addToKanban) {
            const [existingOffer] = await db
              .select()
              .from(jobOffers)
              .where(eq(jobOffers.cvId, targetCvId))
              .limit(1);

            if (!existingOffer) {
              await db.insert(jobOffers).values({
                userId: userId,
                cvId: targetCvId,
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
          const metaString = `\n\n[METADATA:{"success":true,"cvId":"${targetCvId}"}]`;
          controller.enqueue(encoder.encode(metaString));
          controller.close();
        } catch (error: any) {
          console.error("Error en streaming/DB save de optimize CV STAR:", error);
          const errString = `\n\n[ERROR:${error.message || 'Error guardando datos del CV STAR'}]`;
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
    console.error('Error in STAR optimization route:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
