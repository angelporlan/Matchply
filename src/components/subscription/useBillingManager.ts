'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { BillingIntervalState } from '@/lib/billing-interval';

export type BillingInterval = 'monthly' | 'annual';

export type BillingCatalogOffer = {
  amount: number;
  available: boolean;
};

export type BillingCatalogData = {
  currency: string;
  trialDays: number;
  trialEligible: boolean;
  discountPercent: number;
  monthly: BillingCatalogOffer;
  annual: BillingCatalogOffer;
};

export function useBillingManager(isPremium: boolean, source = 'subscription') {
  const { t, language } = useLanguage();
  const [catalog, setCatalog] = useState<BillingCatalogData | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const [subscriberInterval, setSubscriberInterval] = useState<BillingIntervalState | null>(null);
  const [schedulePending, setSchedulePending] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const checkoutRequest = useRef<{ interval: BillingInterval; id: string } | null>(null);
  const scheduleRequest = useRef<{ interval: BillingInterval; id: string } | null>(null);

  // Sync interval from query param if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = new URLSearchParams(window.location.search).get('interval');
    if (requested === 'annual' || requested === 'monthly') {
      setInterval(requested);
    }
  }, []);

  // Fetch catalog
  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    setCatalogLoading(true);
    try {
      const response = await fetch('/api/stripe/catalog', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
      const data: BillingCatalogData = await response.json();
      setCatalog(data);
      setCatalogError('');
    } catch {
      if (!signal?.aborted) {
        setCatalogError(t('plans.catalogueError'));
      }
    } finally {
      if (!signal?.aborted) setCatalogLoading(false);
    }
  }, [t]);

  // Fetch subscriber interval if premium
  const loadSubscriberInterval = useCallback(async (signal?: AbortSignal) => {
    if (!isPremium) return;
    try {
      const response = await fetch('/api/stripe/interval', { cache: 'no-store', signal });
      if (response.status === 404) return;
      if (!response.ok) throw new Error('INTERVAL_UNAVAILABLE');
      const data: BillingIntervalState = await response.json();
      setSubscriberInterval(data);
      if (data.scheduled?.interval) {
        setInterval(data.scheduled.interval);
      } else if (data.currentInterval) {
        setInterval(data.currentInterval === 'annual' ? 'monthly' : 'annual');
      }
    } catch {
      if (!signal?.aborted) {
        setScheduleError(t('plans.intervalError'));
      }
    }
  }, [isPremium, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    if (isPremium) {
      void loadSubscriberInterval(controller.signal);
    }
    return () => controller.abort();
  }, [loadCatalog, loadSubscriberInterval, isPremium]);

  const formatAmount = useCallback((amount: number, currency = catalog?.currency || 'EUR') => {
    return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }, [language, catalog?.currency]);

  const checkout = useCallback(async () => {
    if (checkoutPending || !catalog?.[interval]?.available) return;
    if (!checkoutRequest.current || checkoutRequest.current.interval !== interval) {
      checkoutRequest.current = { interval, id: crypto.randomUUID() };
    }
    setCheckoutPending(true);
    setCheckoutError('');

    const subscriptionUrl = `/dashboard/subscription?interval=${interval}&source=${encodeURIComponent(source)}`;

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval,
          source,
          requestId: checkoutRequest.current.id,
          returnTo: '/dashboard/subscription',
        }),
      });

      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(subscriptionUrl)}`);
        return;
      }

      const result = await response.json();
      if (!response.ok || typeof result.url !== 'string') {
        throw new Error('CHECKOUT_FAILED');
      }
      window.location.assign(result.url);
    } catch {
      setCheckoutError(t('plans.checkoutError'));
    } finally {
      setCheckoutPending(false);
    }
  }, [catalog, interval, checkoutPending, source, t]);

  const scheduleIntervalChange = useCallback(async (targetInterval: BillingInterval) => {
    if (schedulePending || !subscriberInterval?.canChange || !catalog?.[targetInterval]?.available) return;
    if (scheduleRequest.current?.interval !== targetInterval) {
      scheduleRequest.current = { interval: targetInterval, id: crypto.randomUUID() };
    }
    setSchedulePending(true);
    setScheduleError('');
    setScheduleSaved(false);

    try {
      const response = await fetch('/api/stripe/interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval: targetInterval,
          requestId: scheduleRequest.current.id,
        }),
      });
      if (!response.ok) throw new Error('INTERVAL_UNAVAILABLE');
      const updated: BillingIntervalState = await response.json();
      setSubscriberInterval(updated);
      setScheduleSaved(true);
      scheduleRequest.current = null;
    } catch {
      setScheduleError(t('plans.intervalError'));
    } finally {
      setSchedulePending(false);
    }
  }, [schedulePending, subscriberInterval?.canChange, catalog, t]);

  return {
    catalog,
    catalogLoading,
    catalogError,
    reloadCatalog: loadCatalog,
    interval,
    setInterval,
    checkout,
    checkoutPending,
    checkoutError,
    subscriberInterval,
    scheduleIntervalChange,
    schedulePending,
    scheduleError,
    scheduleSaved,
    formatAmount,
  };
}
