'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Play, X, Loader2, Terminal, Code, AlignLeft } from 'lucide-react';
import type { AiPromptDebugResponse } from '@/lib/ai-prompts-debug';

interface AiPromptDebugModalProps {
  isOpen: boolean;
  loading: boolean;
  error?: string | null;
  debugData?: AiPromptDebugResponse | null;
  onExecute: () => void;
  onCopyAndClose: () => void;
  onCancel: () => void;
}

export default function AiPromptDebugModal({
  isOpen,
  loading,
  error,
  debugData,
  onExecute,
  onCopyAndClose,
  onCancel,
}: AiPromptDebugModalProps) {
  const [activeTab, setActiveTab] = useState<'full' | 'system' | 'user'>('full');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setActiveTab('full');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!debugData) return;
    try {
      let textToCopy = debugData.fullPromptText;
      if (activeTab === 'system') textToCopy = debugData.systemPrompt;
      else if (activeTab === 'user') textToCopy = debugData.userPrompt;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleCopyAndExit = async () => {
    if (!debugData) return;
    await handleCopy();
    onCopyAndClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl bg-surface border border-ai/30 shadow-2xl rounded-[16px] overflow-hidden flex flex-col max-h-[90vh] text-text font-sans"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-ai/15 text-ai border border-ai/25 font-mono">
              <Terminal className="w-3.5 h-3.5" />
              AI_PROMPTS_DEBUG
            </span>
            <h2 className="text-sm font-bold text-text truncate max-w-md">
              {debugData?.actionTitle || 'Depuración de Prompt de IA'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-subtle transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-ai animate-spin" />
              <p className="text-sm font-medium text-text-muted">
                Construyendo e interpolando el prompt con los datos de la acción...
              </p>
            </div>
          ) : error ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-rose-500 font-semibold">{error}</p>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-subtle text-xs font-bold uppercase tracking-wider"
              >
                Cerrar
              </button>
            </div>
          ) : debugData ? (
            <>
              {/* Informative Callout */}
              <div className="rounded-xl border border-ai/20 bg-ai/5 p-3 text-xs text-text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-text">Modo depuración activo:</span>{' '}
                  Esta acción no se ha ejecutado. Puedes revisar el prompt exacto generado con tus datos reales y decidir qué hacer.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-canvas border border-subtle text-[11px] font-mono text-text">
                    {debugData.provider}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-canvas border border-subtle text-[11px] font-mono text-ai font-semibold">
                    {debugData.model}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="segmented" role="group" aria-label="Vista del prompt">
                <button
                  type="button"
                  onClick={() => setActiveTab('full')}
                  className="segmented__item"
                  aria-pressed={activeTab === 'full'}
                >
                  <Code className="w-3.5 h-3.5" />
                  Prompt Completo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('system')}
                  className="segmented__item"
                  aria-pressed={activeTab === 'system'}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  System Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('user')}
                  className="segmented__item"
                  aria-pressed={activeTab === 'user'}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  User Prompt (Datos)
                </button>
                </div>

                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn-raised btn-raised--ghost btn-raised--sm px-2.5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-bold">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-text-muted" />
                        <span>Copiar vista</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Code viewer */}
              <div className="relative rounded-xl border border-subtle bg-canvas p-4 max-h-[380px] overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed text-text/90 select-all">
                  {activeTab === 'full' && debugData.fullPromptText}
                  {activeTab === 'system' && debugData.systemPrompt}
                  {activeTab === 'user' && debugData.userPrompt}
                </pre>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-subtle bg-surface-hover/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-subtle text-xs font-semibold text-text-muted hover:text-text hover:bg-subtle transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              disabled={loading || !debugData}
              onClick={handleCopyAndExit}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-ai/30 bg-ai/10 text-ai hover:bg-ai/15 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              <span>Copiar prompt y no ejecutar</span>
            </button>
            <button
              type="button"
              disabled={loading || !debugData}
              onClick={onExecute}
              className="btn-raised btn-raised--ai btn-raised--sm flex-1 sm:flex-initial"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Ejecutar realmente</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
