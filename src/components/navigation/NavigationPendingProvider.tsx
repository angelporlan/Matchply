'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  hrefMatchesLocation,
  isModifiedNavigationClick,
  navigationWaitState,
} from '@/lib/navigation-pending';

type NavigationPendingContextValue = {
  pendingHref: string | null;
  announceSlow: boolean;
  offerRecovery: boolean;
  beginNavigation: (href: string, event?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }) => void;
  clearPending: () => void;
  retryPending: () => void;
};

const NavigationPendingContext = createContext<NavigationPendingContextValue | null>(null);

export function useNavigationPending() {
  const value = useContext(NavigationPendingContext);
  if (!value) {
    return {
      pendingHref: null,
      announceSlow: false,
      offerRecovery: false,
      beginNavigation: () => {},
      clearPending: () => {},
      retryPending: () => {},
    } satisfies NavigationPendingContextValue;
  }
  return value;
}

export function NavigationPendingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const pendingHrefRef = useRef<string | null>(null);
  pendingHrefRef.current = pendingHref;

  const clearPending = useCallback(() => {
    setPendingHref(null);
    setPendingSince(null);
    setElapsedMs(0);
  }, []);

  const beginNavigation = useCallback((href: string, event?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }) => {
    if (event && isModifiedNavigationClick(event)) return;
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (hrefMatchesLocation(href, pathname, search)) {
      clearPending();
      return;
    }
    setPendingHref(href);
    setPendingSince(Date.now());
    setElapsedMs(0);
  }, [clearPending, pathname]);

  const retryPending = useCallback(() => {
    if (!pendingHrefRef.current) return;
    const href = pendingHrefRef.current;
    setPendingSince(Date.now());
    setElapsedMs(0);
    router.push(href);
  }, [router]);

  useEffect(() => {
    if (!pendingHref) return;
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (hrefMatchesLocation(pendingHref, pathname, search)) {
      clearPending();
    }
  }, [clearPending, pathname, pendingHref]);

  useEffect(() => {
    const syncFromHistory = () => {
      const href = pendingHrefRef.current;
      if (!href) return;
      if (hrefMatchesLocation(href, window.location.pathname, window.location.search)) {
        clearPending();
      }
    };
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, [clearPending]);

  useEffect(() => {
    if (!pendingHref || !pendingSince) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - pendingSince);
    }, 400);
    return () => window.clearInterval(id);
  }, [pendingHref, pendingSince]);

  const { announceSlow, offerRecovery } = navigationWaitState(elapsedMs);

  const value = useMemo<NavigationPendingContextValue>(() => ({
    pendingHref,
    announceSlow,
    offerRecovery,
    beginNavigation,
    clearPending,
    retryPending,
  }), [announceSlow, beginNavigation, clearPending, offerRecovery, pendingHref, retryPending]);

  return (
    <NavigationPendingContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite">
        {pendingHref && announceSlow ? t('sidebar.nav.waiting') : ''}
      </div>
      {pendingHref && offerRecovery && (
        <div className="fixed bottom-4 left-4 right-4 md:left-72 z-[60] rounded-[12px] border border-subtle bg-surface shadow-dialog px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-text font-sans flex-1">{t('sidebar.nav.stuck')}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={retryPending}
              className="px-3 py-2 rounded-[8px] bg-action text-on-action text-xs font-bold font-display"
            >
              {t('sidebar.nav.retry')}
            </button>
            <button
              type="button"
              onClick={clearPending}
              className="px-3 py-2 rounded-[8px] border border-subtle text-text-muted text-xs font-bold font-display"
            >
              {t('sidebar.nav.dismiss')}
            </button>
          </div>
        </div>
      )}
    </NavigationPendingContext.Provider>
  );
}
