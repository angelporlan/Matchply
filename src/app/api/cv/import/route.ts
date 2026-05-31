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

    // 4. Llamar al servicio de inteligencia artificial para formatear
    let formattedMarkdown = '';
    try {
      formattedMarkdown = await AIService.importCV({
        rawText: cvText,
        userSubscriptionStatus: user.subscriptionStatus
      });
    } catch (err: any) {
      console.error('Error al formatear el CV con IA:', err);
      const isPromptMissing = err.message === 'IMPORT_PROMPT_MISSING' || err.message.includes('import_cv');
      const errorMessage = isPromptMissing
        ? translations[lang].dashboard.errors.importPromptMissing
        : translations[lang].dashboard.errors.genericAiError;

      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: 500 });
    }

    // 5. Guardar el nuevo CV Base e inyectarlo en la base de datos
    let newCvId = '';
    try {
      await db.transaction(async (tx) => {
        // Poner a false todos los demás CVs del usuario (ya que este será el principal)
        await tx
          .update(cvs)
          .set({ isPrincipal: false })
          .where(eq(cvs.userId, userId));

        // Insertar el nuevo CV como base e isPrincipal
        const [insertedCv] = await tx
          .insert(cvs)
          .values({
            userId: userId,
            title: cvTitle,
            content: formattedMarkdown,
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
      });
    } catch (err: any) {
      console.error('Error al insertar el CV en la DB:', err);
      return NextResponse.json({
        success: false,
        error: translations[lang].dashboard.errors.dbSaveError
      }, { status: 500 });
    }

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

    return NextResponse.json({
      success: true,
      cvId: newCvId
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
