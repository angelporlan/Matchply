import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import { Sparkles, Crown, CreditCard, ArrowLeft, CheckCircle2, Lock, ArrowRight, ShieldCheck, Zap, Lightbulb } from 'lucide-react';
import { getServerTranslations } from '@/lib/i18n/server';
import ApiKeyConsole from '@/components/subscription/ApiKeyConsole';

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const { t } = getServerTranslations();

  // Obtener información del usuario
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);
  const [proTitleBefore, proTitleAfter = ''] = t('subscription.title.pro').split('PRO');

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">

        {/* HEADER SECTION */}
        <div className="text-center mb-12">
          {isPremium ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-4 animate-pulse-subtle font-display">
              <Crown className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('subscription.badges.activePro')}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/70 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-4 shadow-sm font-display">
              <CreditCard className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('subscription.badges.activeFree')}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1e1b4b] dark:text-white font-display">
            {isPremium ? (
              <>{proTitleBefore}<span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">PRO</span>{proTitleAfter}</>
            ) : (
              <>{t('subscription.title.freeBefore')}<span className="bg-gradient-to-r from-[#8b5cf6] to-[#1e1b4b] dark:to-indigo-300 bg-clip-text text-transparent">{t('subscription.title.freeHighlight')}</span></>
            )}
          </h1>
          <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs md:text-sm mt-3 font-light leading-relaxed max-w-xl mx-auto font-sans">
            {isPremium
              ? t('subscription.subtitle.pro')
              : t('subscription.subtitle.free')}
          </p>
        </div>

        {/* CONTENIDO PRINCIPAL: CASO FREE */}
        {!isPremium && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mt-8 animate-fadeIn">

            {/* CARD PLAN FREE */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white">{t('subscription.freeCard.name')}</h3>
                    <p className="text-xs text-[#1e1b4b]/40 dark:text-slate-550 mt-0.5 font-sans">{t('subscription.freeCard.summary')}</p>
                  </div>
                  <span className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3 py-1 rounded-full font-display">
                    {t('subscription.freeCard.badge')}
                  </span>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black font-display text-[#1e1b4b] dark:text-white">{t('subscription.freeCard.price')}</span>
                  <span className="text-xs text-[#1e1b4b]/40 dark:text-slate-550 font-light">{t('subscription.freeCard.period')}</span>
                </div>

                <div className="h-[1px] bg-[#1e1b4b]/10 dark:bg-white/5 w-full mb-6" />

                <ul className="space-y-4 text-xs font-light text-[#1e1b4b]/80 dark:text-slate-200 font-sans">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.freeCard.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.freeCard.feature2').split(' Harvard')[0]} <strong>Harvard</strong></span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.freeCard.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.freeCard.feature4')}</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 font-display">
                <Link
                  href="/dashboard"
                  className="w-full bg-white dark:bg-[#1f2937] text-[#1e1b4b] dark:text-slate-200 border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 font-semibold py-3 px-4 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {t('subscription.freeCard.btn')}
                  <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
                </Link>
              </div>
            </div>

            {/* CARD PLAN PRO */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/30 relative flex flex-col justify-between shadow-md shadow-[#8b5cf6]/5 transition-all duration-300">
              {/* Glow decorativo */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-1.5">
                      {t('subscription.proCard.name')}
                      <Crown className="w-4 h-4 text-amber-500 animate-pulse-subtle stroke-[1.75]" />
                    </h3>
                    <p className="text-xs text-amber-600 dark:text-amber-550/70 mt-0.5 font-sans">{t('subscription.proCard.summary')}</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/35 px-2.5 py-0.5 rounded-full font-display">
                    {t('subscription.proCard.badge')}
                  </span>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black font-display text-[#1e1b4b] dark:text-white">{t('subscription.proCard.price')}</span>
                  <span className="text-xs text-[#1e1b4b]/50 dark:text-slate-400 font-light">{t('subscription.proCard.period')}</span>
                </div>

                <div className="h-[1px] bg-[#1e1b4b]/10 dark:bg-white/5 w-full mb-6" />

                <ul className="space-y-4 text-xs font-light text-[#1e1b4b]/80 dark:text-slate-200 font-sans">
                  <li className="flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.proCard.feature1').split('Officiel')[0].split('Official')[0]}{t('subscription.proCard.feature1').split('Oficiales')[1] || t('subscription.proCard.feature1').split('Engines')[1]}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.proCard.feature2').split('Premium')[0]}<strong>{t('subscription.proCard.feature2').includes('Plantillas') ? '5 Plantillas Premium' : '5 Premium Templates'}</strong>{t('subscription.proCard.feature2').split('Premium')[1] || t('subscription.proCard.feature2').split('Templates')[1]}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.proCard.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.proCard.feature4')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>{t('subscription.proCard.feature5')}</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 font-display">
                <a
                  href="/api/stripe/checkout"
                  className="w-full bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 text-white text-center font-bold py-3 px-4 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Crown className="w-3.5 h-3.5" />
                  {t('subscription.proCard.btn')}
                </a>
              </div>
            </div>

          </div>
        )}

        {/* CONTENIDO PRINCIPAL: CASO PRO */}
        {isPremium && (
          <div className="max-w-2xl mx-auto mt-6 space-y-8 animate-fadeIn">

            {/* TARJETA DE BIENVENIDA Y MOTIVACIÓN */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/20 shadow-md shadow-[#8b5cf6]/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-2xl pointer-events-none" />

              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/25 shrink-0">
                  <Crown className="w-6 h-6 animate-pulse-subtle stroke-[1.75]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white">{t('subscription.proActive.header')}</h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium font-sans">{t('subscription.proActive.subHeader')}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-light text-[#1e1b4b]/80 dark:text-slate-300 leading-relaxed font-sans">
                <p>
                  {t('subscription.proActive.bodyText')}
                </p>

                <div className="p-4 bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/5 dark:border-white/5 rounded-[12px] mt-4">
                  <span className="font-bold text-[#1e1b4b] dark:text-white text-xs flex items-center gap-1.5 mb-1 font-display">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 animate-pulse-subtle stroke-[1.75]" />
                    {t('subscription.proActive.didYouKnowTitle')}
                  </span>
                  <span className="block text-[#1e1b4b]/60 dark:text-slate-400 leading-relaxed">
                    {t('subscription.proActive.didYouKnowDesc')}
                  </span>
                </div>
              </div>

              <div className="h-[1px] bg-[#1e1b4b]/10 dark:bg-white/5 w-full my-6" />

              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center font-display">
                <div className="text-left w-full sm:w-auto">
                  <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-555 font-bold uppercase tracking-wider block">{t('subscription.proActive.billingStatusLabel')}</span>
                  <span className="text-xs text-[#2ecc71] font-medium flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-4 h-4 stroke-[1.75]" />
                    {t('subscription.proActive.billingStatusDesc')}
                  </span>
                </div>

                <a
                  href="/api/stripe/portal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 text-[#1e1b4b] dark:text-slate-200 font-bold py-2.5 px-5 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CreditCard className="w-4 h-4 text-[#1e1b4b]/60 dark:text-slate-400 stroke-[1.75]" />
                  {t('subscription.proActive.manageBillingBtn')}
                </a>
              </div>
            </div>

            {/* BENEFICIOS ACTIVOS CHECKLIST */}
            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm">
              <h4 className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider mb-4 font-display">{t('subscription.proActive.benefitsTitle')}</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>{t('subscription.proActive.benefit1')}</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>{t('subscription.proActive.benefit2')}</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>{t('subscription.proActive.benefit3')}</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>{t('subscription.proActive.benefit4')}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Api Key Console (integraciones automatizadas) */}
        <ApiKeyConsole initialApiKey={dbUser?.apiKey || null} isPremium={isPremium} />

      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
