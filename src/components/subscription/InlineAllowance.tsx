'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePlanUsage } from './PlanUsageProvider';
import { quotaState } from '@/lib/plan-presentation';

/** The shared allowance is visible before starting a paid AI operation. */
export function InlineAllowance({ bucket = 'general' }: { bucket?: 'general' | 'matching' | 'research' }) {
  const { data, error } = usePlanUsage();
  const { t, language } = useLanguage();
  if (!data) return <p role="status" className="text-xs text-text-muted">{t(error ? 'plans.loadError' : 'plans.loading')}</p>;
  const allowance = data.usage[bucket];
  const state = quotaState(allowance);
  return <p aria-live="polite" className={`text-xs leading-5 ${state === 'available' ? 'text-text-muted' : 'text-warning-text'}`}>
    {t(`plans.${bucket}`)}: {t('plans.remaining', { remaining: allowance.remaining })} · {t('plans.used', { used: allowance.used, limit: allowance.limit })}
    {allowance.reserved > 0 && ` · ${t('plans.reserved', { reserved: allowance.reserved })}`}
    {allowance.resetAt ? ` · ${t('plans.renews', { date: new Date(allowance.resetAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB') })}` : ` · ${t('plans.sessionQuota')}`}
  </p>;
}
