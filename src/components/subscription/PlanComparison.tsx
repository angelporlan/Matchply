'use client';

import type { PlanConfig, PlanLimits } from '@/lib/plan-config';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ButtonLink } from '@/components/ui/Button';
import { CheckoutOptions } from './CheckoutOptions';

export function PlanComparison({ config, authenticated = true, showCheckout = true, source = 'subscription' }: {
  config: PlanConfig; authenticated?: boolean; showCheckout?: boolean; source?: string;
}) {
  const { t } = useLanguage();
  const count = (value: number | null) => value === null ? t('plans.unlimited') : String(value);
  const monthly = (value: number) => value > 0 ? `${value} ${t('plans.monthly')}` : t('plans.unavailable');
  const rows: Array<{ label: string; value: (limits: PlanLimits) => string }> = [
    { label: 'cvs', value: limits => count(limits.maxCvs) }, { label: 'baseCvs', value: limits => count(limits.maxBaseCvs) },
    { label: 'adaptedCvs', value: limits => count(limits.maxAdaptedCvs) }, { label: 'general', value: limits => monthly(limits.generalAiMonthly) },
    { label: 'matching', value: limits => monthly(limits.matchingMonthly) }, { label: 'batch', value: limits => limits.matchBatchSize > 1 ? String(limits.matchBatchSize) : limits.matchBatchSize === 1 ? t('plans.individual') : t('plans.unavailable') },
    { label: 'research', value: limits => monthly(limits.researchMonthly) }, { label: 'keys', value: limits => limits.apiKeys > 0 ? String(limits.apiKeys) : t('plans.unavailable') },
    { label: 'requests', value: limits => limits.apiRequestsPerMinute > 0 ? String(limits.apiRequestsPerMinute) : t('plans.unavailable') },
    { label: 'manual', value: () => t('plans.included') }, { label: 'template', value: () => t('plans.included') },
  ];
  return <section className="space-y-6" aria-label={t('plans.compare')}>
    <div><h2 className="font-display text-2xl font-semibold text-text">{t('plans.compare')}</h2><p className="mt-2 text-sm leading-6 text-text-muted max-w-3xl">{t('plans.compareHelp')}</p></div>
    <div className="overflow-x-auto rounded-[12px] border border-subtle bg-surface"><table className="w-full min-w-[580px] text-left text-sm"><thead><tr className="bg-surface-muted"><th scope="col" className="px-5 py-3">{t('plans.limitLabel')}</th><th scope="col" className="px-5 py-3">{t('plans.free')}</th><th scope="col" className="px-5 py-3">{t('plans.pro')}</th></tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-t border-subtle"><th scope="row" className="px-5 py-3 font-medium">{t(`plans.${row.label}`)}</th><td className="px-5 py-3 text-text-muted">{row.value(config.free)}</td><td className="px-5 py-3">{row.value(config.pro)}</td></tr>)}</tbody></table></div>
    {showCheckout && <div className="grid gap-6 md:grid-cols-2"><div className="rounded-[12px] border border-subtle bg-surface p-5 space-y-4"><h3 className="text-xl font-display font-semibold">{t('plans.free')}</h3><p className="text-2xl font-semibold">0 €</p><p className="text-sm leading-6 text-text-muted">{t('plans.activeHelp')}</p><ButtonLink href={authenticated ? '/dashboard' : '/try?source=plans-free'} variant="secondary">{t('plans.freeCta')}</ButtonLink></div><div className="rounded-[12px] border border-control bg-surface p-5 space-y-4"><h3 className="text-xl font-display font-semibold">{t('plans.pro')}</h3><CheckoutOptions source={source} authenticated={authenticated} /></div></div>}
  </section>;
}
