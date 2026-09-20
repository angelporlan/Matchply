import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cvs, jobOffers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { cvListColumns, cvTargetColumns } from '@/lib/job-offer-queries';
import { CreditCard, Crown } from 'lucide-react';
import { hasProAccess } from '@/lib/subscription';
import { stripe } from '@/lib/stripe';
import { syncStripeSubscription } from '@/lib/stripe-subscription-sync';
import { getSessionUser } from '@/lib/session';
import DashboardClient from './DashboardClient';
import { getServerTranslations } from '@/lib/i18n/server';
import { publicOptimizeModes } from '@/lib/optimize-modes';
import CheckoutConversionBeacon from '@/components/analytics/CheckoutConversionBeacon';

interface DashboardPageProps {
  searchParams?: {
    checkout?: string;
    session_id?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const dbUser = await getSessionUser();
  if (!dbUser) {
    redirect('/login');
  }

  const userId = dbUser.id;
  const { t } = getServerTranslations();

  let subscriptionStatus = dbUser.subscriptionStatus || 'none';

  if (searchParams?.checkout === 'success' && searchParams.session_id) {
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

  const [userCvs, cvTargets] = await Promise.all([
    db
      .select(cvListColumns)
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.isPrincipal), desc(cvs.updatedAt)),
    db
      .selectDistinctOn([jobOffers.cvId], cvTargetColumns)
      .from(jobOffers)
      .where(eq(jobOffers.userId, userId))
      .orderBy(jobOffers.cvId, desc(jobOffers.updatedAt)),
  ]);
  const availablePrompts = publicOptimizeModes();

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {!isPremium && (
          <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-[12px] bg-surface border border-subtle shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-[8px] bg-canvas text-text-muted dark:text-slate-300 border border-subtle">
                <CreditCard className="w-6 h-6 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display text-text flex items-center gap-2">
                  {t('dashboard.banner.title', { name: dbUser.name || t('sidebar.profile.candidate') })}
                </h2>
                <p className="text-text-muted text-xs mt-1 font-light leading-relaxed max-w-xl font-sans">
                  {t('dashboard.banner.desc')}
                </p>
              </div>
            </div>
            <a
              href="/api/stripe/checkout"
              className="w-full md:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold px-6 py-3 rounded-[8px] text-sm transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 font-display"
            >
              <Crown className="w-4 h-4" />
              {t('dashboard.banner.upgrade')}
            </a>
          </div>
        )}

        <CheckoutConversionBeacon checkout={searchParams?.checkout} />
        {/* Sección de Currículums */}
        <DashboardClient 
          initialCvs={userCvs} 
          cvTargets={cvTargets} 
          isPremium={isPremium} 
          availablePrompts={availablePrompts || []} 
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
