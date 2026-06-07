import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { jobOffers, cvs, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { offerId } = body;

    if (!offerId) {
      return new NextResponse('Missing offerId', { status: 400 });
    }

    // 1. Fetch job offer
    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
      .limit(1);

    if (!offer) {
      return new NextResponse('Job offer not found or access denied', { status: 404 });
    }

    // 2. Fetch user to verify subscription status
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // 3. Find candidate CV (prefer linked cvId, then principal cv, then any cv)
    let selectedCv = null;
    if (offer.cvId) {
      const [cv] = await db
        .select()
        .from(cvs)
        .where(and(eq(cvs.id, offer.cvId), eq(cvs.userId, userId)))
        .limit(1);
      selectedCv = cv;
    }

    if (!selectedCv) {
      // Find principal CV
      const [principalCv] = await db
        .select()
        .from(cvs)
        .where(and(eq(cvs.userId, userId), eq(cvs.isPrincipal, true)))
        .limit(1);
      selectedCv = principalCv;
    }

    if (!selectedCv) {
      // Find any CV
      const [anyCv] = await db
        .select()
        .from(cvs)
        .where(eq(cvs.userId, userId))
        .orderBy(desc(cvs.createdAt))
        .limit(1);
      selectedCv = anyCv;
    }

    if (!selectedCv) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró ningún currículum base. Sube o crea un currículum antes de generar contenido.'
      }, { status: 400 });
    }

    // 4. Call AI service to generate outreach, cover letter, and interview questions
    const aiResult = await AIService.generateOutreachAndPrep({
      cvContent: selectedCv.content,
      jobDescription: offer.description || 'No description provided.',
      company: offer.company,
      jobTitle: offer.title,
      userSubscriptionStatus: user.subscriptionStatus
    });

    // 5. Update job offer in DB
    await db
      .update(jobOffers)
      .set({
        outreachMessage: aiResult.outreachMessage || null,
        coverLetter: aiResult.coverLetter || null,
        interviewQuestions: aiResult.interviewQuestions || null,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    return NextResponse.json({
      success: true,
      outreachMessage: aiResult.outreachMessage,
      coverLetter: aiResult.coverLetter,
      interviewQuestions: aiResult.interviewQuestions
    });

  } catch (error: any) {
    console.error('Error in outreach API route:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
