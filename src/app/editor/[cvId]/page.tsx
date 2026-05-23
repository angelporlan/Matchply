import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users } from '@/db/schema';
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

  // 2. Obtener información actualizada de suscripción del usuario
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  return <EditorClient cv={cv} isPremium={isPremium} />;
}

export const dynamic = 'force-dynamic';
