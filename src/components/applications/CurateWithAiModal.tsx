"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import type { ApplicationSummary } from '@/lib/job-offer-queries';
import { useAiPromptDebug } from '@/components/ai/AiPromptDebugContext';
import { readMatchBatchResult, type MatchBatchScore, type MatchBatchError } from '@/lib/ai-jobs/match-batch-state';

export type CuratedItem = MatchBatchScore;

interface CurateWithAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (summary?: { total: number; kept: number; archived: number }) => void;
  onScoresUpdated?: (results: CuratedItem[]) => void;
  onScoresInvalidated?: (offerIds: string[]) => void;
  offersCount: number;
  offers?: ApplicationSummary[];
  isSimulation?: boolean;
  skipDebugPrompt?: boolean;
}

type SavedRequest = { requestId: string; jobId?: string };
type Phase = 'starting' | 'queued' | 'running' | 'completed' | 'failed' | 'disconnected';

export default function CurateWithAiModal(props: CurateWithAiModalProps) {
  const { isOpen, offers = [], offersCount, isSimulation = false } = props;
  const [phase, setPhase] = useState<Phase>('starting');
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [outdatedScores, setOutdatedScores] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [displayOffers, setDisplayOffers] = useState<ApplicationSummary[]>([]);
  const [reconnect, setReconnect] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestProps = useRef(props);
  latestProps.current = props;
  const { inspectOrExecutePrompt } = useAiPromptDebug();
  const inspectorRef = useRef(inspectOrExecutePrompt);
  inspectorRef.current = inspectOrExecutePrompt;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latestProps.current.onClose();
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus(); };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedOffers = latestProps.current.offers || [];
    const controller = new AbortController();
    let stopped = false;
    let wakeWait: (() => void) | undefined;
    let completed = false;
    const savedScores = new Map<string, number>();
    const invalidatedScores = new Set<string>();
    const storageKey = `matchply:match-batch:${selectedOffers[0]?.userId || 'user'}:${selectedOffers.map(offer => offer.id).sort().join(',')}`;
    let request: SavedRequest;
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
      request = value && typeof value.requestId === 'string'
        ? { requestId: value.requestId, jobId: typeof value.jobId === 'string' ? value.jobId : undefined }
        : { requestId: crypto.randomUUID() };
    } catch { request = { requestId: crypto.randomUUID() }; }
    const remember = () => {
      try { localStorage.setItem(storageKey, JSON.stringify(request)); } catch { /* Private browsing can disable storage. */ }
    };
    const forget = () => {
      try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
    };

    setDisplayOffers(selectedOffers);
    setScores(new Map());
    setErrors(new Map());
    setOutdatedScores(new Set());
    setMessage(null);
    setPhase('starting');

    const ingest = (items: MatchBatchScore[]) => {
      if (stopped) return;
      const changed = items.filter(item => savedScores.get(item.id) !== item.score);
      for (const item of changed) { savedScores.set(item.id, item.score); invalidatedScores.delete(item.id); }
      if (!changed.length) return;
      setScores(new Map(savedScores));
      setOutdatedScores(new Set(invalidatedScores));
      setErrors(previous => {
        const next = new Map(previous);
        for (const item of changed) next.delete(item.id);
        return next;
      });
      latestProps.current.onScoresUpdated?.(changed);
    };
    const ingestErrors = (items: MatchBatchError[]) => {
      if (stopped) return;
      const newlyOutdated: string[] = [];
      for (const error of items) {
        if (error.code === 'outdated' && !invalidatedScores.has(error.id)) {
          savedScores.delete(error.id);
          invalidatedScores.add(error.id);
          newlyOutdated.push(error.id);
        }
      }
      if (newlyOutdated.length) {
        setScores(new Map(savedScores));
        setOutdatedScores(new Set(invalidatedScores));
        latestProps.current.onScoresInvalidated?.(newlyOutdated);
      }
      setErrors(previous => {
        const next = new Map(previous);
        for (const error of items) if (!savedScores.has(error.id)) next.set(error.id, error.message);
        return next;
      });
    };
    const finish = (jobStatus: string, failures = 0) => {
      const status = failures > 0 || invalidatedScores.size > 0 ? 'failed' : jobStatus;
      if (stopped || completed) return;
      completed = true;
      forget();
      setPhase(status === 'completed' ? 'completed' : 'failed');
      if (status === 'completed') {
        const kept = Array.from(savedScores.values()).filter(score => score >= 65).length;
        latestProps.current.onSuccess({ total: savedScores.size, kept, archived: savedScores.size - kept });
      } else {
        setMessage('Algunas ofertas no se han actualizado. Se conservan sus puntuaciones anteriores.');
      }
    };
    const waitForPoll = () => new Promise<void>(resolve => {
      const timer = setTimeout(() => { wakeWait = undefined; resolve(); }, 2_000);
      wakeWait = () => { clearTimeout(timer); wakeWait = undefined; resolve(); };
    });
    const observeJob = async () => {
      while (!stopped && !completed && request.jobId) {
        const response = await fetch(`/api/ai/jobs/${encodeURIComponent(request.jobId)}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) forget();
          throw new Error(response.status === 401 ? 'Inicia sesión para recuperar el cálculo.' : 'No se pudo recuperar el progreso.');
        }
        const job = await response.json();
        if (stopped) return;
        if (job.kind !== 'match_batch') { forget(); throw new Error('El cálculo guardado no está disponible.'); }
        const result = readMatchBatchResult(job.result);
        ingest(result.items);
        ingestErrors(result.errors);
        if (job.status === 'completed' || job.status === 'failed') { finish(job.status, result.errors.length); return; }
        setPhase(job.status === 'running' ? 'running' : 'queued');
        await waitForPoll();
      }
    };
    const handleEvent = (line: string) => {
      if (!line.trim() || stopped) return;
      let event: Record<string, any>;
      try { event = JSON.parse(line); } catch { return; }
      if (!event || typeof event !== 'object') return;
      if (typeof event.id === 'string' && typeof event.score === 'number' && Number.isFinite(event.score)
        && event.score >= 0 && event.score <= 100 && event.type === undefined) {
        ingest([{ id: event.id, score: event.score }]);
      } else if (event.type === 'start' && typeof event.jobId === 'string') {
        request.jobId = event.jobId;
        remember();
        setPhase('queued');
      } else if (event.type === 'offer_error' && typeof event.id === 'string' && typeof event.message === 'string') {
        ingestErrors([{ id: event.id, message: event.message, ...(event.code === 'outdated' ? { code: 'outdated' as const } : {}) }]);
      } else if (event.type === 'progress') {
        setPhase(event.status === 'running' ? 'running' : 'queued');
      } else if (event.type === 'done') {
        finish(event.status, typeof event.failed === 'number' ? event.failed : 0);
      }
      // pending/error control events only end the observer; the durable job is recovered through GET.
    };
    const start = async () => {
      if (latestProps.current.isSimulation) {
        // Demo mode displays its existing fixture data without inventing scores or touching real results.
        const existing = selectedOffers.filter(offer => typeof offer.scoreOverall === 'number');
        setScores(new Map(existing.map(offer => [offer.id, offer.scoreOverall as number])));
        setPhase('completed');
        return;
      }
      if (!selectedOffers.length) { setPhase('completed'); return; }
      if (request.jobId) { await observeJob(); return; }
      if (!latestProps.current.skipDebugPrompt) {
        const proceed = await inspectorRef.current({
          action: 'curate_offers', title: `Calcular match (${selectedOffers.length} ofertas)`,
          data: { targetThreshold: 65, offerIds: selectedOffers.map(offer => offer.id), offers: selectedOffers },
        });
        if (!proceed || stopped) { if (!stopped) latestProps.current.onClose(); return; }
      }
      remember();
      const response = await fetch('/api/ai/curate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ targetThreshold: 65, offerIds: selectedOffers.map(offer => offer.id), requestId: request.requestId }),
      });
      if (!response.ok || !response.body) {
        if ([400, 401, 403, 404].includes(response.status)) forget();
        throw new Error(response.status === 401 ? 'Inicia sesión para calcular el match.'
          : response.status === 429 ? 'Has alcanzado el límite temporal. Recupera el cálculo dentro de unos minutos.'
            : 'No se pudo iniciar el cálculo.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) { buffer += decoder.decode(); break; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) handleEvent(line);
        }
        if (buffer.trim()) handleEvent(buffer);
      } finally { reader.releaseLock(); }
      if (!stopped && !completed) {
        if (!request.jobId) throw new Error('No se recibió el progreso. Puedes recuperar el cálculo.');
        await observeJob();
      }
    };
    void start().catch(error => {
      if (stopped || error?.name === 'AbortError') return;
      setPhase('disconnected');
      setMessage(error instanceof Error ? error.message : 'Se interrumpió la conexión.');
    });
    return () => { stopped = true; wakeWait?.(); controller.abort(); };
  }, [isOpen, reconnect]);

  if (!isOpen) return null;
  const total = displayOffers.length || offers.length || offersCount;
  const progress = total > 0 ? Math.min(100, Math.round(scores.size / total * 100)) : 0;
  const inProgress = phase === 'starting' || phase === 'queued' || phase === 'running';
  const title = isSimulation ? 'Demostración del match' : phase === 'completed' ? 'Match calculado'
    : phase === 'failed' ? 'Cálculo terminado con incidencias' : phase === 'disconnected' ? 'Conexión interrumpida' : 'Calculando match';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="match-batch-title" aria-describedby="match-batch-help"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-control bg-surface shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-subtle px-5 py-4">
          <h2 id="match-batch-title" className="flex items-center gap-2 font-display text-lg font-bold text-text">
            {phase === 'completed' ? <Check aria-hidden="true" className="h-5 w-5 text-success-text" />
              : <Sparkles aria-hidden="true" className="h-5 w-5 text-ai-text" />}
            {title}
          </h2>
          <button ref={closeRef} type="button" aria-label="Cerrar cálculo de match" onClick={() => latestProps.current.onClose()}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p id="match-batch-help" className="text-sm text-text-muted">
            {isSimulation ? 'Se muestran las puntuaciones guardadas del ejemplo.'
              : inProgress ? 'Puedes cerrar esta ventana. El cálculo continúa y los resultados se guardan al completarse.'
                : 'El porcentaje mide la afinidad con tu perfil y tus preferencias.'}
          </p>
          <div className="flex items-center justify-between text-sm text-text-muted" role="status" aria-live="polite">
            <span>{scores.size} de {total} ofertas actualizadas</span>
            {inProgress && <span className="flex items-center gap-1.5"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{phase === 'queued' ? 'En cola' : 'Calculando'}</span>}
          </div>
          <div role="progressbar" aria-label="Ofertas actualizadas" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={scores.size}
            className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-ai-action" style={{ width: `${progress}%` }} />
          </div>
          {message && <p role="alert" className="rounded-lg bg-warning-surface p-3 text-sm text-warning-text">{message}</p>}
        </div>
        <ul className="min-h-0 divide-y divide-subtle overflow-y-auto border-y border-subtle">
          {displayOffers.map(offer => {
            const score = scores.get(offer.id);
            const failure = errors.get(offer.id);
            return (
              <li key={offer.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text" title={offer.title}>{offer.title}</p>
                  <p className="truncate text-xs text-text-muted">{offer.company}</p>
                  {failure && score === undefined && <p className="mt-1 text-xs text-warning-text">{outdatedScores.has(offer.id) ? 'Datos modificados · Pendiente de recalcular' : `Sin actualizar${inProgress ? ' · Se reintentará' : ''}`}</p>}
                </div>
                <span className="shrink-0 font-display text-lg font-bold tabular-nums text-text">
                  {score !== undefined ? `${score}%` : failure && !outdatedScores.has(offer.id) && offer.scoreOverall !== null ? `${offer.scoreOverall}%`
                    : <span className="text-sm font-normal text-text-muted">{failure || !inProgress ? 'Sin resultado' : 'Pendiente'}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2 px-5 py-4">
          {phase === 'disconnected' && <button type="button" onClick={() => setReconnect(value => value + 1)} className="btn-raised btn-raised--ai px-4 py-2 text-sm">Recuperar progreso</button>}
          <button type="button" onClick={() => latestProps.current.onClose()} className="rounded-lg border border-control bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {inProgress ? 'Continuar en segundo plano' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
