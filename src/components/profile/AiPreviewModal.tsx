"use client";

import React from 'react';
import { formatCareerProfileContext } from '@/lib/career-profile';
import type { ScoringPreferences } from '@/lib/curation-constraints';
import {
  Eye,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Sliders,
  Briefcase,
} from 'lucide-react';

interface AiPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: {
    bio: string;
    targetRoles: string[];
    experienceYears?: number | '';
    techStack?: Record<string, string[] | undefined> | any;
    skills?: Array<{
      name: string;
      category?: string;
      proficiency?: string;
      evidence?: string;
    }>;
    keyProjects?: Array<{
      title: string;
      techStack?: string;
      description: string;
      impact?: string;
    }>;
    targetTransition?: {
      targetRole?: string;
      targetIndustries?: string;
      targetGeography?: string;
    } | string;
    preferredWorkplaces: string[];
    preferredLocations: string;
    companyPreferences: string;
    salaryMin?: number | '';
    salaryTarget?: number | '';
    englishLevel?: string;
    englishOverLevelPolicy?: string;
    scoringPreferences?: ScoringPreferences;
    curationCriteria: string;
    masterDocument?: string;
  };
  constraintChips: string[];
}

export default function AiPreviewModal({
  isOpen,
  onClose,
  profileData,
  constraintChips,
}: AiPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-surface border border-ai/30 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-subtle flex items-center justify-between bg-gradient-to-r from-ai/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-ai to-ai-action text-white flex items-center justify-center shadow-xs">
              <Eye className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-text font-display">
                Cómo te ve la IA
              </h2>
              <p className="text-xs text-text-muted font-sans">
                Revisa tu resumen profesional y las condiciones de puntuación antes de guardar el perfil.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa del perfil"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 font-sans text-xs">
          {/* Reglas Duras */}
          <div className="bg-surface-muted dark:bg-canvas border border-ai/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-ai font-bold font-display text-xs">
              <ShieldCheck className="w-4 h-4 stroke-[1.75]" />
              <span>Condiciones que limitan la puntuación:</span>
            </div>
            {constraintChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {constraintChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-lg border border-ai/30 bg-ai/10 px-2.5 py-1 text-[11px] font-bold text-ai-text dark:text-ai"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                No has definido límites de puntuación. Indicar tu nivel de inglés no activa penalizaciones.
              </p>
            )}
          </div>

          {(profileData.scoringPreferences?.reviewRequired.length || 0) > 0 && (
            <div className="rounded-xl border border-subtle p-4 text-text">
              <p className="font-bold">Criterios pendientes de aclarar — inactivos</p>
              <ul className="mt-2 list-disc pl-4 space-y-1">
                {profileData.scoringPreferences!.reviewRequired.map((text) => <li key={text}>{text}</li>)}
              </ul>
            </div>
          )}

          {/* Contexto inyectado */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-text font-display flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-ai stroke-[1.75]" />
              Resumen profesional:
            </p>
            <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto border border-slate-800">
{formatCareerProfileContext(profileData) || 'Aún no hay suficiente perfil para inyectar contexto.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-subtle flex items-center justify-end bg-surface-muted dark:bg-canvas">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-ai-action hover:bg-ai-hover text-on-ai-action text-xs font-bold transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
