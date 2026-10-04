'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { quotaState } from '@/lib/plan-presentation';
import { Button } from '@/components/ui/Button';
import { usePlanUsage } from './PlanUsageProvider';
import { recordPaywallEvent, UpgradePaywall } from './UpgradePaywall';

export function UsagePanel({ compact = false, showUpgrade = false }: { compact?: boolean; showUpgrade?: boolean }) {
  const { data, error, loading, refresh } = usePlanUsage();
  const { t, language } = useLanguage();
  const reported = useRef(new Set<string>());
  useEffect(() => {
    if (!data) return;
    for (const key of ['general', 'matching', 'research'] as const) {
      const bucket = data.usage[key];
      const identity = `${key}:${bucket.resetAt || 'guest'}:${data.configVersion}`;
      if (quotaState(bucket) === 'warning' && !reported.current.has(identity)) {
        reported.current.add(identity);
        recordPaywallEvent('quota_warning', `usage-${key}`);
      }
    }
  }, [data]);
  if (loading && !data) return <p role="status" className="text-sm text-text-muted">{t('plans.loading')}</p>;
  if (error && !data) return <div role="alert" className="flex items-center gap-3 text-sm text-text-muted"><span>{t('plans.loadError')}</span><Button variant="ghost" size="sm" onClick={() => void refresh()}>{t('plans.retry')}</Button></div>;
  if (!data) return null;
  return <section aria-label={t('plans.usage')} className={compact ? 'space-y-3' : 'rounded-[12px] border border-subtle bg-surface p-5 space-y-4'}>
    {!compact && <h2 className="text-lg font-display font-semibold">{t('plans.usage')} · {t(`plans.${data.plan}`)}</h2>}
    <div className="grid gap-3 sm:grid-cols-3">
      {(['general', 'matching', 'research'] as const).map(key => {
        const bucket = data.usage[key];
        if (bucket.limit === 0) return null;
        const state = quotaState(bucket);
        return <div key={key} className={`rounded-[8px] border p-3 ${state === 'available' ? 'border-subtle bg-canvas' : 'border-warning-text/30 bg-warning-surface'}`}>
          <p className="text-sm font-semibold">{t(`plans.${key}`)}</p>
          <p className="mt-1 text-sm">{t('plans.used', { used: bucket.used, limit: bucket.limit })}</p>
          {bucket.reserved > 0 && <p className="text-xs text-text-muted">{t('plans.reserved', { reserved: bucket.reserved })}</p>}
          <p className="text-xs text-text-muted">{t('plans.remaining', { remaining: bucket.remaining })}</p>
          <progress className="mt-2 w-full h-2 accent-[var(--warning-text)]" max={Math.max(1, bucket.limit)} value={Math.min(bucket.limit, bucket.used + bucket.reserved)} aria-label={t(`plans.${key}`)} />
          {state !== 'available' && <p className="mt-1 text-xs text-warning-text">{t(`plans.${state === 'warning' ? 'warning' : 'exhausted'}`, { bucket: t(`plans.${key}`).toLocaleLowerCase(language) })}</p>}
          {bucket.resetAt && <p className="mt-1 text-xs text-text-muted">{t('plans.renews', { date: new Date(bucket.resetAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB') })}</p>}
        </div>;
      })}
    </div>
    <p className="text-sm text-text-muted">{t('plans.cvs')}: {data.cv.total} / {data.cv.max === null ? t('plans.unlimited') : data.cv.max}{data.plan === 'guest' ? ` · ${t('plans.sessionQuota')}` : ''}</p>
    {data.plan === 'pro' && data.trial?.endAt && new Date(data.trial.endAt).getTime() > Date.now() && <p className="text-sm text-info-text">{t('plans.trialEnds', { date: new Date(data.trial.endAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB') })}</p>}
    {!compact && <p className="text-xs leading-5 text-text-muted">{t('plans.aiHelp')}</p>}
    {showUpgrade && data.plan !== 'pro' && <UpgradePaywall source="usage-panel" />}
  </section>;
}
