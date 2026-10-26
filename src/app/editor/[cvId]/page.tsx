import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cvs, jobOffers, aiJobs } from '@/db/schema';
import { eq, and, desc, or, sql } from 'drizzle-orm';
import { cvListColumns } from '@/lib/job-offer-queries';
import EditorClient from '@/components/editor/EditorClient';
import { getAllowedCvTemplate, hasProAccess } from '@/lib/subscription';
import { getActor } from '@/lib/actor';
import { AccountSuspendedError } from '@/lib/request-errors';
import { guestHasPdfDownloadRemaining } from '@/lib/guest-pdf';
import { publicOptimizeModes } from '@/lib/optimize-modes';
import { getCvOptimizationView, getOriginalCvSource } from '@/lib/cv-optimization/service';
import type { OptimizeJobPayload } from '@/lib/cv-optimization/types';
import { getCvPhotoState } from '@/lib/cv-photo';

interface EditorPageProps {
  params: {
    cvId: string;
  };
  searchParams?: { offerId?: string };
}

export default async function EditorPage({ params, searchParams }: EditorPageProps) {
  let actor;
  try {
    actor = await getActor({ allowGuest: true });
  } catch (error) {
    if (error instanceof AccountSuspendedError) redirect('/account/suspended');
    throw error;
  }
  if (!actor) {
    redirect('/try');
  }

  const userId = actor.userId;
  const cvId = params.cvId;

  const [cv] = await db
      .select()
      .from(cvs)
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .limit(1);
  const availablePrompts = publicOptimizeModes();

  if (!cv) {
    redirect('/dashboard');
  }
  const optimization = await getCvOptimizationView(userId, cvId);
  const [pendingJob] = cv.pendingUsageOperationId || cv.optimizationId ? await db.select({ id: aiJobs.id, payload:aiJobs.payload }).from(aiJobs)
    .where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'optimize_cv_variants'), or(eq(aiJobs.status,'queued'),eq(aiJobs.status,'running')),
      cv.pendingUsageOperationId ? eq(aiJobs.usageOperationId,cv.pendingUsageOperationId) : sql`${aiJobs.payload}->>'optimizationId' = ${cv.optimizationId}`)).orderBy(desc(aiJobs.createdAt)).limit(1) : [];

  let baseCvId: string | null = cv.isBase ? cv.id : null;
  let baseCvContent: string | null = null;
  if (optimization) {
    const source = await getOriginalCvSource(userId, cvId);
    baseCvId = source?.id || null;
    baseCvContent = source?.content || null;
  } else if (!cv.isBase) {
    const [baseCv] = await db
      .select({ id: cvs.id, content: cvs.content })
      .from(cvs)
      .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
      .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt))
      .limit(1);
    baseCvId = baseCv?.id || null;
    baseCvContent = baseCv?.content || null;
  }

  const [cvChoices, linkedRows] = await Promise.all([
    db
      .select(cvListColumns)
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.isPrincipal), desc(cvs.updatedAt)),
    db
      .select({
        id: jobOffers.id,
        title: jobOffers.title,
        company: jobOffers.company,
        status: jobOffers.status,
      })
      .from(jobOffers)
      .where(and(eq(jobOffers.userId, userId), eq(jobOffers.cvId, cvId), ...(searchParams?.offerId && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(searchParams.offerId) ? [eq(jobOffers.id, searchParams.offerId)] : [])))
      .orderBy(desc(jobOffers.updatedAt))
      .limit(2),
  ]);

  const isGuest = actor.kind === 'guest';
  const guestCanDownloadPdf = isGuest ? await guestHasPdfDownloadRemaining(userId) : false;
  const subscriptionStatus = actor.subscriptionStatus || 'none';
  const isPremium = !isGuest && hasProAccess({ subscriptionStatus, proGrantedUntil: actor.proGrantedUntil, isGuest });
  const editorCv = {
    ...cv,
    templateName: getAllowedCvTemplate(subscriptionStatus, cv.templateName, { isGuest }),
  };

  const user = {
    name: isGuest ? 'Invitado' : actor.name,
    email: isGuest ? 'Prueba sin registro' : actor.email,
    role: actor.role,
  };

  return (
    <EditorClient
      cv={editorCv}
      initialPhoto={await getCvPhotoState(userId, cvId)}
      isPremium={isPremium}
      availablePrompts={availablePrompts || []}
      baseCvContent={baseCvContent}
      baseCvId={baseCvId}
      user={user}
      isGuest={isGuest}
      guestCanDownloadPdf={guestCanDownloadPdf}
      cvChoices={cvChoices.map((item) => ({
        id: item.id,
        title: item.title,
        isBase: item.isBase,
        isPrincipal: item.isPrincipal,
      }))}
      linkedOffer={linkedRows.length === 1 ? linkedRows[0] : null}
      optimization={optimization}
      pendingOptimizationJobId={pendingJob?.id}
      pendingOptimizationIsRetry={Boolean((pendingJob?.payload as {retry?:boolean} | undefined)?.retry)}
      pendingOptimizationMode={(pendingJob?.payload as OptimizeJobPayload | undefined)?.activateMode}
    />
  );
}

export const dynamic = 'force-dynamic';
