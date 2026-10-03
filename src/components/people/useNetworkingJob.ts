'use client';
import { useEffect, useRef, useState } from 'react';
import type { NetworkingAction } from '@/lib/people/types';

export function useNetworkingJob(personId: string, initialJobId: string | null, onComplete: () => void) {
  const [jobId, setJobId] = useState<string | null>(initialJobId), [posting, setPosting] = useState(false), [error, setError] = useState('');
  const callback = useRef(onComplete); callback.current = onComplete;
  const pending = useRef<{ signature: string; requestId: string } | null>(null);
  useEffect(() => {
    if (!jobId) return;
    const abort = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/ai/jobs/${jobId}`, { cache: 'no-store', signal: abort.signal });
        if (res.status === 404 || res.status === 403 || res.status === 401) { setJobId(null); setError('PEOPLE_ACTION_FAILED'); return; }
        if (res.ok) {
          const job = await res.json();
          if (job.status === 'completed') { setJobId(null); pending.current = null; callback.current(); return; }
          if (job.status === 'failed') { setJobId(null); pending.current = null; setError(job.lastError || 'NETWORKING_UNAVAILABLE'); callback.current(); return; }
        }
      } catch { if (abort.signal.aborted) return; }
      if (!abort.signal.aborted) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [jobId]);
  const start = async (action: NetworkingAction, extra: { threadId?: string; importId?: string; offerId?: string; includeCandidate?: boolean } = {}) => {
    if (jobId || posting) return;
    setError(''); setPosting(true);
    const signature = JSON.stringify({ action, extra });
    if (pending.current?.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() };
    try {
      const res = await fetch('/api/ai/networking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId, action, requestId: pending.current.requestId, ...extra }) });
      const value = await res.json();
      if (!res.ok) { if (res.status === 429) throw new Error('TOO_MANY_REQUESTS'); throw new Error(value.error || 'NETWORKING_UNAVAILABLE'); }
      setJobId(value.jobId); pending.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : 'NETWORKING_UNAVAILABLE'); }
    finally { setPosting(false); }
  };
  return { start, busy: posting || !!jobId, error, jobId };
}
export type NetworkingJobControl = ReturnType<typeof useNetworkingJob>;
