'use client';

import { useNavigationPending } from '@/components/navigation/NavigationPendingProvider';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-diagnostics';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();
  const { clearPending } = useNavigationPending();

  useEffect(() => {
    clearPending();
    reportClientError(error, 'page');
  }, [clearPending, error]);

  return (
    <div className="max-w-xl mx-auto px-6 py-16 space-y-4">
      <h1 className="text-xl font-bold font-display text-text">{t('sidebar.nav.error')}</h1>
      <p className="text-sm text-text-muted font-sans">{t('sidebar.nav.stuck')}</p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 rounded-[8px] bg-action text-on-action text-sm font-bold font-display"
      >
        {t('sidebar.nav.retry')}
      </button>
    </div>
  );
}
