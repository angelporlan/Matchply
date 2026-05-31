import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, prompts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import EditorClient from '@/components/editor/EditorClient';
import { isProSubscription } from '@/lib/subscription';

interface EditorPageProps {
  params: {
    cvId: string;
  };
}

export default async function EditorPage({ params }: EditorPageProps) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const cvId = params.cvId;

  // 1. Obtener Currículum de la base de datos asegurando pertenencia del usuario
  const [cv] = await db
    .select()
    .from(cvs)
    .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
    .limit(1);

  if (!cv) {
    // Si no existe el CV o no pertenece al usuario, redirigir al panel principal
    redirect('/dashboard');
  }

  // 1b. Obtener el currículum base para comparación "Antes y Después"
  let baseCvContent: string | null = null;
  if (!cv.isBase) {
    const [principalBase] = await db
      .select()
      .from(cvs)
      .where(
        and(
          eq(cvs.userId, userId),
          eq(cvs.isBase, true),
          eq(cvs.isPrincipal, true)
        )
      )
      .limit(1);

    if (principalBase) {
      baseCvContent = principalBase.content;
    } else {
      const [anyBase] = await db
        .select()
        .from(cvs)
        .where(
          and(
            eq(cvs.userId, userId),
            eq(cvs.isBase, true)
          )
        )
        .limit(1);
      baseCvContent = anyBase?.content || null;
    }
  }

  // 2. Obtener información actualizada de suscripción del usuario
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 3. Obtener prompts no archivados para optimización de CV
  const availablePrompts = await db
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
    .orderBy(prompts.name);

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: dbUser?.role,
  };

  return (
    <EditorClient
      cv={cv}
      isPremium={isPremium}
      availablePrompts={availablePrompts || []}
      baseCvContent={baseCvContent}
      user={user}
    />
  );
}

export const dynamic = 'force-dynamic';
