import Link from 'next/link';
import { auth } from '@/auth';
import { Sparkles, FileText, CheckCircle, ArrowRight, ChevronRight, BarChart2 } from 'lucide-react';
import { getServerTranslations } from '@/lib/i18n/server';
import LandingHeader from '@/components/landing/LandingHeader';

export default async function LandingPage() {
  const session = await auth();
  const { t } = getServerTranslations();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fafafa] dark:bg-[#0b0f19] pt-16 text-[#1e1b4b] dark:text-[#f3f4f6] font-sans transition-colors duration-300">
      {/* Background radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/8 blur-[130px] pointer-events-none" />

      {/* Navigation Header */}
      <LandingHeader
        isLoggedIn={!!session}
        navFeatures={t('landing.nav.features')}
        navTemplates={t('landing.nav.templates')}
        navPricing={t('landing.nav.pricing')}
        navDashboard={t('landing.nav.dashboard')}
        navLogin={t('landing.nav.login')}
        navRegister={t('landing.nav.register')}
      />

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 border border-[#8b5cf6]/15 dark:border-[#8b5cf6]/20 rounded-full px-4 py-1.5 text-xs text-[#8b5cf6] mb-8 animate-pulse-subtle">
          <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
          <span>{t('landing.hero.badge')}</span>
        </div>

        <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.1] mb-6 text-[#1e1b4b] dark:text-white">
          {t('landing.hero.titleBefore')} <span className="bg-gradient-to-r from-[#8b5cf6] to-[#1e1b4b] dark:to-indigo-300 bg-clip-text text-transparent">{t('landing.hero.titleHighlight')}</span> {t('landing.hero.titleAfter')}
        </h1>

        <p className="max-w-3xl mx-auto text-lg sm:text-xl text-[#1e1b4b]/60 dark:text-slate-400 font-light mb-10 leading-relaxed font-sans">
          {t('landing.hero.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={session ? "/dashboard" : "/register"}
            className="w-full sm:w-auto bg-[#2ecc71] hover:bg-[#2ecc71]/90 text-white font-bold px-8 py-4 rounded-[8px] shadow-md shadow-[#2ecc71]/10 hover:shadow-[#2ecc71]/25 transition-all flex items-center justify-center gap-2 text-base group font-display"
          >
            {t('landing.hero.primaryCta')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform stroke-[1.75]" />
          </Link>
          <a
            href="#templates"
            className="w-full sm:w-auto bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 text-[#1e1b4b]/80 dark:text-slate-200 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 hover:text-[#1e1b4b] dark:hover:text-white px-8 py-4 rounded-[8px] font-semibold transition-all flex items-center justify-center gap-2 text-base font-display shadow-sm"
          >
            {t('landing.hero.secondaryCta')}
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 border-t border-[#1e1b4b]/5 dark:border-white/5 bg-white dark:bg-[#0b0f19] relative scroll-mt-24 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1e1b4b] dark:text-white mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-[#1e1b4b]/60 dark:text-slate-400 max-w-2xl mx-auto font-light">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div className="bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 p-4 rounded-xl text-[#8b5cf6] w-fit mb-6">
                <FileText className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white mb-3">{t('landing.features.editor.title')}</h3>
              <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-sm font-light leading-relaxed">
                {t('landing.features.editor.desc')}
              </p>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div className="bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 p-4 rounded-xl text-[#8b5cf6] w-fit mb-6">
                <Sparkles className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white mb-3">{t('landing.features.ai.title')}</h3>
              <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-sm font-light leading-relaxed">
                {t('landing.features.ai.desc')}
              </p>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div className="bg-[#2ecc71]/10 border border-[#2ecc71]/20 p-4 rounded-xl text-[#2ecc71] w-fit mb-6">
                <BarChart2 className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white mb-3">{t('landing.features.kanban.title')}</h3>
              <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-sm font-light leading-relaxed">
                {t('landing.features.kanban.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase of 5 templates */}
      <section id="templates" className="py-24 border-t border-[#1e1b4b]/5 dark:border-white/5 bg-[#fafafa] dark:bg-[#0b0f19] scroll-mt-24 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1e1b4b] dark:text-white mb-4">
              {t('landing.templates.title')}
            </h2>
            <p className="text-[#1e1b4b]/60 dark:text-slate-400 max-w-2xl mx-auto font-light">
              {t('landing.templates.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div>
                <div className="bg-[#fafafa] dark:bg-[#0b0f19] p-3 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/70 dark:text-slate-300 w-fit mb-4 text-xs font-semibold font-display">
                  Harvard
                </div>
                <h4 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white mb-2">Harvard</h4>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light leading-relaxed">
                  {t('landing.templates.harvard.desc')}
                </p>
              </div>
              <div className="mt-4 text-[#8b5cf6] text-xs font-semibold flex items-center gap-1 font-display">
                {t('landing.templates.harvard.cta')} <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div>
                <div className="bg-[#8b5cf6]/10 p-3 rounded-[8px] border border-[#8b5cf6]/20 text-[#8b5cf6] w-fit mb-4 text-xs font-semibold font-display">
                  Modern
                </div>
                <h4 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white mb-2">Modern</h4>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light leading-relaxed">
                  {t('landing.templates.modern.desc')}
                </p>
              </div>
              <div className="mt-4 text-[#8b5cf6] text-xs font-semibold flex items-center gap-1 font-display">
                {t('landing.templates.modern.cta')} <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div>
                <div className="bg-[#1e1b4b]/5 dark:bg-white/5 p-3 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b] dark:text-white w-fit mb-4 text-xs font-semibold font-display">
                  Minimal
                </div>
                <h4 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white mb-2">Minimal</h4>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light leading-relaxed">
                  {t('landing.templates.minimal.desc')}
                </p>
              </div>
              <div className="mt-4 text-[#8b5cf6] text-xs font-semibold flex items-center gap-1 font-display">
                {t('landing.templates.minimal.cta')} <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div>
                <div className="bg-pink-500/10 p-3 rounded-[8px] border border-pink-500/20 text-pink-600 w-fit mb-4 text-xs font-semibold font-display">
                  Creative
                </div>
                <h4 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white mb-2">Creative</h4>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light leading-relaxed">
                  {t('landing.templates.creative.desc')}
                </p>
              </div>
              <div className="mt-4 text-[#8b5cf6] text-xs font-semibold flex items-center gap-1 font-display">
                {t('landing.templates.creative.cta')} <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm transition-all hover:translate-y-[-4px] hover:shadow-md">
              <div>
                <div className="bg-red-500/10 p-3 rounded-[8px] border border-red-500/20 text-red-600 w-fit mb-4 text-xs font-semibold font-display">
                  Swiss
                </div>
                <h4 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white mb-2">Swiss</h4>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light leading-relaxed">
                  {t('landing.templates.swiss.desc')}
                </p>
              </div>
              <div className="mt-4 text-[#8b5cf6] text-xs font-semibold flex items-center gap-1 font-display">
                {t('landing.templates.swiss.cta')} <ChevronRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Grid */}
      <section id="pricing" className="py-24 border-t border-[#1e1b4b]/5 dark:border-white/5 bg-white dark:bg-[#0b0f19] relative scroll-mt-24 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1e1b4b] dark:text-white mb-4">
              {t('landing.pricing.title')}
            </h2>
            <p className="text-[#1e1b4b]/60 dark:text-slate-400 font-light max-w-xl mx-auto">
              {t('landing.pricing.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Free Plan */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1e1b4b]/50 dark:text-slate-400 font-display">{t('landing.pricing.free.kicker')}</span>
                <h3 className="text-2xl font-bold text-[#1e1b4b] dark:text-white font-display mt-2 mb-4">{t('landing.pricing.free.name')}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-[#1e1b4b] dark:text-white font-display">€0</span>
                  <span className="text-sm text-[#1e1b4b]/60 dark:text-slate-400">{t('landing.pricing.free.period')}</span>
                </div>
                <ul className="space-y-3.5 text-sm font-light text-[#1e1b4b]/80 dark:text-slate-200">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature1')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature2')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature3')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature4')}</span>
                  </li>
                </ul>
              </div>
              <Link
                href={session ? "/dashboard" : "/register"}
                className="w-full mt-8 bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 text-[#1e1b4b] dark:text-slate-200 text-center font-semibold py-3.5 rounded-[8px] transition-all shadow-sm font-display"
              >
                {t('landing.pricing.free.cta')}
              </Link>
            </div>

            {/* PRO Plan */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/30 relative flex flex-col justify-between shadow-md shadow-[#8b5cf6]/5">
              <div className="absolute top-4 right-4 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 text-[#8b5cf6] dark:text-[#8b5cf6] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full font-display">
                {t('landing.pricing.pro.badge')}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8b5cf6] font-display">{t('landing.pricing.pro.kicker')}</span>
                <h3 className="text-2xl font-bold text-[#1e1b4b] dark:text-white font-display mt-2 mb-4">{t('landing.pricing.pro.name')}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-[#1e1b4b] dark:text-white font-display">€10</span>
                  <span className="text-sm text-[#1e1b4b]/60 dark:text-slate-400">{t('landing.pricing.pro.period')}</span>
                </div>
                <ul className="space-y-3.5 text-sm font-light text-[#1e1b4b]/80 dark:text-slate-200">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span className="font-medium text-[#1e1b4b] dark:text-white">{t('landing.pricing.pro.feature1')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.pro.feature2')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.pro.feature3')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span className="font-medium text-[#1e1b4b] dark:text-white">{t('landing.pricing.pro.feature4')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.pro.feature5')}</span>
                  </li>
                </ul>
              </div>
              {session ? (
                <a
                  href="/api/stripe/checkout"
                  className="w-full mt-8 bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] hover:bg-[#1e1b4b]/90 dark:hover:bg-slate-100 text-center font-bold py-3.5 rounded-[8px] transition-all shadow-sm font-display"
                >
                  {t('landing.pricing.pro.checkoutCta')}
                </a>
              ) : (
                <Link
                  href="/register"
                  className="w-full mt-8 bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] hover:bg-[#1e1b4b]/90 dark:hover:bg-slate-100 text-center font-bold py-3.5 rounded-[8px] transition-all shadow-sm font-display"
                >
                  {t('landing.pricing.pro.registerCta')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#1e1b4b]/10 dark:border-white/10 text-center text-xs text-[#1e1b4b]/40 dark:text-slate-500 font-light bg-[#fafafa] dark:bg-[#0b0f19] transition-colors duration-300">
        <p>&copy; {new Date().getFullYear()} Matchply. {t('landing.footer.tagline')}</p>
      </footer>
    </div>
  );
}
