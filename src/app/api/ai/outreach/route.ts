import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { jobOffers, cvs, users } from '@/db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { canAccessFeature, effectiveSubscriptionStatus, userEntitlements } from '@/lib/subscription';
import { requireProductContext } from '@/lib/request-context';
import { beginUsage, consumeUsage, releaseUsage } from '@/lib/usage';
import { aiRequestId, aiUsageErrorResponse, AiUsageHttpError } from '@/lib/ai-usage-http';
import { getCvAccess, requireEditableCv } from '@/lib/cv-access';
import { assertUsagePublication } from '@/lib/ai-cv-publication';
import { log } from '@/lib/logger';

const outreachOfferColumns = {
  id: jobOffers.id,
  cvId: jobOffers.cvId,
  title: jobOffers.title,
  company: jobOffers.company,
  description: jobOffers.description,
};

const outreachCvColumns = {
  id: cvs.id,
  content: cvs.content,
};

export async function POST(req: NextRequest) {
  let operationId: string | null = null;
  try {
    const ctx = await requireProductContext({ feature: 'applications' });
    const userId = ctx.effectiveUser!.id;
    const body = await req.json();
    const { offerId } = body;

    if (!offerId) {
      return new NextResponse('Missing offerId', { status: 400 });
    }

    const [[offer], [user]] = await Promise.all([
      db
        .select(outreachOfferColumns)
        .from(jobOffers)
        .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
        .limit(1),
      db
        .select({
          subscriptionStatus: users.subscriptionStatus,
          isGuest: users.isGuest,
          proGrantedUntil: users.proGrantedUntil,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);

    if (!offer) {
      return new NextResponse('Job offer not found or access denied', { status: 404 });
    }

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    if (!canAccessFeature(user.subscriptionStatus, 'applications', userEntitlements(user))) {
      return new NextResponse('A PRO subscription is required to access the applications board', { status: 403 });
    }

    const operation = await beginUsage(userId, { bucket: 'general', action: 'outreach', requestId: aiRequestId(req, body.requestId), input: { offerId } });
    if (operation.status === 'consumed') return NextResponse.json(operation.result);
    operationId = operation.id;
    let selectedCv = null;
    const cvAccess = await getCvAccess(userId);
    if (offer.cvId) {
      const [cv] = await db
        .select(outreachCvColumns)
        .from(cvs)
        .where(and(eq(cvs.id, offer.cvId), eq(cvs.userId, userId)))
        .limit(1);
      selectedCv = cv;
    }

    if (!selectedCv) {
      const [principalCv] = await db
        .select(outreachCvColumns)
        .from(cvs)
        .where(and(eq(cvs.userId, userId), eq(cvs.isPrincipal, true), cvAccess.activeIds.length ? inArray(cvs.id, cvAccess.activeIds) : sql`false`))
        .limit(1);
      selectedCv = principalCv;
    }

    if (!selectedCv) {
      const [anyCv] = await db
        .select(outreachCvColumns)
        .from(cvs)
        .where(and(eq(cvs.userId, userId), cvAccess.activeIds.length ? inArray(cvs.id, cvAccess.activeIds) : sql`false`))
        .orderBy(desc(cvs.createdAt))
        .limit(1);
      selectedCv = anyCv;
    }

    if (!selectedCv) {
      throw new AiUsageHttpError(400, 'CV_REQUIRED', 'No se encontró ningún currículum base. Sube o crea un currículum antes de generar contenido.');
    }
    await db.transaction(tx => requireEditableCv(tx, userId, selectedCv!.id));

    const aiResult = await AIService.generateOutreachAndPrep({
      cvContent: selectedCv.content,
      jobDescription: offer.description || 'No description provided.',
      company: offer.company,
      jobTitle: offer.title,
      userSubscriptionStatus: effectiveSubscriptionStatus(user)
    });

    const result = { success: true, outreachMessage: aiResult.outreachMessage, coverLetter: aiResult.coverLetter, interviewQuestions: aiResult.interviewQuestions };
    await db.transaction(async tx => {
    const ownerId = await assertUsagePublication(tx, userId, operation.id);
    const updated = await tx
      .update(jobOffers)
      .set({
        outreachMessage: aiResult.outreachMessage || null,
        coverLetter: aiResult.coverLetter || null,
        interviewQuestions: aiResult.interviewQuestions || null,
        updatedAt: new Date()
      })
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, ownerId))).returning({ id: jobOffers.id });
    if (!updated.length) throw new AiUsageHttpError(404, 'OFFER_NOT_FOUND', 'La oferta de esta generación ya no está disponible.');
    await consumeUsage(tx, operation.id, result);
    });

    return NextResponse.json(result);

  } catch (error: any) {
    if (operationId) await db.transaction(tx => releaseUsage(tx, operationId!));
    const response = aiUsageErrorResponse(error); if (response) return response;
    log({ event: 'outreach_failed', level: 'error', error });
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
