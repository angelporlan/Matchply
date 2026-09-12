import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, jobOffers, prompts } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { cvListColumns, sessionUserColumns } from '@/lib/job-offer-queries';
import { Sparkles, Kanban, CreditCard, CheckCircle2, Crown, LogOut, Shield, FileText, PartyPopper } from 'lucide-react';
import { isProSubscription } from '@/lib/subscription';
import { stripe } from '@/lib/stripe';
import { syncStripeSubscription } from '@/lib/stripe-subscription-sync';
import DashboardClient from './DashboardClient';
import { getServerTranslations } from '@/lib/i18n/server';

interface DashboardPageProps {
  searchParams?: {
    checkout?: string;
    session_id?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const { t } = getServerTranslations();

  if (searchParams?.checkout === 'success' && searchParams.session_id) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(searchParams.session_id);
    if (
      checkoutSession.metadata?.userId === userId &&
      typeof checkoutSession.subscription === 'string'
    ) {
      const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription);
      await syncStripeSubscription(subscription);
    }
  }

  // 1. Obtener información actualizada del usuario de la base de datos
  const [dbUser] = await db
    .select(sessionUserColumns)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 2. Obtener lista de currículums del usuario (Principal primero, luego más recientes)
  const userCvs = await db
    .select(cvListColumns)
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt));

  const offerCounts = await db
    .select({
      status: jobOffers.status,
      count: sql<number>`count(*)::int`,
    })
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId))
    .groupBy(jobOffers.status);

  const totalOffers = offerCounts.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const interviewOffers = Number(offerCounts.find((row) => row.status === 'interview')?.count || 0);
  const successfulOffers = Number(offerCounts.find((row) => row.status === 'offer')?.count || 0);

  // 4. Obtener prompts no archivados para optimización de CV
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
                  {t('dashboard.banner.title', { name: dbUser?.name || session.user.name || t('sidebar.profile.candidate') })}
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

        {/* Panel de Estadísticas Rápidas */}
        {isPremium && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 animate-fadeIn">
            <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between shadow-sm">
              <div>
                <span className="text-text-muted text-xs font-medium font-sans">{t('dashboard.stats.active')}</span>
                <h3 className="text-3xl font-bold font-display text-text mt-1">{totalOffers}</h3>
              </div>
              <div className="p-3 bg-ai/10 text-ai rounded-xl border border-ai/10">
                <FileText className="w-5 h-5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between shadow-sm">
              <div>
                <span className="text-text-muted text-xs font-medium font-sans">{t('dashboard.stats.interview')}</span>
                <h3 className="text-3xl font-bold font-display text-amber-500 dark:text-amber-400 mt-1">{interviewOffers}</h3>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/10">
                <Sparkles className="w-5 h-5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-surface p-6 rounded-[12px] border border-subtle flex items-center justify-between shadow-sm">
              <div>
                <span className="text-text-muted text-xs font-medium font-sans flex items-center gap-1.5">
                  {t('dashboard.stats.successful')} <PartyPopper className="w-3.5 h-3.5 text-success-text" />
                </span>
                <h3 className="text-3xl font-bold font-display text-success-text mt-1">{successfulOffers}</h3>
              </div>
              <div className="p-3 bg-action/10 text-success-text rounded-xl border border-action/10">
                <CheckCircle2 className="w-5 h-5 stroke-[1.75]" />
              </div>
            </div>
          </div>
        )}

        {/* Sección de Currículums */}
        <DashboardClient 
          initialCvs={userCvs} 
          isPremium={isPremium} 
          availablePrompts={availablePrompts || []} 
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
