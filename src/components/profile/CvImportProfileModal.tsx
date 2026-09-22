"use client";

import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  X,
  Loader2,
  Check,
  AlertCircle,
  FileCheck2,
  Copy,
} from 'lucide-react';
import { useAiPromptDebug } from '@/components/ai/AiPromptDebugContext';
import { getOwnedCvContentAction } from '@/app/dashboard/settings-actions';

interface CvItem {
  id: string;
  title: string;
  isBase: boolean;
  isPrincipal: boolean;
  content?: string;
}

interface CvImportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCvs?: CvItem[];
  onApplyProfile: (extractedProfile: any) => void;
}

export default function CvImportProfileModal({
  isOpen,
  onClose,
  userCvs = [],
  onApplyProfile,
}: CvImportProfileModalProps) {
  const [tab, setTab] = useState<'upload' | 'select' | 'paste'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCvId, setSelectedCvId] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { inspectOrExecutePrompt } = useAiPromptDebug();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Solo se admiten archivos PDF.');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleExtract = async () => {
    let rawText = '';
    if (tab === 'select') {
      const found = userCvs.find((c) => c.id === selectedCvId);
      rawText = found?.content || '';
      if (!rawText && selectedCvId) {
        const owned = await getOwnedCvContentAction(selectedCvId);
        rawText = 'content' in owned ? owned.content : '';
      }
    } else if (tab === 'paste') {
      rawText = pastedText;
    }

    if (rawText) {
      const proceed = await inspectOrExecutePrompt({
        action: 'profile_extract',
        title: 'Estructurar Perfil Profesional con IA',
        data: { rawText },
      });
      if (!proceed) return;
    }

    setLoading(true);
    setError(null);

    try {
      let res: Response;

      if (tab === 'upload') {
        if (!selectedFile) {
          throw new Error('Por favor selecciona un archivo PDF de tu CV.');
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        res = await fetch('/api/ai/profile/extract', {
          method: 'POST',
          body: formData,
        });
      } else if (tab === 'select') {
        if (!rawText) {
          throw new Error('Selecciona un CV de la lista para continuar.');
        }
        res = await fetch('/api/ai/profile/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText }),
        });
      } else {
        if (!pastedText.trim()) {
          throw new Error('Por favor pega el texto de tu currículum o perfil.');
        }
        res = await fetch('/api/ai/profile/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pastedText }),
        });
      }

      const data = await res.json();
      if (data.success && data.profile) {
        onApplyProfile(data.profile);
        onClose();
      } else {
        throw new Error(data.error || 'No se pudo extraer la información del CV.');
      }
    } catch (err: any) {
      console.error('Error importing profile:', err);
      setError(err.message || 'Error al procesar el archivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-surface border border-subtle rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-subtle flex items-center justify-between bg-surface-muted/50 dark:bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text font-display">
                Auto-Completar Perfil desde CV
              </h2>
              <p className="text-xs text-text-muted font-sans">
                La IA extraerá tu trayectoria, stack y proyectos en segundos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-subtle px-5 pt-3 gap-3 bg-white dark:bg-surface">
          <button
            type="button"
            onClick={() => { setTab('upload'); setError(null); }}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              tab === 'upload'
                ? 'border-ai text-ai'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Upload className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Subir PDF</span>
          </button>

          {userCvs.length > 0 && (
            <button
              type="button"
              onClick={() => { setTab('select'); setError(null); }}
              className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                tab === 'select'
                  ? 'border-ai text-ai'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Mis CVs ({userCvs.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { setTab('paste'); setError(null); }}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              tab === 'paste'
                ? 'border-ai text-ai'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Copy className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Pegar texto</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-control dark:border-white/15 hover:border-ai dark:hover:border-ai rounded-2xl p-8 text-center cursor-pointer transition-all bg-surface-muted/50 dark:bg-canvas/50 hover:bg-ai/5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-ai/10 text-ai mx-auto flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 stroke-[1.75]" />
              </div>
              <p className="text-xs font-bold text-text font-display">
                {selectedFile ? selectedFile.name : 'Haz clic para seleccionar tu PDF o arrástralo aquí'}
              </p>
              <p className="text-[11px] text-text-muted font-sans mt-1">
                Admite documentos PDF de currículum estándar (máx. 10MB)
              </p>
            </div>
          )}

          {tab === 'select' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-text font-display mb-2">
                Selecciona uno de tus currículums existentes:
              </p>
              {userCvs.map((cv) => {
                const isSelected = selectedCvId === cv.id;
                return (
                  <div
                    key={cv.id}
                    onClick={() => setSelectedCvId(cv.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-ai/10 border-ai text-text'
                        : 'bg-surface-muted dark:bg-canvas border-subtle hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className={`w-4 h-4 ${isSelected ? 'text-ai' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-xs font-bold font-display">{cv.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {cv.isBase ? 'CV Base' : cv.isPrincipal ? 'CV Principal' : 'Currículum'}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-ai stroke-[2]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'paste' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text font-display">
                Pega tu LinkedIn About, notas o resumen:
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={7}
                placeholder="Pega aquí el contenido de tu CV o notas de experiencia..."
                className="w-full rounded-xl bg-surface-muted dark:bg-canvas border border-control px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans resize-y"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-subtle flex items-center justify-end gap-2 bg-surface-muted dark:bg-canvas">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-subtle dark:hover:bg-surface-muted transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExtract}
            disabled={loading || (tab === 'upload' && !selectedFile) || (tab === 'select' && !selectedCvId) || (tab === 'paste' && !pastedText.trim())}
            className="px-5 py-2 rounded-xl bg-action hover:bg-action-hover text-on-action text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Extrayendo con IA…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Auto-Completar Perfil</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
