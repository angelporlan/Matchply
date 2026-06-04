import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users } from '@/db/schema';
import { eq, and, not } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { translations } from '@/lib/i18n/translations';

// @ts-ignore
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    // 0. Resolver idioma del usuario
    const { searchParams } = new URL(req.url);
    const lang = (searchParams.get('lang') || 'es') as 'es' | 'en';

    // 1. Verificar autenticación
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const userId = session.user.id;

    // 2. Extraer datos del formulario (multipart/form-data)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;
    const targetCvId = formData.get('targetCvId') as string | null;

    let cvText = '';
    let cvTitle = 'Mi Currículum Base';

    if (file) {
      // Importar desde PDF
      cvTitle = file.name.replace(/\.[^/.]+$/, ""); // Quitar extensión
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parsed = await pdf(buffer);
        cvText = parsed.text || '';
      } catch (err: any) {
        console.error('Error al extraer texto del PDF:', err);
        return NextResponse.json({
          success: false,
          error: translations[lang].dashboard.errors.pdfReadError
        }, { status: 400 });
      }
    } else if (text) {
      // Importar desde texto copiado y pegado
      cvText = text;
    } else {
      return NextResponse.json({
        success: false,
        error: lang === 'es' 
          ? 'Debe subir un archivo PDF o ingresar el texto de su currículum.' 
          : 'You must upload a PDF file or enter your resume text.'
      }, { status: 400 });
    }

    if (!cvText || !cvText.trim()) {
      return NextResponse.json({
        success: false,
        error: translations[lang].dashboard.errors.emptyCvError
      }, { status: 400 });
    }

    // 3. Obtener el usuario para validar su estado de suscripción
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // 4. Llamar al servicio de inteligencia artificial para obtener el stream
    let aiStream;
    try {
      aiStream = await AIService.importCVStream({
        rawText: cvText,
        userSubscriptionStatus: user.subscriptionStatus
      });
    } catch (err: any) {
      console.error('Error al iniciar stream de importación con IA:', err);
      const isPromptMissing = err.message === 'IMPORT_PROMPT_MISSING' || err.message.includes('import_cv');
      const errorMessage = isPromptMissing
        ? translations[lang].dashboard.errors.importPromptMissing
        : translations[lang].dashboard.errors.genericAiError;

      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: 500 });
    }

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

            // Guardar parcialmente en la base de datos de manera no bloqueante cada 4 segundos
            const now = Date.now();
            if (now - lastWriteTime > 4000) {
              lastWriteTime = now;
              if (targetCvId) {
                db.update(cvs)
                  .set({ content: accumulatedContent })
                  .where(eq(cvs.id, targetCvId))
                  .execute()
                  .catch(err => console.error("[Import API] Error saving partial stream to DB:", err));
              }
            }
          }

          // 5. Guardar el nuevo CV Base e inyectarlo en la base de datos o actualizar el existente
          let newCvId = '';
          await db.transaction(async (tx) => {
            // Poner a false todos los demás CVs del usuario (ya que este será el principal)
            await tx
              .update(cvs)
              .set({ isPrincipal: false })
              .where(eq(cvs.userId, userId));

            if (targetCvId) {
              await tx
                .update(cvs)
                .set({
                  content: accumulatedContent,
                  title: cvTitle,
                  isBase: true,
                  isPrincipal: true
                })
                .where(eq(cvs.id, targetCvId));
              newCvId = targetCvId;
            } else {
              // Insertar el nuevo CV como base e isPrincipal
              const [insertedCv] = await tx
                .insert(cvs)
                .values({
                  userId: userId,
                  title: cvTitle,
                  content: accumulatedContent,
                  isBase: true,
                  isPrincipal: true,
                  templateName: 'harvard',
                  accentColor: '#1a5f7a',
                  fontFamily: 'helvetica',
                  pageMargin: 36,
                  scale: 1.0,
                })
                .returning();
              newCvId = insertedCv.id;
            }
          });

          // 6. Log de auditoría para el onboarding
          await createAuditLog(
            file ? "cv_import_pdf" : "cv_import_text",
            userId,
            user.email,
            {
              cvId: newCvId,
              title: cvTitle,
              isPdf: !!file
            }
          );

          revalidatePath('/dashboard');

          // Enviar metadatos al cliente para que sepa el cvId de redirección
          const metaString = `\n\n[METADATA:{"success":true,"cvId":"${newCvId}"}]`;
          controller.enqueue(encoder.encode(metaString));
          controller.close();
        } catch (error: any) {
          console.error("Error en streaming/DB save de import CV:", error);
          const errString = `\n\n[ERROR:${error.message || 'Error guardando datos del CV importado'}]`;
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
      }
    });

  } catch (error: any) {
    console.error('Error in import route:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
