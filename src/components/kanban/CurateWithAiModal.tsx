"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Check, Loader2, Building2 } from 'lucide-react';
import { JobOffer } from '@/db/schema';

export interface CuratedItem {
  id: string;
  title: string;
  company: string;
  score: number;
  decision: 'keep' | 'archive';
  fitReason: string;
  highlightSkills?: string[];
}

interface CurateWithAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (summary?: { total: number; kept: number; archived: number }) => void;
  onScoresUpdated?: (results: CuratedItem[]) => void;
  offersCount: number;
  offers?: JobOffer[];
  isSimulation?: boolean;
}

interface PendingCard {
  id: string;
  title: string;
  company: string;
  score: number | null;
  decision: 'keep' | 'archive' | null;
  fitReason: string | null;
  resolved: boolean;
}

type Phase = 'revealing' | 'done';
type CardState = 'entering' | 'revealing' | 'waiting' | 'stamping' | 'exiting';

export default function CurateWithAiModal({
  isOpen,
  onClose,
  onSuccess,
  onScoresUpdated,
  offersCount,
  offers = [],
  isSimulation = false,
}: CurateWithAiModalProps) {
  const [phase, setPhase] = useState<Phase>('revealing');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [cards, setCards] = useState<PendingCard[]>([]);
  const [cardState, setCardState] = useState<CardState>('waiting');
  const [aiFinished, setAiFinished] = useState(false);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [shownCount, setShownCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepResolveRef = useRef<(() => void) | null>(null);
  const resultsMapRef = useRef<Map<string, CuratedItem>>(new Map());
  const waitResolversRef = useRef<Map<string, () => void>>(new Map());
  const abortedRef = useRef(false);
  const cardsRef = useRef<PendingCard[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const aiFinishedRef = useRef(false);
  const currentIndexRef = useRef(-1);
  const finishingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const wakeSleep = () => {
    clearTimer();
    const resolve = sleepResolveRef.current;
    sleepResolveRef.current = null;
    resolve?.();
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      sleepResolveRef.current = resolve;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        sleepResolveRef.current = null;
        resolve();
      }, ms);
    });

  const waitForScore = (offerId: string) => {
    if (resultsMapRef.current.has(offerId)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      waitResolversRef.current.set(offerId, resolve);
    });
  };

  const ingestResults = useCallback((items: CuratedItem[]) => {
    if (!items.length) return;

    const map = resultsMapRef.current;
    for (const item of items) {
      map.set(item.id, item);
      const resolver = waitResolversRef.current.get(item.id);
      if (resolver) {
        waitResolversRef.current.delete(item.id);
        resolver();
      }
    }

    setResolvedCount(map.size);
    setCards((prev) => {
      const next = prev.map((card) => {
        const result = map.get(card.id);
        if (!result) return card;
        return {
          ...card,
          score: result.score,
          decision: result.decision,
          fitReason: result.fitReason,
          resolved: true,
        };
      });
      cardsRef.current = next;
      return next;
    });

    if (onScoresUpdated) onScoresUpdated(items);
  }, [onScoresUpdated]);

  const finishSequence = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    abortedRef.current = true;
    wakeSleep();
    Array.from(waitResolversRef.current.values()).forEach((resolver) => resolver());
    waitResolversRef.current.clear();

    setPhase('done');
    const map = resultsMapRef.current;
    const keptCount = Array.from(map.values()).filter((i) => i.decision === 'keep').length;
    const archivedCount = Array.from(map.values()).filter((i) => i.decision === 'archive').length;

    setTimeout(() => {
      onSuccess({
        total: map.size || offers.length,
        kept: keptCount,
        archived: archivedCount,
      });
      onClose();
    }, 1000);
  }, [offers.length, onClose, onSuccess]);

  const markAiFinishedAndMaybeSummarize = useCallback((forceSummaryIfBehind: boolean) => {
    aiFinishedRef.current = true;
    setAiFinished(true);

    if (!forceSummaryIfBehind || finishingRef.current || abortedRef.current) return;

    const total = cardsRef.current.length;
    const shown = currentIndexRef.current + 1;
    // Si la IA terminó y aún quedan cartas por enseñar → resumen directo
    if (total > 0 && shown < total) {
      finishSequence();
    }
  }, [finishSequence]);

  useEffect(() => {
    if (!isOpen) {
      clearTimer();
      sleepResolveRef.current = null;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setPhase('revealing');
      setCurrentIndex(-1);
      currentIndexRef.current = -1;
      setCards([]);
      cardsRef.current = [];
      setAiFinished(false);
      setResolvedCount(0);
      setShownCount(0);
      setError(null);
      setCardState('waiting');
      resultsMapRef.current = new Map();
      waitResolversRef.current = new Map();
      abortedRef.current = false;
      aiFinishedRef.current = false;
      finishingRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && offers.length > 0) {
      startFlow();
    }
    return () => {
      clearTimer();
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const advanceToCard = useCallback(async (allCards: PendingCard[], index: number) => {
    if (abortedRef.current || finishingRef.current) return;

    // IA ya terminó y esta carta aún no se había mostrado → resumen
    if (aiFinishedRef.current && index > 0 && index < allCards.length) {
      // Si llegamos aquí tras completar una carta y ya había terminado la IA, cerrar
      finishSequence();
      return;
    }

    if (index >= allCards.length) {
      finishSequence();
      return;
    }

    const card = allCards[index];
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setShownCount(index + 1);
    setCardState('entering');

    await sleep(180);
    if (abortedRef.current || finishingRef.current) return;

    setCardState('revealing');
    await sleep(220);
    if (abortedRef.current || finishingRef.current) return;

    if (!resultsMapRef.current.has(card.id)) {
      setCardState('waiting');
      await waitForScore(card.id);
      if (abortedRef.current || finishingRef.current) return;

      // Si mientras esperábamos terminó la IA y hay más cartas, sellamos esta y saltamos al resumen
      if (aiFinishedRef.current && index + 1 < allCards.length) {
        setCardState('stamping');
        await sleep(280);
        if (abortedRef.current || finishingRef.current) return;
        finishSequence();
        return;
      }
    }

    if (aiFinishedRef.current && index + 1 < allCards.length && resultsMapRef.current.has(card.id)) {
      // Score ya estaba (lote completo llegó de golpe): sella la actual y va a resumen
      setCardState('stamping');
      await sleep(280);
      if (abortedRef.current || finishingRef.current) return;
      finishSequence();
      return;
    }

    setCardState('stamping');
    await sleep(340);
    if (abortedRef.current || finishingRef.current) return;

    setCardState('exiting');
    await sleep(200);
    if (abortedRef.current || finishingRef.current) return;

    if (aiFinishedRef.current && index + 1 < allCards.length) {
      finishSequence();
      return;
    }

    return advanceToCard(cardsRef.current.length ? cardsRef.current : allCards, index + 1);
  }, [finishSequence]);

  const fillMissingResults = () => {
    const missing: CuratedItem[] = [];
    for (const card of cardsRef.current) {
      if (resultsMapRef.current.has(card.id)) continue;
      missing.push({
        id: card.id,
        title: card.title,
        company: card.company,
        score: 50,
        decision: 'archive',
        fitReason: 'Sin evaluación completa de la IA.',
        highlightSkills: [],
      });
    }
    if (missing.length) ingestResults(missing);
  };

  const launchRealCurationStream = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/ai/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetThreshold: 65 }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(res.status === 401 ? 'No autorizado' : 'No se pudo iniciar la curación');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (abortedRef.current) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let event: any;
          try {
            event = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (event.type === 'item' && event.item) {
            ingestResults([event.item as CuratedItem]);
          } else if (event.type === 'done') {
            if (Array.isArray(event.results) && event.results.length) {
              ingestResults(event.results as CuratedItem[]);
            }
            fillMissingResults();
            markAiFinishedAndMaybeSummarize(true);
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Error en la curación');
          }
        }
      }

      if (!aiFinishedRef.current) {
        fillMissingResults();
        markAiFinishedAndMaybeSummarize(true);
      }
    } catch (err: any) {
      if (abortedRef.current || err?.name === 'AbortError') return;
      setError(err.message || 'Error al conectar con la IA.');
      fillMissingResults();
      Array.from(waitResolversRef.current.values()).forEach((resolver) => resolver());
      waitResolversRef.current.clear();
    }
  };

  const launchSimulation = async (pendingCards: PendingCard[]) => {
    for (let idx = 0; idx < pendingCards.length; idx++) {
      if (abortedRef.current || finishingRef.current) return;
      await sleep(520 + (idx % 3) * 100);
      if (abortedRef.current || finishingRef.current) return;

      const card = pendingCards[idx];
      const isEnglish =
        card.title.toLowerCase().includes('engineer') ||
        card.title.toLowerCase().includes('internship') ||
        card.title.toLowerCase().includes('english');
      const isJavaOrIos =
        card.title.toLowerCase().includes('java') ||
        card.title.toLowerCase().includes('ios') ||
        card.title.toLowerCase().includes('.net');
      const isStackMatch =
        card.title.toLowerCase().includes('typescript') ||
        card.title.toLowerCase().includes('react') ||
        card.title.toLowerCase().includes('python') ||
        card.title.toLowerCase().includes('ai') ||
        card.title.toLowerCase().includes('ia');

      let score = 70;
      let fitReason = 'Afinidad media con tu perfil. Modalidad compatible.';
      let decision: 'keep' | 'archive' = 'keep';

      if (isEnglish && (isJavaOrIos || idx % 2 === 0)) {
        score = Math.floor(Math.random() * 15) + 15;
        decision = 'archive';
        fitReason = '⛔ Penalizada: oferta redactada en inglés según tus reglas.';
      } else if (isJavaOrIos) {
        score = Math.floor(Math.random() * 20) + 20;
        decision = 'archive';
        fitReason = '⛔ Stack alejado: exige Java/iOS nativo, tu perfil es Full Stack JS.';
      } else if (isStackMatch) {
        score = Math.floor(Math.random() * 15) + 85;
        decision = 'keep';
        fitReason = '💡 Gran compatibilidad con TypeScript/React y perfil Full Stack.';
      } else {
        score = Math.floor(Math.random() * 30) + 50;
        decision = score >= 65 ? 'keep' : 'archive';
        fitReason = `Afinidad media (${score}%). Modalidad compatible.`;
      }

      ingestResults([{
        id: card.id,
        title: card.title,
        company: card.company,
        score,
        decision,
        fitReason,
        highlightSkills: ['TypeScript', 'React', 'Node.js'].slice(0, 3),
      }]);
    }

    markAiFinishedAndMaybeSummarize(true);
  };

  const startFlow = () => {
    abortedRef.current = false;
    aiFinishedRef.current = false;
    finishingRef.current = false;
    currentIndexRef.current = -1;
    setPhase('revealing');
    setAiFinished(false);
    setError(null);
    setResolvedCount(0);
    setShownCount(0);
    resultsMapRef.current = new Map();
    waitResolversRef.current = new Map();

    const pendingCards: PendingCard[] = offers.map((o) => ({
      id: o.id,
      title: o.title,
      company: o.company,
      score: null,
      decision: null,
      fitReason: null,
      resolved: false,
    }));
    setCards(pendingCards);
    cardsRef.current = pendingCards;

    void advanceToCard(pendingCards, 0);

    if (isSimulation) {
      void launchSimulation(pendingCards);
    } else {
      void launchRealCurationStream();
    }
  };

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const resolvedCard = currentCard ? resultsMapRef.current.get(currentCard.id) : null;
  const displayScore = resolvedCard?.score ?? currentCard?.score;
  const displayReason = resolvedCard?.fitReason ?? currentCard?.fitReason;
  const isResolved = displayScore !== null && displayScore !== undefined;
  const isSuspended = isResolved && displayScore < 50;
  const isPassing = isResolved && displayScore >= 50;
  const isWaitingScore = !isResolved || cardState === 'waiting';

  const nextCard1 = cards[currentIndex + 1];
  const nextCard2 = cards[currentIndex + 2];
  const totalCards = cards.length || offersCount;
  const progressPercent = totalCards > 0
    ? Math.round((Math.max(resolvedCount, shownCount) / totalCards) * 100)
    : 0;

  const map = resultsMapRef.current;
  const keptPreview = Array.from(map.values()).filter((i) => i.decision === 'keep').length;
  const archivedPreview = Array.from(map.values()).filter((i) => i.decision === 'archive').length;

  return (
    <div className="fixed inset-0 bg-[#0b0f19]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-[#FAFAFA] dark:bg-[#0B0F19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center p-6 relative animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#1e1b4b]/5 dark:border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${
                phase === 'done' || aiFinished
                  ? 'bg-[#2ECC71]'
                  : 'bg-[#8b5cf6] animate-pulse shadow-[0_0_10px_rgba(139,92,246,0.55)]'
              }`}
            />
            <span className="text-xs font-bold text-[#1e1b4b] dark:text-white font-display truncate">
              {error
                ? 'Error en la curación'
                : isSimulation
                  ? 'Simulación (0 Tokens)'
                  : phase === 'done'
                    ? 'Curación lista'
                    : aiFinished
                      ? 'IA completada'
                      : 'Evaluando con IA en directo...'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              abortedRef.current = true;
              wakeSleep();
              abortControllerRef.current?.abort();
              onClose();
            }}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        <div className="w-full my-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#1e1b4b]/70 dark:text-slate-400">
            <span>
              {phase === 'done'
                ? `${totalCards} evaluadas`
                : `${Math.max(shownCount, 0)} de ${totalCards}`}
            </span>
            <span className="text-[#8b5cf6] font-display tabular-nums">
              {Math.min(100, progressPercent)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#111827] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8b5cf6] via-[#a78bfa] to-[#2ECC71] transition-[width] duration-300 ease-out rounded-full"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>

        <div className="relative w-full h-[300px] flex items-center justify-center my-2 select-none">
          {error ? (
            <div className="flex flex-col items-center justify-center space-y-3 text-center px-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <X className="w-6 h-6 stroke-[1.75]" />
              </div>
              <p className="text-xs font-bold text-rose-500">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-[#1e1b4b] dark:text-white"
              >
                Cerrar
              </button>
            </div>
          ) : phase === 'done' ? (
            <div className="flex flex-col items-center justify-center space-y-3 animate-in zoom-in-90 fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                <Check className="w-7 h-7 stroke-[2.5]" />
              </div>
              <h4 className="text-base font-extrabold text-[#1e1b4b] dark:text-white font-display">
                ¡Candidaturas puntuadas!
              </h4>
              <p className="text-xs text-slate-400 font-sans">
                {keptPreview} aptas · {archivedPreview} descartadas
              </p>
            </div>
          ) : currentCard ? (
            <>
              {nextCard2 && !aiFinished && (
                <div className="absolute w-[88%] h-[250px] bg-slate-100 dark:bg-[#161f30] border border-[#1e1b4b]/5 dark:border-white/5 rounded-2xl shadow-sm transform translate-y-5 scale-[0.88] opacity-30 pointer-events-none z-10" />
              )}
              {nextCard1 && !aiFinished && (
                <div className="absolute w-[94%] h-[250px] bg-slate-50 dark:bg-[#1a2333] border border-[#1e1b4b]/8 dark:border-white/8 rounded-2xl shadow-md transform translate-y-2.5 scale-[0.94] opacity-60 pointer-events-none z-20" />
              )}

              <div
                className={`absolute w-full h-[260px] bg-white dark:bg-[#111827] border rounded-2xl p-5 shadow-2xl flex flex-col justify-between z-30 overflow-hidden
                  ${cardState === 'entering' ? 'animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150' : ''}
                  ${cardState === 'exiting' && isPassing ? 'transition-all duration-200 translate-x-[130%] rotate-12 opacity-0' : ''}
                  ${cardState === 'exiting' && isSuspended ? 'transition-all duration-200 -translate-x-[130%] -rotate-12 opacity-0' : ''}
                  ${cardState === 'exiting' && isWaitingScore ? 'transition-all duration-200 translate-y-[100%] opacity-0' : ''}
                  ${isWaitingScore
                    ? 'border-[#8b5cf6]/25 shadow-[#8b5cf6]/10'
                    : isSuspended
                      ? 'border-rose-500/30 shadow-rose-500/10'
                      : 'border-emerald-500/30 shadow-emerald-500/10'}
                `}
              >
                {isWaitingScore && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[#8b5cf6]/12 to-transparent curate-scan-shimmer" />
                  </div>
                )}

                <div className="relative">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0">
                        {currentCard.company?.charAt(0) || <Building2 className="w-3.5 h-3.5 stroke-[1.75]" />}
                      </div>
                      <span className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 truncate">
                        {currentCard.company}
                      </span>
                    </div>

                    {isResolved ? (
                      <span
                        className={`text-sm font-black px-2.5 py-0.5 rounded-lg font-display border shadow-xs animate-in zoom-in-110 duration-150 ${
                          isPassing
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {displayScore}%
                      </span>
                    ) : (
                      <span className="text-sm font-black px-2.5 py-1 rounded-lg font-display border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 text-[#8b5cf6]">
                        <Loader2 className="w-4 h-4 animate-spin inline stroke-[1.75]" />
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-[#1e1b4b] dark:text-white mt-2 font-display line-clamp-2 leading-snug">
                    {currentCard.title}
                  </h3>
                </div>

                <div className="relative py-2 flex items-center justify-center min-h-[44px]">
                  {isWaitingScore ? (
                    <div className="inline-flex items-center gap-2 text-[#8b5cf6] font-bold text-xs px-3 py-1 rounded-xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 font-display">
                      <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[1.75]" />
                      Esperando veredicto…
                    </div>
                  ) : cardState === 'stamping' || cardState === 'exiting' ? (
                    isSuspended ? (
                      <div className="inline-block border-[3px] border-rose-500 text-rose-500 font-black text-xl px-4 py-1 rounded-xl uppercase tracking-widest transform -rotate-12 animate-in zoom-in-125 duration-150 shadow-lg shadow-rose-500/20 font-display bg-rose-500/5">
                        SUSPENSO
                      </div>
                    ) : (
                      <div className="inline-block border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm px-3.5 py-1 rounded-xl uppercase tracking-wider transform rotate-3 animate-in zoom-in-110 duration-150 shadow-md shadow-emerald-500/15 font-display bg-emerald-500/5">
                        ✓ APTO · MATCH
                      </div>
                    )
                  ) : (
                    <div className="inline-flex items-center gap-2 text-[#8b5cf6] font-bold text-xs px-3 py-1 rounded-xl border border-[#8b5cf6]/15 bg-[#8b5cf6]/5 font-display">
                      <Sparkles className="w-3.5 h-3.5 stroke-[1.75] animate-pulse" />
                      Analizando veredicto…
                    </div>
                  )}
                </div>

                <div className="relative pt-2 border-t border-slate-100 dark:border-white/5">
                  {displayReason ? (
                    <p className="text-[11.5px] text-[#1e1b4b]/75 dark:text-slate-300 font-sans leading-relaxed line-clamp-2">
                      {displayReason}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-[11.5px] text-[#8b5cf6]/70 font-sans">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse stroke-[1.75]" />
                      <span>La IA está evaluando esta candidatura...</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-[#8b5cf6]">
              <Loader2 className="w-6 h-6 animate-spin stroke-[1.75]" />
              <p className="text-xs font-bold font-display">Preparando curación…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
