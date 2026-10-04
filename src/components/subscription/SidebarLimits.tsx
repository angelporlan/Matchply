'use client';

import { useState, useEffect, useRef } from 'react';
import { Gauge, ChevronDown, Calendar } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { quotaState, type QuotaBucketView } from '@/lib/plan-presentation';
import { usePlanUsage } from './PlanUsageProvider';
import { recordPaywallEvent } from './UpgradePaywall';

export default function SidebarLimits() {
  const { data, loading, error } = usePlanUsage();
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const reported = useRef(new Set<string>());

  useEffect(() => {
    if (!data) return;
    for (const key of ['general', 'matching', 'research'] as const) {
      const bucket = data.usage[key];
      if (!bucket) continue;
      const identity = `${key}:${bucket.resetAt || 'guest'}:${data.configVersion}`;
      if (quotaState(bucket) === 'warning' && !reported.current.has(identity)) {
        reported.current.add(identity);
        recordPaywallEvent('quota_warning', `usage-${key}`);
      }
    }
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-between bg-surface-muted/30 border border-subtle px-3 py-2 rounded-[10px] shadow-xs animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-surface-muted rounded" />
          <div className="w-14 h-3 bg-surface-muted rounded" />
        </div>
        <div className="w-8 h-3 bg-surface-muted rounded" />
      </div>
    );
  }

  if (error && !data) {
    return null;
  }

  if (!data) return null;

  // Active quota buckets
  const quotaBuckets = (['general', 'matching', 'research'] as const)
    .map((key) => ({ key, bucket: data.usage[key] }))
    .filter(({ bucket }) => Boolean(bucket && bucket.limit > 0));

  // Calculated percentage across active quota limits
  const totalQuotaPercent = quotaBuckets.reduce((acc, { bucket }) => {
    const used = (bucket.used || 0) + (bucket.reserved || 0);
    return acc + Math.min(100, (used / bucket.limit) * 100);
  }, 0);

  const calculatedPercent =
    quotaBuckets.length > 0
      ? Math.min(100, Math.max(0, Math.round(totalQuotaPercent / quotaBuckets.length)))
      : 0;

  const hasExhausted = quotaBuckets.some(({ bucket }) => quotaState(bucket) === 'exhausted');
  const hasWarning = !hasExhausted && quotaBuckets.some(({ bucket }) => quotaState(bucket) === 'warning');

  const badgeClass = hasExhausted
    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
    : hasWarning
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    : 'bg-surface text-text-muted dark:text-slate-300 border-subtle';

  // Common renewal date if available
  const resetAt =
    data.usage.general?.resetAt ||
    data.usage.matching?.resetAt ||
    data.usage.research?.resetAt;

  const formattedRenewal = resetAt
    ? new Date(resetAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB')
    : null;

  return (
    <div className="rounded-[10px] border border-subtle bg-surface-muted/30 shadow-xs overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="sidebar-limits-content"
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-muted/60 transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Gauge className="w-3.5 h-3.5 text-text-muted group-hover:text-text transition-colors stroke-[1.75] shrink-0" />
          <span className="text-[11px] font-bold text-text-muted group-hover:text-text transition-colors font-display truncate">
            {t('plans.limits')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[5px] border ${badgeClass} font-mono leading-none`}>
            {calculatedPercent}%
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 stroke-[1.75] ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          id="sidebar-limits-content"
          className="px-3 pb-3 pt-2.5 border-t border-subtle/60 space-y-3 bg-surface/50"
        >
          {/* Exact limits for each quota bucket */}
          {quotaBuckets.map(({ key, bucket }) => {
            const state = quotaState(bucket);
            const usedTotal = bucket.used + bucket.reserved;
            const percent = Math.min(100, Math.round((usedTotal / Math.max(1, bucket.limit)) * 100));

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] leading-tight">
                  <span className="font-semibold text-text truncate font-display">
                    {t(`plans.${key}`)}
                  </span>
                  <span className="text-text-muted font-mono text-[10px] shrink-0 font-medium">
                    {bucket.used} de {bucket.limit}
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="w-full h-1.5 bg-surface-muted dark:bg-canvas rounded-full overflow-hidden border border-subtle/40"
                  role="progressbar"
                  aria-valuenow={usedTotal}
                  aria-valuemin={0}
                  aria-valuemax={bucket.limit}
                  aria-label={t(`plans.${key}`)}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      state === 'exhausted'
                        ? 'bg-rose-500'
                        : state === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-text-muted font-sans">
                  <span>{t('plans.remaining', { remaining: bucket.remaining })}</span>
                  {bucket.reserved > 0 && (
                    <span className="text-[9px] text-amber-500 font-medium">
                      {t('plans.reserved', { reserved: bucket.reserved })}
                    </span>
                  )}
                </div>

                {state !== 'available' && (
                  <p
                    className={`text-[9px] ${
                      state === 'exhausted' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-500 dark:text-amber-400'
                    }`}
                  >
                    {t(`plans.${state === 'warning' ? 'warning' : 'exhausted'}`, {
                      bucket: t(`plans.${key}`).toLocaleLowerCase(language),
                    })}
                  </p>
                )}
              </div>
            );
          })}

          {/* CVs guardados */}
          <div className="pt-2 border-t border-subtle/50 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-text truncate font-display">
              {t('plans.cvs')}
            </span>
            <span className="text-text-muted font-mono text-[10px] font-medium shrink-0">
              {data.cv.total} / {data.cv.max === null ? t('plans.unlimited') : data.cv.max}
            </span>
          </div>

          {/* Renewal Date */}
          {formattedRenewal && (
            <div className="pt-1 border-t border-subtle/40 flex items-center gap-1.5 text-[10px] text-text-muted font-sans">
              <Calendar className="w-3 h-3 stroke-[1.75] shrink-0 text-text-muted" />
              <span className="truncate">{t('plans.renews', { date: formattedRenewal })}</span>
            </div>
          )}

          {/* Pro trial expiration notice */}
          {data.plan === 'pro' && data.trial?.endAt && new Date(data.trial.endAt).getTime() > Date.now() && (
            <p className="text-[10px] text-info-text text-center font-sans pt-1">
              {t('plans.trialEnds', {
                date: new Date(data.trial.endAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB'),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
