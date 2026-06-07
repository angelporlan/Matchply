import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { jobOffers, cvs, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import JobOfferDetailsPage from '@/components/kanban/JobOfferDetailsPage';

interface OfferPageProps {
  params: {
    id: string;
  };
}

export default async function OfferDetailsPage({ params }: OfferPageProps) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const offerId = params.id;

  // 1. Fetch updated user status
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!dbUser) {
    redirect('/dashboard');
  }

  const subscriptionStatus = dbUser.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 2. Fetch job offer
  const [offer] = await db
    .select()
    .from(jobOffers)
    .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
    .limit(1);

  if (!offer) {
    redirect('/dashboard/kanban');
  }

  // 3. Fetch user CVs
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.createdAt));

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <JobOfferDetailsPage
          initialOffer={offer}
          userCvs={userCvs}
          isPremium={isPremium}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
