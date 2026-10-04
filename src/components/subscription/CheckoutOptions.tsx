'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button, ButtonLink } from '@/components/ui/Button';

type Interval = 'monthly' | 'annual';
type Price = { available: boolean; amount: number; interval: Interval };
type Catalog = { currency: string; trialDays: number; trialEligible: boolean; monthly: Price; annual: Price; discountPercent: number };

export function CheckoutOptions({ source, authenticated = true }: { source: string; authenticated?: boolean }) {
  const { t, language } = useLanguage();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [interval, setInterval] = useState<Interval>('monthly');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const translate = useRef(t); translate.current = t;
  const request = useRef<{ interval: Interval; id: string } | null>(null);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('interval');
    if (requested === 'annual' || requested === 'monthly') setInterval(requested);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/stripe/catalog', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
      const value: Catalog = await response.json();
      setCatalog(value); setError(value.monthly.available || value.annual.available ? '' : translate.current('plans.catalogueError'));
    }).catch(() => { if (!controller.signal.aborted) setError(translate.current('plans.catalogueError')); });
    return () => controller.abort();
  }, [attempt, language]);
  const amount = catalog ? new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-GB', { style: 'currency', currency: catalog.currency.toUpperCase() }).format(catalog[interval].amount) : '';
  const selectionAvailable = !!catalog?.[interval].available;
  const subscriptionUrl = `/dashboard/subscription?interval=${interval}&source=${encodeURIComponent(source)}`;

  async function checkout() {
    if (pending || !selectionAvailable) return;
    if (!request.current || request.current.interval !== interval) request.current = { interval, id: crypto.randomUUID() };
    setPending(true); setError('');
    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interval, source, requestId: request.current.id, returnTo: '/dashboard/subscription' }) });
      if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(subscriptionUrl)}`); return; }
      const result = await response.json();
      if (!response.ok || typeof result.url !== 'string') throw new Error('CHECKOUT_FAILED');
      window.location.assign(result.url);
    } catch { setError(t('plans.checkoutError')); }
    finally { setPending(false); }
  }

  return <div className="space-y-4">
    <fieldset disabled={pending} className="space-y-2"><legend className="text-sm font-semibold">{t('plans.billing')}</legend><div className="grid gap-3 sm:grid-cols-2">
      {(['monthly', 'annual'] as const).map(value => <label key={value} className={`flex gap-3 items-start rounded-[8px] border p-3 ${interval === value ? 'border-control bg-surface-muted' : 'border-subtle bg-surface'}`}>
        <input type="radio" name={`billing-${source}`} checked={interval === value} onChange={() => setInterval(value)} disabled={!catalog?.[value].available} className="mt-1" />
        <span className="text-sm"><span className="block font-semibold">{t(value === 'annual' ? 'plans.year' : 'plans.month')}</span>
          {catalog && <span className="block text-text-muted">{t(value === 'annual' ? 'plans.annualTotal' : 'plans.monthlyTotal', { amount: new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-GB', { style: 'currency', currency: catalog.currency.toUpperCase() }).format(catalog[value].amount) })}</span>}
          {value === 'annual' && catalog && catalog.discountPercent > 0 && <span className="block text-xs text-success-text">{t('plans.saving', { percent: catalog.discountPercent })}</span>}
        </span>
      </label>)}
    </div></fieldset>
    {catalog?.trialEligible && <div className="rounded-[8px] border border-info-text/20 bg-info-surface p-3"><p className="text-sm font-semibold text-info-text">{t('plans.trial', { days: catalog.trialDays })}</p><p className="mt-1 text-xs leading-5 text-info-text">{t('plans.trialTerms', { amount, period: t(interval === 'annual' ? 'plans.perYear' : 'plans.monthly') })}</p></div>}
    {catalog && !catalog.trialEligible && authenticated && <p className="text-xs text-text-muted">{t('plans.trialUsed')}</p>}
    {error && <div role="alert" className="space-y-2"><p className="text-sm text-danger-text">{error}</p>{!catalog && <Button type="button" variant="ghost" size="sm" onClick={() => setAttempt(previous => previous + 1)}>{t('plans.retry')}</Button>}</div>}
    {!catalog && !error && <p role="status" className="text-sm text-text-muted">{t('plans.loading')}</p>}
    {authenticated ? <Button type="button" variant="strong" loading={pending} disabled={!selectionAvailable} onClick={() => void checkout()}>{t(pending ? 'plans.checkoutLoading' : 'plans.checkout')}</Button>
      : <ButtonLink href={`/register?plan=pro&source=${encodeURIComponent(source)}&next=${encodeURIComponent(subscriptionUrl)}`} variant="strong">{t('plans.upgrade')}</ButtonLink>}
    <p className="text-xs leading-5 text-text-muted">{t('plans.noChargeToday')}</p>
  </div>;
}
