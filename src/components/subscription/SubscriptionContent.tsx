'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanConfig } from '@/lib/plan-config';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ButtonLink } from '@/components/ui/Button';
import { refreshPlanUsage } from '@/lib/plan-presentation';
import { UsagePanel } from './UsagePanel';
import { PlanComparison } from './PlanComparison';
import { SubscriberInterval } from './SubscriberInterval';

export default function SubscriptionContent({ config, isPremium }: { config: PlanConfig; isPremium: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('checkout') !== 'success' || !sessionId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    setConfirmation('pending');
    const confirm = async () => {
      try {
        const response = await fetch(`/api/stripe/status?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('CHECKOUT_STATUS_UNAVAILABLE');
        const result = await response.json();
        setConfirmation(result.status);
        if (result.status === 'canceled') return;
        if (result.status === 'trialing' || result.status === 'active') { refreshPlanUsage(); router.refresh(); return; }
      } catch { if (controller.signal.aborted) return; }
      attempts += 1;
      if (attempts < 10 && !controller.signal.aborted) timer = setTimeout(() => void confirm(), 3000);
    };
    void confirm();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [router]);
  return <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
    <div className="flex flex-wrap gap-4 justify-between items-start"><h1 className="font-display text-2xl sm:text-3xl font-semibold">{t('plans.title')}</h1>{isPremium && <ButtonLink href="/api/stripe/portal" variant="secondary">{t('plans.manage')}</ButtonLink>}</div>
    {confirmation && <p role="status" className="rounded-[8px] bg-info-surface p-3 text-sm text-info-text">{t(confirmation === 'active' || confirmation === 'trialing' ? 'plans.paymentConfirmed' : confirmation === 'canceled' ? 'plans.paymentCanceled' : 'plans.paymentPending')}</p>}
    <UsagePanel />
    {isPremium && <SubscriberInterval />}
    <PlanComparison config={config} showCheckout={!isPremium} source="subscription" />
  </main>;
}
