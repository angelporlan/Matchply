import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, FileInput, FileCheck2, TextSearch, ShieldCheck } from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingDemo from '@/components/landing/LandingDemo';
import LandingCtaLink from '@/components/landing/LandingCtaLink';
import LandingExperimentBeacon from '@/components/landing/LandingExperimentBeacon';
import Logo from '@/components/ui/Logo';
import { getRequestContext } from '@/lib/request-context';
import { GUEST_MAX_CVS, GUEST_MAX_PDF_DOWNLOADS, hasProAccess } from '@/lib/subscription';
import { landingContent, landingLimitText } from '@/lib/landing-content';
import { readLandingExperiment } from '@/lib/landing-experiment-server';
import { getPlanConfig } from '@/lib/plan-store';
import type { Language } from '@/lib/i18n/types';

function landingLanguage(): Language {
  return cookies().get('lang')?.value === 'en' ? 'en' : 'es';
}

export function generateMetadata(): Metadata {
  const copy = landingContent[landingLanguage()].metadata;
  return { ...copy, metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://matchply.com'), alternates: { canonical: '/' }, openGraph: { ...copy, type: 'website', siteName: 'Matchply' } };
}

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const language = landingLanguage();
  const copy = landingContent[language];
  const [ctx, planConfig, experiment] = await Promise.all([getRequestContext(), getPlanConfig(), readLandingExperiment()]);
  const user = ctx.effectiveUser;
  const isLoggedIn = Boolean(user && !user.isGuest);
  const isPro = Boolean(user && hasProAccess(user));
  const headline = copy.hero.headlines[experiment.variant || 'A'];
  const freeHref = isLoggedIn ? '/dashboard' : '/try';
  const freeLabel = isLoggedIn ? copy.hero.workspaceCta : copy.hero.cta;
  const checkoutHref = '/dashboard/subscription?interval=monthly&source=landing-pricing';
  const proHref = isPro ? '/dashboard/subscription' : isLoggedIn ? checkoutHref : `/register?plan=pro&source=landing-pricing&next=${encodeURIComponent(checkoutHref)}`;
  const unlimited = language === 'es' ? 'Sin límite' : 'Unlimited';
  const limits = {
    cvs: GUEST_MAX_CVS, pdfs: GUEST_MAX_PDF_DOWNLOADS,
    freeCvs: planConfig.free.maxCvs ?? unlimited, proCvs: planConfig.pro.maxCvs ?? unlimited,
    freeBaseCvs: planConfig.free.maxBaseCvs ?? unlimited, freeAdaptedCvs: planConfig.free.maxAdaptedCvs ?? unlimited,
    freeAi: planConfig.free.generalAiMonthly, proAi: planConfig.pro.generalAiMonthly,
    freeMatching: planConfig.free.matchingMonthly, proMatching: planConfig.pro.matchingMonthly,
    freeResearch: planConfig.free.researchMonthly, proResearch: planConfig.pro.researchMonthly,
  };
  const stepIcons = [FileInput, TextSearch, FileCheck2];
  const ctaClass = 'btn-raised btn-raised--hero landing-primary-cta w-full sm:w-auto';

  return (
    <div className="landing-shell bg-canvas text-text">
      <LandingHeader isLoggedIn={isLoggedIn} copy={copy.nav} />
      <main id="main-content" tabIndex={-1}>
        <LandingExperimentBeacon experiment={experiment} />
        <section aria-labelledby="landing-title" className="landing-hero mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:px-8 lg:py-24">
          <div className="min-w-0">
            <p className="landing-eyebrow mb-5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-action" aria-hidden="true" />{copy.hero.eyebrow}</p>
            <h1 id="landing-title" className="max-w-xl font-display text-[clamp(2.25rem,4.4vw,4rem)] font-bold leading-[1.08] tracking-[-0.04em]">{headline}</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-text-muted sm:text-lg sm:leading-8">{copy.hero.description}</p>
            <div className="mt-8">
              <LandingCtaLink href={freeHref} className={ctaClass}>{freeLabel}<ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" /></LandingCtaLink>
              <p className="mt-4 text-sm leading-6 text-text-muted">{isLoggedIn ? copy.hero.accountReassurance : copy.hero.reassurance}</p>
            </div>
            <p className="mt-7 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-subtle pt-5 text-sm text-text-muted"><span>{copy.hero.priceStart} {copy.hero.pricePro}</span><strong className="font-display text-2xl font-semibold text-text">{language === 'es' ? '10 €' : '€10'}<span className="text-base font-medium">{copy.hero.pricePeriod}</span></strong></p>
          </div>
          <div className="min-w-0"><LandingDemo language={language} /></div>
        </section>

        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 border-y border-subtle bg-surface py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="landing-eyebrow">{copy.how.eyebrow}</p>
            <h2 id="how-title" className="landing-section-title mt-4">{copy.how.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-muted">{copy.how.description}</p>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {copy.how.steps.map((step, index) => {
                const Icon = stepIcons[index];
                return <li key={step.title} className="rounded-xl border border-subtle bg-canvas p-6 sm:p-7">
                  <div className="flex items-center justify-between"><Icon className="h-7 w-7 text-ai-text" strokeWidth={1.5} aria-hidden="true" /><span className="font-display text-sm font-semibold text-text-muted">0{index + 1}</span></div>
                  <h3 className="mt-7 font-display text-xl font-semibold leading-7">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-text-muted">{step.description}</p>
                </li>;
              })}
            </ol>
            <div className="mt-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <p className="flex max-w-xl items-start gap-3 text-sm leading-6 text-text-muted"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-text" aria-hidden="true" />{copy.how.note}</p>
              <LandingCtaLink href={freeHref} className={ctaClass}>{freeLabel}<ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" /></LandingCtaLink>
            </div>
          </div>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="landing-eyebrow">{copy.pricing.eyebrow}</p>
            <h2 id="pricing-title" className="landing-section-title mt-4">{copy.pricing.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-muted">{copy.pricing.description}</p>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
              <div className="overflow-hidden rounded-xl border border-subtle bg-surface">
                <table className="w-full table-fixed text-left text-xs sm:text-sm">
                  <caption className="sr-only">{copy.pricing.title}</caption>
                  <thead className="border-b border-subtle bg-surface-muted"><tr><th scope="col" className="w-[42%] px-3 py-5 font-medium text-text-muted sm:px-5">{copy.pricing.capability}</th><th scope="col" className="px-2 py-5 font-semibold">{copy.pricing.free}<span className="mt-1 block font-normal text-text-muted">{copy.pricing.freePrice}</span></th><th scope="col" className="px-2 py-5 font-semibold">{copy.pricing.pro}</th></tr></thead>
                  <tbody className="divide-y divide-subtle">{copy.pricing.rows.map(row => <tr key={row.label}><th scope="row" className="px-3 py-4 font-medium leading-5 sm:px-5">{row.label}</th><td className="px-2 py-4 leading-5 text-text-muted">{landingLimitText(row.free, limits)}</td><td className="px-2 py-4 font-medium leading-5">{landingLimitText(row.pro, limits)}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-col rounded-xl border border-control bg-surface p-6 sm:p-8">
                <p className="landing-eyebrow">{copy.pricing.pro}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-2"><strong className="font-display text-5xl font-semibold tracking-tight">{language === 'es' ? '10 €' : '€10'}</strong><span className="text-sm text-text-muted">{copy.pricing.monthly}</span></p>
                <p className="mt-4 text-sm leading-6 text-text-muted">{copy.pricing.proDescription}</p>
                <ul className="my-6 space-y-3">{copy.pricing.proFeatures.map(feature => <li key={feature} className="flex items-start gap-3 text-sm leading-6"><Check className="mt-0.5 h-5 w-5 shrink-0 text-success-text" aria-hidden="true" />{landingLimitText(feature, limits)}</li>)}</ul>
                <Link href={proHref} prefetch={false} className={`${ctaClass} mt-auto`}>{isPro ? copy.pricing.manage : copy.pricing.cta}<ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" /></Link>
                <p className="mt-4 text-xs leading-5 text-text-muted">{copy.pricing.note}</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-text-muted">{landingLimitText(copy.pricing.trial, limits)}</p>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 border-y border-subtle bg-surface py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8">
            <div><p className="landing-eyebrow">{copy.faq.eyebrow}</p><h2 id="faq-title" className="landing-section-title mt-4 max-w-sm">{copy.faq.title}</h2></div>
            <div className="divide-y divide-subtle border-y border-subtle">{copy.faq.items.map(item => <details key={item.question} className="group py-1">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-display text-base font-semibold sm:text-lg">{item.question}<ChevronDown className="h-5 w-5 shrink-0 text-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
              <div className="faq-answer pb-5 pr-8 text-sm leading-7 text-text-muted"><p>{landingLimitText(item.answer, limits)}</p>{item.linkLabel && <Link href="/privacy" className="mt-2 inline-flex min-h-11 items-center font-medium text-text underline underline-offset-4">{item.linkLabel}</Link>}</div>
            </details>)}</div>
          </div>
        </section>

        <section aria-labelledby="closing-title" className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center"><p className="landing-eyebrow">{copy.closing.eyebrow}</p><h2 id="closing-title" className="landing-section-title mt-4">{copy.closing.title}</h2><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-text-muted">{copy.closing.description}</p><div className="mt-8"><LandingCtaLink href={freeHref} className={ctaClass}>{freeLabel}<ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" /></LandingCtaLink></div></div>
        </section>
      </main>
      <footer className="border-t border-subtle bg-surface px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 lg:flex-row lg:items-start"><div><Logo iconSize="sm" textSize="md" /><p className="mt-3 max-w-sm text-sm leading-6 text-text-muted">{copy.footer.tagline}</p><p className="mt-4 text-xs text-text-muted">© {new Date().getFullYear()} Matchply. {copy.footer.rights}</p></div><nav aria-label={copy.footer.label} className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-muted">{[['/privacy', copy.footer.privacy], ['/terms', copy.footer.terms], ['/cookies', copy.footer.cookies], ['mailto:matchplyapp@gmail.com', copy.footer.support]].map(([href, label]) => <a key={href} href={href} className="flex min-h-11 items-center hover:text-text hover:underline">{label}</a>)}</nav></div>
      </footer>
    </div>
  );
}
