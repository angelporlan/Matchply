import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cvs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import EditorClient from '@/components/editor/EditorClient';
import { getAllowedCvTemplate, hasProAccess } from '@/lib/subscription';
import { getActor } from '@/lib/actor';
import { AccountSuspendedError } from '@/lib/request-errors';
import { guestHasPdfDownloadRemaining } from '@/lib/guest-pdf';
import { publicOptimizeModes } from '@/lib/optimize-modes';

interface EditorPageProps {
  params: {
    cvId: string;
  };
}

export default async function EditorPage({ params }: EditorPageProps) {
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
    redirect(actor.kind === 'guest' ? '/try' : '/dashboard');
  }

  let baseCvContent: string | null = null;
  if (!cv.isBase) {
    const [baseCv] = await db
      .select({ content: cvs.content })
      .from(cvs)
      .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
      .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt))
      .limit(1);
    baseCvContent = baseCv?.content || null;
  }

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
      isPremium={isPremium}
      availablePrompts={availablePrompts || []}
      baseCvContent={baseCvContent}
      user={user}
      isGuest={isGuest}
      guestCanDownloadPdf={guestCanDownloadPdf}
    />
  );
}

export const dynamic = 'force-dynamic';
