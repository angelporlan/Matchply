import { redirect } from 'next/navigation';
import { db } from '@/db';
import { jobOffers, cvs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import JobOfferDetailsPage from '@/components/applications/JobOfferDetailsPage';
import { getResearchRunForUser } from '@/lib/research/queue';
import { cvListColumns } from '@/lib/job-offer-queries';
import { listCompanyLookups } from '@/lib/company-service';
import { getSessionUser } from '@/lib/session';

interface OfferPageProps {
  params: {
    id: string;
  };
}

export default async function OfferDetailsPage({ params }: OfferPageProps) {
  const dbUser = await getSessionUser();
  if (!dbUser) {
    redirect('/login');
  }

  const userId = dbUser.id;
  const offerId = params.id;
  const isPremium = isProSubscription(dbUser.subscriptionStatus);

  if (!isPremium) {
    redirect('/dashboard/subscription');
  }

  // Detalle completo de la oferta (tabla ancha: solo aquí), CVs, empresas e investigación en paralelo.
  const [[offer], userCvs, companies, initialResearch] = await Promise.all([
    db
      .select()
      .from(jobOffers)
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
      .limit(1),
    db
      .select(cvListColumns)
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.createdAt)),
    listCompanyLookups(userId),
    getResearchRunForUser(userId, offerId),
  ]);

  if (!offer) {
    redirect('/dashboard/applications');
  }

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <JobOfferDetailsPage
          initialOffer={offer}
          userCvs={userCvs}
          companies={companies}
          isPremium={isPremium}
          initialResearch={initialResearch}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
