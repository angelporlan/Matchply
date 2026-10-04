'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PlanUsageSnapshot } from '@/lib/plan-presentation';

type UsageState = { data: PlanUsageSnapshot | null; error: boolean; loading: boolean; refresh: () => Promise<void> };
const UsageContext = createContext<UsageState | null>(null);

function useUsageRequest(enabled: boolean): UsageState {
  const [data, setData] = useState<PlanUsageSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch('/api/usage', { cache: 'no-store' });
      if (!response.ok) throw new Error('USAGE_UNAVAILABLE');
      setData(await response.json());
      setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener('matchply:usage-refresh', onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener('matchply:usage-refresh', onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [enabled, refresh]);
  return { data, error, loading, refresh };
}

export function PlanUsageProvider({ children }: { children: React.ReactNode }) {
  const state = useUsageRequest(true);
  return <UsageContext.Provider value={state}>{children}</UsageContext.Provider>;
}

export function usePlanUsage() {
  const context = useContext(UsageContext);
  const fallback = useUsageRequest(!context);
  return context || fallback;
}
