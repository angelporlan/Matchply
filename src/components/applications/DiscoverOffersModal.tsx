'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { refreshPlanUsage, reportPlanRestriction } from '@/lib/plan-presentation';
import { initialDiscoveryProgress, type DiscoveryProgress } from '@/lib/offer-discovery/types';
import ApplicationScoreBadge from './ApplicationScoreBadge';
import { InlineAllowance } from '@/components/subscription/InlineAllowance';

type DiscoveryJob = { id: string; status: string; result: DiscoveryProgress | null; lastError: string | null };

export default function DiscoverOffersModal({ isOpen, onClose, onCompleted }: {
  isOpen: boolean; onClose: () => void; onCompleted: (result: DiscoveryProgress) => void;
}) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [job, setJob] = useState<DiscoveryJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const requestId = useRef<string | null>(null);
  const startingRef = useRef(false);
  const completedRef = useRef(onCompleted);
  const notified = useRef(new Set<string>());
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { completedRef.current = onCompleted; }, [onCompleted]);
  const busy = job?.status === 'queued' || job?.status === 'running';
  const jobId = job?.id;
  const progress = job?.result ?? initialDiscoveryProgress();

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch('/api/ai/offers/discover', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) { reportPlanRestriction(data, 'discover_offers'); throw new Error(data.code || 'DISCOVERY_UNAVAILABLE'); }
      if (!controller.signal.aborted) setJob(data.job);
    }).catch(() => { if (!controller.signal.aborted) setError('DISCOVERY_UNAVAILABLE'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [isOpen]);

  // Continue polling when the dialog is closed; reopening/reloading also finds the persisted job.
  useEffect(() => {
    if (!jobId || !busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/ai/jobs/${jobId}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!response.ok) throw new Error('DISCOVERY_POLL_FAILED');
        const current = await response.json() as DiscoveryJob;
        if (controller.signal.aborted) return;
        setPollError(false);
        setJob(current);
        if (current.status === 'completed' || current.status === 'failed') {
          refreshPlanUsage();
          if (current.status === 'completed' && current.result && !notified.current.has(current.id)) {
            notified.current.add(current.id);
            completedRef.current(current.result);
          }
          return;
        }
      } catch { if (controller.signal.aborted) return; setPollError(true); }
      timer = setTimeout(poll, 4000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [jobId, busy]);

  const start = async () => {
    if (startingRef.current || busy) return;
    startingRef.current = true;
    setStarting(true); setError(null); setPollError(false); setJob(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch('/api/ai/offers/discover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: requestId.current }), signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) {
        requestId.current = null;
        reportPlanRestriction(data, 'discover_offers');
        throw new Error(data.code || 'DISCOVERY_UNAVAILABLE');
      }
      setJob({ id: data.jobId, status: 'queued', result: initialDiscoveryProgress(), lastError: null });
      requestId.current = null;
      refreshPlanUsage();
    } catch (failure) {
      // Retain the request ID after a lost response so retrying cannot enqueue a second search.
      setError(failure instanceof Error ? failure.message : 'DISCOVERY_UNAVAILABLE');
    } finally { startingRef.current = false; setStarting(false); }
  };

  const errorText = (code: string) => {
    const key = `offerDiscovery.errors.${code}`;
    const message = t(key);
    return message === key ? t('offerDiscovery.errors.DISCOVERY_UNAVAILABLE') : message;
  };

  if (!mounted || !isOpen) return null;
  return createPortal(
    <dialog ref={node => { if (node && !node.open) node.showModal(); }}
      onCancel={event => { event.preventDefault(); onClose(); }}
      aria-labelledby="offer-discovery-title" aria-describedby="offer-discovery-help"
      className="w-[calc(100%_-_2rem)] max-w-xl max-h-[calc(100dvh_-_2rem)] p-0 rounded-xl border border-border-subtle bg-surface text-text shadow-xl backdrop:bg-black/50">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="offer-discovery-title" className="font-display text-xl font-bold flex items-center gap-2">
            <Search className="w-5 h-5 text-ai-text stroke-[1.75] shrink-0" aria-hidden="true" />
            {t('offerDiscovery.title')}
          </h2>
          <Button variant="ghost" onClick={onClose} aria-label={t('offerDiscovery.close')} className="shrink-0 min-w-11 min-h-11 p-2">
            <X className="w-5 h-5 stroke-[1.75]" aria-hidden="true" />
          </Button>
        </div>
        <p id="offer-discovery-help" className="text-sm text-text-muted mt-3 leading-relaxed">{t('offerDiscovery.help')}</p>
        <p className="text-xs text-text-muted mt-2">{t('offerDiscovery.usage')}</p>
        <div className="mt-2"><InlineAllowance bucket="discovery" /></div>

        <div role="status" aria-live="polite" className="mt-5">
          {(busy || starting || loading) && <div className="rounded-lg bg-ai-surface border border-border-subtle p-4 text-sm text-ai-text">
            <p className="font-semibold">{t(`offerDiscovery.stages.${loading ? 'loading' : progress.stage}`)}</p>
            {busy && <p className="mt-1 text-text-muted">{t('offerDiscovery.background')}</p>}
          </div>}
          {pollError && <p className="mt-3 text-sm text-warning-text">{t('offerDiscovery.connection')}</p>}
          {job?.status === 'completed' && <div className={`rounded-lg p-4 text-sm ${progress.added.length ? 'bg-success-surface' : 'bg-info-surface'}`}>
            <p className={`font-semibold flex items-start gap-2 ${progress.added.length ? 'text-success-text' : 'text-info-text'}`}>
              {progress.added.length ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.75]" aria-hidden="true" /> : <Search className="w-4 h-4 shrink-0 mt-0.5 stroke-[1.75]" aria-hidden="true" />}
              {progress.added.length ? t(progress.added.length === 1 ? 'offerDiscovery.completedOne' : 'offerDiscovery.completed', { count: progress.added.length }) : t('offerDiscovery.empty')}
            </p>
            {progress.duplicates > 0 && <p className="mt-2 text-text-muted">{t(progress.duplicates === 1 ? 'offerDiscovery.duplicatesOne' : 'offerDiscovery.duplicates', { count: progress.duplicates })}</p>}
            {progress.belowThreshold > 0 && <p className="mt-2 text-text-muted">{t(progress.belowThreshold === 1 ? 'offerDiscovery.belowThresholdOne' : 'offerDiscovery.belowThreshold', { count: progress.belowThreshold })}</p>}
            {progress.evaluationErrors > 0 && <p className="mt-2 text-warning-text">{t(progress.evaluationErrors === 1 ? 'offerDiscovery.evaluationErrorsOne' : 'offerDiscovery.evaluationErrors', { count: progress.evaluationErrors })}</p>}
          </div>}
        </div>
        {(error || job?.status === 'failed') && <p role="alert" className="mt-4 rounded-lg bg-danger-surface p-4 text-sm text-danger-text">
          {errorText(error || job?.lastError || 'DISCOVERY_UNAVAILABLE')}
        </p>}
        {job?.status === 'completed' && progress.added.length > 0 && <ul className="mt-4 space-y-3">
          {progress.added.map(offer => <li key={offer.id} className="rounded-lg border border-border-subtle p-3">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/dashboard/applications/offer/${offer.id}`} className="text-sm font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus rounded break-words">{offer.title}</Link>
              <ApplicationScoreBadge score={offer.score} />
            </div>
            <p className="text-sm text-text-muted mt-1 break-words">{offer.company}</p>
            <a href={offer.url} target="_blank" rel="noopener noreferrer" className="text-xs text-ai-text inline-flex min-h-11 items-center gap-1.5 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus rounded">
              {t('offerDiscovery.source')} <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
            </a>
          </li>)}
        </ul>}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>{t('offerDiscovery.close')}</Button>
          {!busy && <Button variant="ai" loading={starting} disabled={loading} onClick={() => void start()}>
            <Search className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
            {t(job?.status === 'completed' ? 'offerDiscovery.searchAgain' : 'offerDiscovery.start')}
          </Button>}
        </div>
      </div>
    </dialog>, document.body,
  );
}
