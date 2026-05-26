import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, jobOffers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import { isProSubscription } from '@/lib/subscription';

export default async function KanbanPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // 1. Obtener información actualizada del usuario de la base de datos
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 2. Obtener lista de currículums del usuario
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.createdAt));

  // 3. Obtener todas las ofertas/candidaturas de empleo del usuario
  const offers = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId))
    .orderBy(desc(jobOffers.updatedAt));

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Tablero Kanban */}
        <KanbanBoard offers={offers} userCvs={userCvs} />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
