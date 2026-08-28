"use client";

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  HelpCircle,
  ArrowRight,
  MessageSquare,
  Bot,
  Plus,
  RefreshCw,
  Send,
  Zap,
} from 'lucide-react';
import DictationTextarea from './DictationTextarea';

interface QuestionItem {
  id: string;
  category: string;
  question: string;
  hint: string;
  suggestedAnswers: string[];
}

interface AiProfileInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: any;
  onApplyProfile: (newProfile: any) => void;
}

export default function AiProfileInterviewModal({
  isOpen,
  onClose,
  currentProfile,
  onApplyProfile,
}: AiProfileInterviewModalProps) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load questions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
    }
  }, [isOpen]);

  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/profile/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_questions',
          currentProfile,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        throw new Error(data.error || 'Error al generar preguntas de entrevista.');
      }
    } catch (err: any) {
      console.error('Error fetching questions:', err);
      // Fallback default questions
      setQuestions([
        {
          id: 'q1',
          category: 'ai_ml',
          question: '¿Qué experiencia tienes integrando modelos de IA (Gemini, OpenRouter, OpenAI), arquitecturas RAG o bases de datos vectoriales?',
          hint: 'Permite a la IA posicionarte con autoridad técnica en roles de AI Engineer o Full Stack IA.',
          suggestedAnswers: [
            'Integración de Gemini y OpenAI vía OpenRouter con streaming y function calling',
            'Experiencia con RAG, embeddings y vector DBs (Pinecone, Qdrant o pgvector)',
            'Automatización de pipelines y orquestación de LLMs en SaaS en producción'
          ]
        },
        {
          id: 'q2',
          category: 'projects',
          question: '¿Cuáles han sido los proyectos o hitos más destacados de tu carrera y qué métricas o resultados obtuviste?',
          hint: 'Las cifras cuantificables y retos de arquitectura multiplican la efectividad del matching y CV.',
          suggestedAnswers: [
            'Lanzamiento de SaaS de punta a punta con usuarios activos y Stripe',
            'Desarrollo de integraciones complejas en TypeScript, Next.js y PostgreSQL',
            'Optimización de tiempos de carga y flujos automatizados reduciendo fricción un 70%'
          ]
        },
        {
          id: 'q3',
          category: 'target',
          question: '¿Hacia qué rol objetivo te enfocas (ej. AI Engineer, Lead) y qué industrias o ubicaciones prefieres?',
          hint: 'La IA usará esto para puntuar las ofertas de LinkedIn y filtrar deal-breakers.',
          suggestedAnswers: [
            'AI Engineer o Full Stack en startups de producto / SaaS tecnológico',
            'Equipos Fintech internacionales en Londres o Remoto internacional',
            'Scale-ups en crecimiento evitando consultoras masivas y proyectos legacy'
          ]
        }
      ]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleApplySuggestion = (questionId: string, suggestion: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] || '';
      if (!current.trim()) return { ...prev, [questionId]: suggestion };
      if (current.includes(suggestion)) return prev;
      return { ...prev, [questionId]: `${current}. ${suggestion}` };
    });
  };

  const handleSynthesize = async () => {
    setSynthesizing(true);
    setError(null);
    try {
      const qaList = questions.map((q) => ({
        question: q.question,
        answer: (answers[q.id] || '').trim(),
      })).filter((qa) => qa.answer.length > 0);

      if (qaList.length === 0) {
        throw new Error('Por favor responde al menos a una pregunta o haz clic en las sugerencias para continuar.');
      }

      const res = await fetch('/api/ai/profile/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'synthesize_profile',
          currentProfile,
          qaList,
        }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        onApplyProfile(data.profile);
        onClose();
      } else {
        throw new Error(data.error || 'Error al sintetizar el perfil.');
      }
    } catch (err: any) {
      console.error('Error synthesizing profile:', err);
      setError(err.message || 'Error al procesar la información.');
    } finally {
      setSynthesizing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f19]/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#111827] border border-[#8B5CF6]/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-[#8B5CF6]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#7c3aed] text-white flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#1e1b4b] dark:text-white font-display">
                  Copiloto de Entrevista IA
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
                  Modo Precisión
                </span>
              </div>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                Responde o haz clic en las sugerencias. La IA estructurará tu Perfil Maestro al instante.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loadingQuestions ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin stroke-[1.75]" />
              <p className="text-xs font-bold text-[#1e1b4b] dark:text-white font-display">
                Analizando tu contexto y formulando preguntas clave…
              </p>
              <p className="text-[11px] text-[#1e1b4b]/50 dark:text-slate-400 font-sans">
                Buscando puntos ciegos técnicos para maximizar tu score de matching.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="bg-slate-50 dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-xl p-4.5 space-y-3 transition-all hover:border-[#8B5CF6]/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8B5CF6]">
                        Pregunta {index + 1}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1e1b4b] dark:text-white font-display leading-snug">
                        {q.question}
                      </h4>
                      {q.hint && (
                        <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                          💡 {q.hint}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Suggestion Pills */}
                  {q.suggestedAnswers?.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Sugerencias rápidas (haz clic para añadir):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {q.suggestedAnswers.map((suggestion, sIdx) => {
                          const isSelected = (answers[q.id] || '').includes(suggestion);
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleApplySuggestion(q.id, suggestion)}
                              className={`text-[11px] text-left px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/40 font-bold'
                                  : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8B5CF6]/30'
                              }`}
                            >
                              <Plus className="w-3 h-3 inline mr-1 stroke-[1.75]" />
                              {suggestion}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dictation / Custom Answer */}
                  <div className="pt-2">
                    <DictationTextarea
                      id={`answer-${q.id}`}
                      label="Tu respuesta (o dicta con el micrófono):"
                      value={answers[q.id] || ''}
                      onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                      rows={3}
                      placeholder="Escribe o amplía con tus detalles técnicos reales..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#0e1422]">
          <button
            type="button"
            onClick={fetchQuestions}
            disabled={loadingQuestions || synthesizing}
            className="text-xs font-bold text-slate-500 hover:text-[#8B5CF6] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Generar otras preguntas</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={synthesizing || loadingQuestions}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6D28D9] text-white text-xs font-bold shadow-md shadow-[#8B5CF6]/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {synthesizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sintetizando Perfil Maestro…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span>Sintetizar y Aplicar al Perfil</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
