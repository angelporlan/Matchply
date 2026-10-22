'use client';

import { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import type { PlanUsageSnapshot } from '@/lib/plan-presentation';
import { createRequestRefresh } from '@/lib/request-refresh';

type UsageState = { data: PlanUsageSnapshot | null; error: boolean; loading: boolean; refresh: () => Promise<void> };
const UsageContext = createContext<UsageState | null>(null);

function useUsageRequest(enabled: boolean): UsageState {
  const [data, setData] = useState<PlanUsageSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const request = useRef<ReturnType<typeof createRequestRefresh<PlanUsageSnapshot>> | null>(null);
  const refresh = useCallback(async () => {
    await request.current?.refresh(true);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const current = createRequestRefresh<PlanUsageSnapshot>(async signal => {
      const response = await fetch('/api/usage', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('USAGE_UNAVAILABLE');
      return response.json();
    }, value => { setData(value); setError(false); setLoading(false); },
    () => { setError(true); setLoading(false); });
    request.current = current;
    void current.refresh();
    const onRefresh = () => void refresh();
    const onFocus = () => void current.refresh();
    window.addEventListener('matchply:usage-refresh', onRefresh);
    window.addEventListener('focus', onFocus);
    return () => {
      current.dispose();
      if (request.current === current) request.current = null;
      window.removeEventListener('matchply:usage-refresh', onRefresh);
      window.removeEventListener('focus', onFocus);
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
