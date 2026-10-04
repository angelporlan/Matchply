'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/** Only display catalog prices validated by the billing endpoint. */
export function usePaywallPrices() {
  const { language } = useLanguage();
  const [prices, setPrices] = useState<{ monthlyPrice?: string; annualPrice?: string; trialEligible?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/stripe/catalog', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const catalog = await response.json();
      const format = new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-GB', { style: 'currency', currency: catalog.currency });
      setPrices({ monthlyPrice: catalog.monthly.available ? format.format(catalog.monthly.amount) : undefined,
        annualPrice: catalog.annual.available ? format.format(catalog.annual.amount) : undefined,
        trialEligible: catalog.trialEligible === true });
    }).catch(() => undefined);
    return () => controller.abort();
  }, [language]);
  return prices;
}
