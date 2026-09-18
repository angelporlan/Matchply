import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cvs, prompts } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import EditorClient from '@/components/editor/EditorClient';
import { getAllowedCvTemplate, isProSubscription } from '@/lib/subscription';
import { getActor } from '@/lib/actor';

interface EditorPageProps {
  params: {
    cvId: string;
  };
}

export default async function EditorPage({ params }: EditorPageProps) {
  const actor = await getActor({ allowGuest: true });
  if (!actor) {
    redirect('/try');
  }

  const userId = actor.userId;
  const cvId = params.cvId;

  const [[cv], availablePrompts] = await Promise.all([
    db
      .select()
      .from(cvs)
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .limit(1),
    db
      .select({
        id: prompts.id,
        name: prompts.name,
        nameEn: prompts.nameEn,
        isActive: prompts.isActive,
        description: prompts.description,
        descriptionEn: prompts.descriptionEn,
        color: prompts.color,
      })
      .from(prompts)
      .where(
        and(
          eq(prompts.key, 'optimize_cv'),
          eq(prompts.isArchived, false)
        )
      )
      .orderBy(prompts.name),
  ]);

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
  const subscriptionStatus = actor.subscriptionStatus || 'none';
  const isPremium = !isGuest && isProSubscription(subscriptionStatus);
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
    />
  );
}

export const dynamic = 'force-dynamic';
