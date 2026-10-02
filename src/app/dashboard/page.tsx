import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cvs, jobOffers } from '@/db/schema';
import { and, eq, desc, isNotNull } from 'drizzle-orm';
import { cvListColumns, cvTargetColumns } from '@/lib/job-offer-queries';
import { hasProAccess } from '@/lib/subscription';
import { stripe } from '@/lib/stripe';
import { syncStripeSubscription } from '@/lib/stripe-subscription-sync';
import { getDashboardViewer } from '@/lib/session';
import { guestHasPdfDownloadRemaining } from '@/lib/guest-pdf';
import DashboardClient from './DashboardClient';
import { publicOptimizeModes } from '@/lib/optimize-modes';
import CheckoutConversionBeacon from '@/components/analytics/CheckoutConversionBeacon';
import { timed } from '@/lib/logger';

interface DashboardPageProps {
  searchParams?: {
    checkout?: string;
    session_id?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const viewer = await getDashboardViewer();
  if (!viewer) {
    redirect('/login');
  }

  const dbUser = viewer.user;
  const isGuest = viewer.isGuest;
  const userId = dbUser.id;

  let subscriptionStatus = dbUser.subscriptionStatus || 'none';

  if (!isGuest && searchParams?.checkout === 'success' && searchParams.session_id) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(searchParams.session_id);
    if (
      checkoutSession.metadata?.userId === userId &&
      typeof checkoutSession.subscription === 'string'
    ) {
      const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription);
      await syncStripeSubscription(subscription);
      subscriptionStatus = subscription.status;
    }
  }

  const isPremium = hasProAccess({ ...dbUser, subscriptionStatus });
  const guestCanDownloadPdf = isGuest ? await guestHasPdfDownloadRemaining(userId) : false;

  const [userCvs, cvTargets] = await timed('nav_queries', { route: '/dashboard' }, () => Promise.all([
    db
      .select(cvListColumns)
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.isPrincipal), desc(cvs.updatedAt)),
    db
      .selectDistinctOn([jobOffers.cvId], cvTargetColumns)
      .from(jobOffers)
      .where(and(eq(jobOffers.userId, userId), isNotNull(jobOffers.cvId)))
      .orderBy(jobOffers.cvId, desc(jobOffers.updatedAt)),
  ]));
  const availablePrompts = publicOptimizeModes();

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">

        <CheckoutConversionBeacon checkout={searchParams?.checkout} />
        {/* Sección de Currículums */}
        <DashboardClient
          initialCvs={userCvs}
          cvTargets={cvTargets}
          isPremium={isPremium}
          isGuest={isGuest}
          guestCanDownloadPdf={guestCanDownloadPdf}
          availablePrompts={availablePrompts || []}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
