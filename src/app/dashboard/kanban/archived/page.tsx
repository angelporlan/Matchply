import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, jobOffers } from '@/db/schema';
import { eq, desc, and, like } from 'drizzle-orm';
import ArchivedOffersClient from './ArchivedOffersClient';
import { isProSubscription } from '@/lib/subscription';

export default async function ArchivedOffersPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // 1. Obtener información del usuario para verificar Premium
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 2. Obtener currículums del usuario
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.createdAt));

  // 3. Obtener solo ofertas/candidaturas archivadas (status empieza con 'archived:')
  const offers = await db
    .select()
    .from(jobOffers)
    .where(
      and(
        eq(jobOffers.userId, userId),
        like(jobOffers.status, 'archived:%')
      )
    )
    .orderBy(desc(jobOffers.updatedAt));

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <ArchivedOffersClient offers={offers} userCvs={userCvs} isPremium={isPremium} />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
