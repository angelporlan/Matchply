'use client';

import { useEffect, useRef, useState } from 'react';
import type { BillingIntervalState } from '@/lib/billing-interval';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/Button';

/** Schedule a future frequency change without replacing the subscriber's current contract. */
export function SubscriberInterval() {
  const { t, language } = useLanguage();
  const [state, setState] = useState<BillingIntervalState | null>(null);
  const [catalog, setCatalog] = useState<{ currency: string; monthly: { amount: number; available: boolean }; annual: { amount: number; available: boolean } } | null>(null);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('annual');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState(false);
  const request = useRef<{ interval: 'monthly' | 'annual'; id: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/stripe/interval', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (response.status === 404) { setMissing(true); return; }
      if (!response.ok) throw new Error('INTERVAL_UNAVAILABLE');
      const next: BillingIntervalState = await response.json();
      setState(next); setInterval(next.scheduled?.interval || (next.currentInterval === 'annual' ? 'monthly' : 'annual'));
    }).catch(() => { if (!controller.signal.aborted) setError('plans.intervalError'); });
    void fetch('/api/stripe/catalog', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
      setCatalog(await response.json());
    }).catch(() => { if (!controller.signal.aborted) setError('plans.intervalError'); });
    return () => controller.abort();
  }, []);
  if (missing) return null;
  const formatDate = (value: string) => new Date(value).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB');
  const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-GB', { style: 'currency', currency }).format(amount);
  async function save() {
    if (pending || !state?.canChange || !catalog?.[interval].available) return;
    if (request.current?.interval !== interval) request.current = { interval, id: crypto.randomUUID() };
    setPending(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/stripe/interval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval, requestId: request.current.id }) });
      if (!response.ok) throw new Error('INTERVAL_UNAVAILABLE');
      setState(await response.json()); setSaved(true); request.current = null;
    } catch { setError('plans.intervalError'); }
    finally { setPending(false); }
  }
  return <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-4" aria-labelledby="subscriber-interval-title">
    <h2 id="subscriber-interval-title" className="font-display text-lg font-semibold">{t('plans.intervalTitle')}</h2>
    <p className="text-sm leading-6 text-text-muted">{t('plans.intervalHelp')}</p>
    {state?.currentInterval && <p className="text-sm">{t('plans.currentBilling', { interval: t(state.currentInterval === 'annual' ? 'plans.year' : 'plans.month'), amount: state.currentPrice ? formatAmount(state.currentPrice.amount, state.currentPrice.currency) : '' })}</p>}
    {state?.scheduled && <p role="status" className="rounded-[8px] bg-info-surface p-3 text-sm text-info-text">{t('plans.scheduledBilling', { interval: t(state.scheduled.interval === 'annual' ? 'plans.year' : 'plans.month'), date: formatDate(state.scheduled.effectiveAt) })}</p>}
    {state?.canChange && <fieldset disabled={pending} className="space-y-3"><legend className="text-sm font-medium">{t('plans.nextBilling')}</legend>
      <div className="flex flex-wrap gap-4">{(['monthly', 'annual'] as const).map(value => <label key={value} className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="subscriber-interval" disabled={!catalog?.[value].available} checked={interval === value} onChange={() => { setInterval(value); setSaved(false); }} /><span>{t(value === 'annual' ? 'plans.year' : 'plans.month')}{catalog && <span className="block text-xs text-text-muted">{t(value === 'annual' ? 'plans.annualTotal' : 'plans.monthlyTotal', { amount: formatAmount(catalog[value].amount, catalog.currency) })}</span>}</span></label>)}</div>
      {state.renewsAt && <p className="text-xs text-text-muted">{t('plans.intervalEffective', { date: formatDate(state.renewsAt) })}</p>}
      <Button type="button" variant="strong" loading={pending} disabled={!catalog?.[interval].available || interval === (state.scheduled?.interval || state.currentInterval)} onClick={() => void save()}>{t(pending ? 'plans.publishing' : 'plans.scheduleBilling')}</Button>
    </fieldset>}
    {state && !state.canChange && <p className="text-sm text-text-muted">{t('plans.intervalPortal')}</p>}
    {!state && !error && <p role="status" className="text-sm text-text-muted">{t('plans.loading')}</p>}
    {error && <p role="alert" className="text-sm text-danger-text">{t(error)}</p>}
    {saved && <p role="status" className="text-sm text-success-text">{t('plans.intervalSaved')}</p>}
  </section>;
}
