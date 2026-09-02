"use client";

import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  HelpCircle,
  Bot,
  RefreshCw,
} from 'lucide-react';
import DictationTextarea from './DictationTextarea';
import type { InterviewQuestion, ProfileClassification } from '@/lib/profile-classification';

interface AiProfileInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dumpText: string;
  optionalTarget?: string;
  currentProfile: any;
  onApplyProfile: (newProfile: any) => void;
}

export default function AiProfileInterviewModal({
  isOpen,
  onClose,
  dumpText,
  optionalTarget,
  currentProfile,
  onApplyProfile,
}: AiProfileInterviewModalProps) {
  const [step, setStep] = useState<'questions' | 'review'>('questions');
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [classification, setClassification] = useState<ProfileClassification | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterDraft, setMasterDraft] = useState('');
  const [pendingProfile, setPendingProfile] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('questions');
    setAnswers({});
    setError(null);
    setMasterDraft('');
    setPendingProfile(null);
    fetchInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchInterview = async () => {
    setLoadingQuestions(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/profile/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_interview',
          dumpText,
          optionalTarget,
          currentProfile,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        setQuestions(data.questions);
        if (data.classification) setClassification(data.classification);
      } else {
        throw new Error(data.error || 'Error al generar preguntas.');
      }
    } catch (err: any) {
      console.error('Error fetching questions:', err);
      setError(err.message || 'No se pudieron generar las preguntas. Prueba de nuevo.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSynthesize = async () => {
    setSynthesizing(true);
    setError(null);
    try {
      const qaList = questions
        .map((q) => ({
          question: q.question,
          answer: (answers[q.id] || '').trim(),
        }))
        .filter((qa) => qa.answer.length > 0);

      const res = await fetch('/api/ai/profile/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'synthesize_profile',
          currentProfile,
          qaList,
          dumpText,
          optionalTarget,
          classification,
        }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        setPendingProfile({ ...data.profile, classification });
        setMasterDraft(data.profile.masterDocument || data.profile.bio || '');
        setStep('review');
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

  const handleConfirm = () => {
    if (!pendingProfile) return;
    onApplyProfile({
      ...pendingProfile,
      masterDocument: masterDraft.trim(),
      classification,
    });
    onClose();
  };

  if (!isOpen) return null;

  const answeredCount = questions.filter((q) => (answers[q.id] || '').trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f19]/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#111827] border border-[#8B5CF6]/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-[#8B5CF6]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#7c3aed] text-white flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#1e1b4b] dark:text-white font-display">
                {step === 'review' ? 'Revisa tu documento maestro' : 'Copiloto de perfil'}
              </h2>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                {step === 'review'
                  ? 'Edita el texto si hace falta. Esto es lo que usará la IA para puntuar ofertas y adaptar CVs.'
                  : 'Responde solo lo que sepas. El objetivo profesional es opcional.'}
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

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
              <span>{error}</span>
            </div>
          )}

          {classification && (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-2.5 py-1 text-[11px] font-bold text-[#6D28D9] dark:text-[#C4B5FD]">
                {classification.summary}
              </span>
              {classification.stackHints.slice(0, 5).map((hint) => (
                <span
                  key={hint}
                  className="inline-flex items-center rounded-lg border border-[#1e1b4b]/10 dark:border-white/10 px-2.5 py-1 text-[11px] font-bold text-[#1e1b4b] dark:text-slate-300"
                >
                  {hint}
                </span>
              ))}
            </div>
          )}

          {step === 'questions' && loadingQuestions && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin stroke-[1.75]" />
              <p className="text-xs font-bold text-[#1e1b4b] dark:text-white font-display">
                Leyendo tu experiencia y preparando preguntas…
              </p>
              <p className="text-[11px] text-[#1e1b4b]/50 dark:text-slate-400 font-sans">
                Solo preguntaremos lo que no está claro en lo que has pegado.
              </p>
            </div>
          )}

          {step === 'questions' && !loadingQuestions && (
            <div className="space-y-5">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="bg-slate-50 dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-xl p-4 space-y-3"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8B5CF6]">
                      Pregunta {index + 1}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-[#1e1b4b] dark:text-white font-display leading-snug">
                      {q.question}
                    </h4>
                    {q.hint && (
                      <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                        {q.hint}
                      </p>
                    )}
                  </div>
                  <DictationTextarea
                    id={`answer-${q.id}`}
                    label="Tu respuesta"
                    value={answers[q.id] || ''}
                    onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                    rows={3}
                    placeholder="Escribe o dicta. Si no aplica, déjalo vacío."
                  />
                </div>
              ))}
            </div>
          )}

          {step === 'review' && (
            <DictationTextarea
              id="master-review"
              label="Documento maestro"
              value={masterDraft}
              onChange={setMasterDraft}
              rows={12}
              placeholder="Resumen de quién eres, qué has hecho y con qué tecnologías."
            />
          )}
        </div>

        <div className="p-4 border-t border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#0e1422]">
          {step === 'questions' ? (
            <button
              type="button"
              onClick={fetchInterview}
              disabled={loadingQuestions || synthesizing}
              className="text-xs font-bold text-slate-500 hover:text-[#8B5CF6] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Otras preguntas</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep('questions')}
              className="text-xs font-bold text-slate-500 hover:text-[#8B5CF6] transition-colors"
            >
              Volver a las preguntas
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            {step === 'questions' ? (
              <button
                type="button"
                onClick={handleSynthesize}
                disabled={synthesizing || loadingQuestions}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7c3aed] text-white text-xs font-bold shadow-md shadow-[#8B5CF6]/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {synthesizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Redactando documento…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                    <span>
                      {answeredCount === 0 ? 'Redactar solo con lo pegado' : 'Redactar documento'}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!masterDraft.trim()}
                className="px-5 py-2 rounded-xl bg-[#2ECC71] hover:bg-[#27AE60] text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                Usar este documento
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
