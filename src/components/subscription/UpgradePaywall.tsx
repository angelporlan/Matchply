'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { interpolatePlanCopy, type PlanRestriction } from '@/lib/plan-presentation';
import { renderPaywallCopy, type PlanLimits } from '@/lib/plan-config';
import { Button, ButtonLink } from '@/components/ui/Button';
import { usePlanUsage } from './PlanUsageProvider';
import { PlanDialog } from './PlanDialog';
import { usePaywallPrices } from './usePaywallPrices';

type Presentation = {
  variant: 'a' | 'b' | null; experimentVersion: number; mode: 'ab' | 'a' | 'b' | 'paused';
  copy: { es: { title: string; body: string; cta: string }; en: { title: string; body: string; cta: string } };
  limits: PlanLimits;
};

export function recordPaywallEvent(event: 'paywall_view' | 'paywall_cta' | 'quota_warning' | 'quota_blocked', source: string) {
  void fetch('/api/monetization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, source, requestId: crypto.randomUUID() }), keepalive: true }).catch(() => undefined);
}

export function UpgradePaywall({ source, compact = false, dismissible = false, accountId }: { source: string; compact?: boolean; dismissible?: boolean; accountId?: string }) {
  const { t, language } = useLanguage();
  const { data } = usePlanUsage();
  const prices = usePaywallPrices();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [presentationFailed, setPresentationFailed] = useState(false);
  const exposed = useRef(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissalKnown, setDismissalKnown] = useState(!dismissible);
  const dismissKey = accountId && data?.firstValueAt ? `matchply:upsell-dismissed:${accountId}:${data.firstValueAt}` : null;
  useEffect(() => {
    if (!dismissible) return;
    if (!dismissKey) { setDismissalKnown(false); return; }
    try { setDismissed(localStorage.getItem(dismissKey) === '1'); } catch { setDismissed(false); }
    setDismissalKnown(true);
  }, [dismissKey, dismissible]);
  useEffect(() => {
    if (!data?.firstValueAt || data.plan === 'pro' || dismissed || !dismissalKnown) return;
    let active = true;
    void fetch('/api/monetization', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('PAYWALL_UNAVAILABLE');
      const next: Presentation = await response.json();
      if (active) setPresentation(next);
    }).catch(() => { if (active) setPresentationFailed(true); });
    return () => { active = false; };
  }, [data?.firstValueAt, data?.plan, dismissed, dismissalKnown]);
  useEffect(() => {
    if (!presentation?.variant || exposed.current || dismissed || !dismissalKnown) return;
    exposed.current = true;
    recordPaywallEvent('paywall_view', source);
  }, [presentation, source, dismissed, dismissalKnown]);
  if (dismissible && (!dismissalKnown || dismissed)) return null;
  if (data?.plan === 'pro') return <ButtonLink href="/api/stripe/portal" variant="secondary">{t('plans.manage')}</ButtonLink>;
  if (data?.firstValueAt && !presentation && !presentationFailed) return <p role="status" className="text-sm text-text-muted">{t('plans.loading')}</p>;
  const copy = presentation?.variant ? renderPaywallCopy(presentation.copy[language], presentation.limits, prices) : null;
  const values = {
    generalLimit: data?.limits.generalAiMonthly,
    matchingLimit: data?.limits.matchingMonthly,
    researchLimit: data?.limits.researchMonthly,
    cvLimit: data?.limits.maxCvs === null ? t('plans.unlimited') : data?.limits.maxCvs,
    remaining: data?.usage.general.remaining,
    resetAt: data?.usage.general.resetAt ? new Date(data.usage.general.resetAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB') : '',
  };
  const render = (value: string) => interpolatePlanCopy(value, values);
  return (
    <div className={compact ? 'space-y-2' : 'relative rounded-[12px] border border-subtle bg-surface p-5 space-y-3'}>
      {dismissible && <button type="button" aria-label={t('plans.dismissUpsell')} className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] text-text-muted hover:bg-surface-muted" onClick={() => { setDismissed(true); if (dismissKey) { try { localStorage.setItem(dismissKey, '1'); } catch { /* The card stays dismissed for this visit. */ } } }}><X className="h-4 w-4" aria-hidden="true" /></button>}
      {!compact && copy && <><h3 className={`font-display font-semibold text-text ${dismissible ? 'pr-10' : ''}`}>{render(copy.title)}</h3><p className="text-sm leading-6 text-text-muted">{render(copy.body)}</p></>}
      <ButtonLink href={`/dashboard/subscription?source=${encodeURIComponent(source)}`} variant="strong" onClick={() => { if (presentation?.variant) recordPaywallEvent('paywall_cta', source); }}>
        {copy && prices.trialEligible ? render(copy.cta) : t('plans.upgrade')}
      </ButtonLink>
    </div>
  );
}

export function PlanFeedback() {
  const { data, refresh } = usePlanUsage();
  const { t, language } = useLanguage();
  const [restriction, setRestriction] = useState<PlanRestriction | null>(null);
  useEffect(() => {
    const onRestriction = (event: Event) => {
      const next = (event as CustomEvent<PlanRestriction>).detail;
      setRestriction(next);
      void refresh();
      if (next.kind === 'quota') recordPaywallEvent('quota_blocked', next.source);
    };
    window.addEventListener('matchply:plan-restriction', onRestriction);
    return () => window.removeEventListener('matchply:plan-restriction', onRestriction);
  }, [refresh]);
  const bucket = restriction?.bucket ? data?.usage[restriction.bucket] : null;
  const feedbackKey = restriction?.kind === 'rate' ? 'plans.rateBody' : restriction?.kind === 'progress' ? 'plans.progressBody'
    : restriction?.code === 'MATCH_BATCH_TOO_LARGE' ? 'plans.batchBody' : bucket ? 'plans.quotaBody' : 'plans.limitBody';
  return <PlanDialog open={!!restriction} title={t(restriction?.kind === 'quota' ? 'plans.limitTitle' : 'plans.waitTitle')} onClose={() => setRestriction(null)}>
    <p className="mt-4 text-sm leading-6 text-text-muted">{t(feedbackKey, { limit: restriction?.limit ?? data?.limits.matchBatchSize ?? 0 })}</p>
    {bucket && <div className="mt-4 rounded-[8px] bg-warning-surface p-3 text-sm text-warning-text">
      <p>{t('plans.used', { used: bucket.used + bucket.reserved, limit: bucket.limit })}</p>
      {bucket.resetAt && <p>{t('plans.renews', { date: new Date(bucket.resetAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB') })}</p>}
    </div>}
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
      <Button type="button" variant="secondary" onClick={() => setRestriction(null)}>{t('plans.close')}</Button>
      {restriction?.code === 'CV_READ_ONLY' && <ButtonLink href="/dashboard" variant="secondary">{t('plans.chooseActive')}</ButtonLink>}
      {restriction?.kind === 'quota' && data?.plan !== 'pro' && <UpgradePaywall source={restriction?.source || 'quota'} compact />}
    </div>
  </PlanDialog>;
}
