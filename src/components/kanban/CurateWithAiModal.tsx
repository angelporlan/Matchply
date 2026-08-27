"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Check, Loader2, Building2, Zap, FastForward } from 'lucide-react';
import { curateOffersWithAiAction } from '@/app/dashboard/kanban/actions';
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

// Carta pendiente (mostrada antes de que la IA responda)
interface PendingCard {
  id: string;
  title: string;
  company: string;
  score: number | null;      // null = aún sin evaluar
  decision: 'keep' | 'archive' | null;
  fitReason: string | null;
  resolved: boolean;
}

export default function CurateWithAiModal({
  isOpen,
  onClose,
  onSuccess,
  onScoresUpdated,
  offersCount,
  offers = [],
  isSimulation = false,
}: CurateWithAiModalProps) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [cards, setCards] = useState<PendingCard[]>([]);
  const [cardState, setCardState] = useState<'entering' | 'revealing' | 'stamping' | 'exiting'>('entering');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);
  const [aiFinished, setAiFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resultsMapRef = useRef<Map<string, CuratedItem>>(new Map());
  const fastModeRef = useRef(false);
  const abortedRef = useRef(false);

  // Cleanup
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrentIndex(-1);
      setCards([]);
      setIsCompleted(false);
      setIsFastMode(false);
      setAiFinished(false);
      setError(null);
      resultsMapRef.current = new Map();
      fastModeRef.current = false;
      abortedRef.current = false;
    }
  }, [isOpen]);

  // Iniciar todo al abrir
  useEffect(() => {
    if (isOpen && offers.length > 0) {
      startDualFlow();
    }
  }, [isOpen]);

  // Flujo dual: animación inmediata + IA en paralelo
  const startDualFlow = () => {
    abortedRef.current = false;

    // 1. Preparar las cartas con datos que ya tenemos (título, empresa)
    const pendingCards: PendingCard[] = offers.map(o => ({
      id: o.id,
      title: o.title,
      company: o.company,
      score: null,
      decision: null,
      fitReason: null,
      resolved: false,
    }));
    setCards(pendingCards);

    // 2. Arrancar la animación de cartas INMEDIATAMENTE
    advanceToCard(pendingCards, 0, false);

    // 3. Lanzar la IA en paralelo (o simulación)
    if (isSimulation) {
      launchSimulation(pendingCards);
    } else {
      launchRealCuration();
    }
  };

  // IA real en background
  const launchRealCuration = async () => {
    try {
      const res = await curateOffersWithAiAction(65);
      if (abortedRef.current) return;

      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.results && res.results.length > 0) {
        // Guardar resultados en el mapa de referencia
        const map = new Map<string, CuratedItem>();
        res.results.forEach(r => map.set(r.id, r));
        resultsMapRef.current = map;
        setAiFinished(true);

        if (onScoresUpdated) {
          onScoresUpdated(res.results);
        }

        // Actualizar todas las cartas con los scores reales
        setCards(prev => prev.map(card => {
          const result = map.get(card.id);
          if (result) {
            return {
              ...card,
              score: result.score,
              decision: result.decision,
              fitReason: result.fitReason,
              resolved: true,
            };
          }
          return card;
        }));
      }
    } catch (err: any) {
      if (!abortedRef.current) {
        setError(err.message || "Error al conectar con la IA.");
      }
    }
  };

  // Simulación con scores falsos inmediatos
  const launchSimulation = (pendingCards: PendingCard[]) => {
    const map = new Map<string, CuratedItem>();

    // Generar scores simulados con delay para simular la IA
    setTimeout(() => {
      if (abortedRef.current) return;

      pendingCards.forEach((card, idx) => {
        const isEnglish = card.title.toLowerCase().includes("engineer") ||
          card.title.toLowerCase().includes("internship") ||
          card.title.toLowerCase().includes("english");
        const isJavaOrIos = card.title.toLowerCase().includes("java") ||
          card.title.toLowerCase().includes("ios") ||
          card.title.toLowerCase().includes(".net");
        const isStackMatch = card.title.toLowerCase().includes("typescript") ||
          card.title.toLowerCase().includes("react") ||
          card.title.toLowerCase().includes("python") ||
          card.title.toLowerCase().includes("ai") ||
          card.title.toLowerCase().includes("ia");

        let score = 70;
        let fitReason = "Afinidad media con tu perfil. Modalidad compatible.";
        let decision: 'keep' | 'archive' = 'keep';

        if (isEnglish && (isJavaOrIos || idx % 2 === 0)) {
          score = Math.floor(Math.random() * 15) + 15;
          decision = 'archive';
          fitReason = "⛔ Penalizada: oferta redactada en inglés según tus reglas.";
        } else if (isJavaOrIos) {
          score = Math.floor(Math.random() * 20) + 20;
          decision = 'archive';
          fitReason = "⛔ Stack alejado: exige Java/iOS nativo, tu perfil es Full Stack JS.";
        } else if (isStackMatch) {
          score = Math.floor(Math.random() * 15) + 85;
          decision = 'keep';
          fitReason = "💡 Gran compatibilidad con TypeScript/React y perfil Full Stack.";
        } else {
          score = Math.floor(Math.random() * 30) + 50;
          decision = score >= 65 ? 'keep' : 'archive';
          fitReason = `Afinidad media (${score}%). Modalidad compatible.`;
        }

        map.set(card.id, {
          id: card.id,
          title: card.title,
          company: card.company,
          score,
          decision,
          fitReason,
          highlightSkills: ["TypeScript", "React", "Node.js"].slice(0, 3),
        });
      });

      resultsMapRef.current = map;
      setAiFinished(true);

      setCards(prev => prev.map(card => {
        const result = map.get(card.id);
        if (result) {
          return { ...card, score: result.score, decision: result.decision, fitReason: result.fitReason, resolved: true };
        }
        return card;
      }));
    }, 2500); // Simular 2.5s de "IA pensando"
  };

  // Motor de animación carta a carta
  const advanceToCard = useCallback((allCards: PendingCard[], index: number, fast: boolean) => {
    if (abortedRef.current) return;
    if (index >= allCards.length) {
      finishSequence();
      return;
    }

    setCurrentIndex(index);
    setCardState('entering');

    const enterDuration = fast ? 40 : 180;
    const revealDuration = fast ? 60 : 500;
    const stampDuration = fast ? 40 : 350;
    const exitDuration = fast ? 30 : 200;

    timerRef.current = setTimeout(() => {
      if (abortedRef.current) return;
      setCardState('revealing');

      timerRef.current = setTimeout(() => {
        if (abortedRef.current) return;
        setCardState('stamping');

        timerRef.current = setTimeout(() => {
          if (abortedRef.current) return;
          setCardState('exiting');

          timerRef.current = setTimeout(() => {
            if (abortedRef.current) return;
            // Leer la referencia más actualizada de fast mode
            advanceToCard(allCards, index + 1, fastModeRef.current);
          }, exitDuration);
        }, stampDuration);
      }, revealDuration);
    }, enterDuration);
  }, []);

  const handleFastForward = () => {
    setIsFastMode(true);
    fastModeRef.current = true;
    // No reiniciar, el siguiente ciclo lo leerá desde la ref
  };

  const handleSkipAll = () => {
    abortedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    finishSequence();
  };

  const finishSequence = () => {
    setIsCompleted(true);
    const map = resultsMapRef.current;
    const keptCount = Array.from(map.values()).filter(i => i.decision === 'keep').length;
    const archivedCount = Array.from(map.values()).filter(i => i.decision === 'archive').length;

    setTimeout(() => {
      onSuccess({
        total: map.size || offers.length,
        kept: keptCount,
        archived: archivedCount,
      });
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  // Card actual con datos reales si ya llegaron de la IA
  const currentCard = cards[currentIndex];
  const resolvedCard = currentCard ? resultsMapRef.current.get(currentCard.id) : null;

  const displayScore = resolvedCard?.score ?? currentCard?.score;
  const displayDecision = resolvedCard?.decision ?? currentCard?.decision;
  const displayReason = resolvedCard?.fitReason ?? currentCard?.fitReason;
  const isResolved = displayScore !== null && displayScore !== undefined;

  const isSuspended = isResolved && displayScore < 50;
  const isPassing = isResolved && displayScore >= 50;
  const isWaitingScore = !isResolved;

  const nextCard1 = cards[currentIndex + 1];
  const nextCard2 = cards[currentIndex + 2];

  const totalCards = cards.length || offersCount;
  const progressPercent = totalCards > 0 ? Math.round(((currentIndex + 1) / totalCards) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-[#0b0f19]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-[#FAFAFA] dark:bg-[#0B0F19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center p-6 relative animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#1e1b4b]/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${
              aiFinished ? 'bg-[#2ECC71]' : 'bg-[#8b5cf6] animate-pulse'
            }`} />
            <span className="text-xs font-bold text-[#1e1b4b] dark:text-white font-display">
              {isSimulation ? 'Simulación (0 Tokens)' : aiFinished ? 'IA completada · Mostrando resultados' : 'Evaluando con IA en directo...'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => { abortedRef.current = true; onClose(); }}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        {/* Barra de Progreso */}
        <div className="w-full my-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#1e1b4b]/70 dark:text-slate-400">
            <span>{currentIndex + 1} de {totalCards}</span>
            <span className="text-[#8b5cf6] font-display">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#111827] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#2ECC71] transition-all duration-150 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ARENA DE CARTAS */}
        <div className="relative w-full h-[300px] flex items-center justify-center my-2 select-none">
          {error ? (
            <div className="flex flex-col items-center justify-center space-y-3 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <X className="w-6 h-6 stroke-[2.5]" />
              </div>
              <p className="text-xs font-bold text-rose-500">{error}</p>
            </div>
          ) : isCompleted ? (
            <div className="flex flex-col items-center justify-center space-y-3 animate-in zoom-in-90 fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h4 className="text-base font-extrabold text-[#1e1b4b] dark:text-white font-display">
                ¡Candidaturas puntuadas!
              </h4>
              <p className="text-xs text-slate-400 font-sans">Actualizando tu tablero...</p>
            </div>
          ) : currentCard ? (
            <>
              {/* Carta fondo 2 */}
              {nextCard2 && (
                <div className="absolute w-[88%] h-[250px] bg-slate-100 dark:bg-[#161f30] border border-[#1e1b4b]/5 dark:border-white/5 rounded-2xl shadow-sm transform translate-y-5 scale-[0.88] opacity-30 pointer-events-none z-10" />
              )}
              {/* Carta fondo 1 */}
              {nextCard1 && (
                <div className="absolute w-[94%] h-[250px] bg-slate-50 dark:bg-[#1a2333] border border-[#1e1b4b]/8 dark:border-white/8 rounded-2xl shadow-md transform translate-y-2.5 scale-[0.94] opacity-60 pointer-events-none z-20" />
              )}

              {/* CARTA PRINCIPAL */}
              <div
                className={`absolute w-full h-[260px] bg-white dark:bg-[#111827] border rounded-2xl p-5 shadow-2xl flex flex-col justify-between z-30 overflow-hidden
                  ${cardState === 'entering' ? 'animate-in fade-in zoom-in-95 duration-150' : ''}
                  ${cardState === 'exiting' && isPassing ? 'transition-all duration-200 translate-x-[130%] rotate-12 opacity-0' : ''}
                  ${cardState === 'exiting' && isSuspended ? 'transition-all duration-200 -translate-x-[130%] -rotate-12 opacity-0' : ''}
                  ${cardState === 'exiting' && isWaitingScore ? 'transition-all duration-200 translate-y-[100%] opacity-0' : ''}
                  ${isSuspended ? 'border-rose-500/30 shadow-rose-500/5' : isPassing ? 'border-emerald-500/30 shadow-emerald-500/5' : 'border-[#8b5cf6]/20 shadow-[#8b5cf6]/5'}
                `}
              >
                {/* Empresa + Score */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0">
                        {currentCard.company?.charAt(0) || <Building2 className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 truncate">
                        {currentCard.company}
                      </span>
                    </div>

                    {/* Score Badge */}
                    {isResolved ? (
                      <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg font-display border shadow-xs animate-in zoom-in-110 duration-150 ${
                        isPassing
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      }`}>
                        {displayScore}%
                      </span>
                    ) : (
                      <span className="text-sm font-black px-2.5 py-1 rounded-lg font-display border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 text-[#8b5cf6] animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-[#1e1b4b] dark:text-white mt-2 font-display line-clamp-2 leading-snug">
                    {currentCard.title}
                  </h3>
                </div>

                {/* SELLO CENTRAL */}
                <div className="relative py-2 flex items-center justify-center">
                  {cardState === 'stamping' || cardState === 'exiting' ? (
                    isWaitingScore ? (
                      <div className="inline-flex items-center gap-2 text-[#8b5cf6] font-bold text-xs px-3 py-1 rounded-xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 font-display animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        IA procesando...
                      </div>
                    ) : isSuspended ? (
                      <div className="inline-block border-[3px] border-rose-500 text-rose-500 font-black text-xl px-4 py-1 rounded-xl uppercase tracking-widest transform -rotate-12 animate-in zoom-in-125 duration-150 shadow-lg shadow-rose-500/20 font-display bg-rose-500/5">
                        SUSPENSO
                      </div>
                    ) : (
                      <div className="inline-block border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm px-3.5 py-1 rounded-xl uppercase tracking-wider transform rotate-3 animate-in zoom-in-110 duration-150 shadow-md shadow-emerald-500/15 font-display bg-emerald-500/5">
                        ✓ APTO · MATCH
                      </div>
                    )
                  ) : (
                    <div className="h-8" /> 
                  )}
                </div>

                {/* Pie: Motivo */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                  {displayReason ? (
                    <p className="text-[11.5px] text-[#1e1b4b]/75 dark:text-slate-300 font-sans leading-relaxed line-clamp-2">
                      {displayReason}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-[11.5px] text-[#8b5cf6]/60 font-sans">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span>La IA está evaluando esta candidatura...</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Controles */}
        {!isCompleted && !error && currentCard && (
          <div className="w-full flex items-center justify-between gap-2 pt-3 border-t border-[#1e1b4b]/5 dark:border-white/5">
            <button
              type="button"
              onClick={handleFastForward}
              disabled={isFastMode}
              className="text-[11px] font-bold text-slate-500 hover:text-[#8b5cf6] transition-colors flex items-center gap-1 disabled:opacity-30"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{isFastMode ? 'Modo rápido activo' : 'Acelerar'}</span>
            </button>

            <button
              type="button"
              onClick={handleSkipAll}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-[#1e1b4b] dark:text-white transition-all font-display"
            >
              Ver resultado final ➔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
