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
    const { baseCvId, jobTitle, company, url, platform, jobDescription, promptId, addToKanban = true } = body;

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

    // 3. Optimizar CV con IA
    const optimizedContent = await AIService.optimizeCV({
      baseCvMarkdown: baseCv.content,
      jobDescription: jobDescription,
      userSubscriptionStatus: user.subscriptionStatus,
      promptId: promptId
    });

    // 4. Guardar CV Optimizado
    const [optimizedCv] = await db
      .insert(cvs)
      .values({
        userId: userId,
        title: `Optimizado - ${jobTitle} (${company})`,
        content: optimizedContent,
        isBase: false,
        templateName: baseCv.templateName,
        accentColor: baseCv.accentColor,
        fontFamily: baseCv.fontFamily,
        pageMargin: baseCv.pageMargin,
        scale: baseCv.scale
      })
      .returning();

    // Log de auditoría para optimización por IA
    await createAuditLog("cv_optimize_ai", userId, user.email, {
      baseCvId,
      optimizedCvId: optimizedCv.id,
      jobTitle,
      company,
      platform,
      addToKanban
    });

    // 5. Guardar Candidatura en Kanban
    if (addToKanban) {
      await db.insert(jobOffers).values({
        userId: userId,
        cvId: optimizedCv.id,
        title: jobTitle,
        company: company,
        url: url || null,
        platform: platform || 'other',
        description: jobDescription,
        status: 'interested'
      });
    }

    revalidatePath('/dashboard');

    return NextResponse.json({
      success: true,
      cvId: optimizedCv.id
    });
  } catch (error: any) {
    console.error('Error in optimization route:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
