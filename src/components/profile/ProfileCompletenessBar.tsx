"use client";

import React, { useMemo } from 'react';
import { Sparkles, CheckCircle2, ArrowUpRight, Zap, Target } from 'lucide-react';

interface ProfileCompletenessBarProps {
  bio: string;
  targetRoles: string[];
  techStack?: {
    frontend?: string[];
    backend?: string[];
    ai_ml?: string[];
    cloud_devops?: string[];
    database?: string[];
  } | Record<string, string[]>;
  keyProjects?: Array<{
    title: string;
    description: string;
    techStack?: string;
  }>;
  targetTransition?: {
    targetRole?: string;
    targetIndustries?: string;
  } | string;
  curationCriteria: string;
  onActionClick?: (section: string) => void;
}

export default function ProfileCompletenessBar({
  bio,
  targetRoles,
  techStack,
  keyProjects,
  targetTransition,
  curationCriteria,
  onActionClick,
}: ProfileCompletenessBarProps) {
  const { score, level, missingItems } = useMemo(() => {
    let currentScore = 0;
    const missing: Array<{ label: string; boost: number; section: string }> = [];

    // 1. Bio / Trayectoria (20 pts)
    if (bio && bio.trim().length >= 80) {
      currentScore += 20;
    } else {
      missing.push({
        label: '+20% Añade un resumen de trayectoria',
        boost: 20,
        section: 'bio',
      });
    }

    // 2. Tech Stack (20 pts)
    const allSkillsCount = techStack
      ? Object.values(techStack).flat().filter(Boolean).length
      : 0;
    if (allSkillsCount >= 4) {
      currentScore += 20;
    } else {
      missing.push({
        label: '+20% Añade tus tecnologías clave',
        boost: 20,
        section: 'tech_stack',
      });
    }

    // 3. Proyectos Estrella (20 pts)
    if (keyProjects && keyProjects.length > 0 && keyProjects.some((p) => p.title && p.description)) {
      currentScore += 20;
    } else {
      missing.push({
        label: '+20% Añade al menos 1 proyecto estrella',
        boost: 20,
        section: 'projects',
      });
    }

    // 4. Rol Objetivo / Transición (20 pts)
    const hasTargetRole = (targetRoles && targetRoles.length > 0) || (typeof targetTransition === 'object' && targetTransition?.targetRole);
    if (hasTargetRole) {
      currentScore += 20;
    } else {
      missing.push({
        label: '+20% Especifica tu rol u objetivo de transición',
        boost: 20,
        section: 'target',
      });
    }

    // 5. Criterios de Curación (20 pts)
    if (curationCriteria && curationCriteria.trim().length >= 30) {
      currentScore += 20;
    } else {
      missing.push({
        label: '+20% Configura reglas de puntuación para LinkedIn',
        boost: 20,
        section: 'criteria',
      });
    }

    let lvl = 'Básico';
    if (currentScore >= 80) lvl = 'Óptimo para IA';
    else if (currentScore >= 50) lvl = 'Intermedio';

    return { score: currentScore, level: lvl, missingItems: missing };
  }, [bio, targetRoles, techStack, keyProjects, targetTransition, curationCriteria]);

  return (
    <div className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#6D28D9] text-white flex items-center justify-center shadow-xs">
            <Zap className="w-4 h-4 stroke-[1.75]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                Fuerza del Perfil para la IA
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                score >= 80
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : score >= 50
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20'
              }`}>
                {level}
              </span>
            </div>
            <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
              Cuanta más riqueza técnica tenga tu perfil, más precisas serán las notas de matching y la adaptación de tus CVs.
            </p>
          </div>
        </div>

        <div className="text-right flex items-baseline sm:flex-col sm:items-end justify-between sm:justify-center">
          <span className="text-xl font-extrabold text-[#1e1b4b] dark:text-white font-display">
            {score}%
          </span>
          <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-400 font-sans">
            {score === 100 ? '¡Perfil Maestro completo!' : 'Completitud de contexto'}
          </span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-[#1e1b4b]/5 dark:border-white/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 80
              ? 'bg-gradient-to-r from-[#8B5CF6] via-emerald-500 to-[#2ECC71]'
              : score >= 50
              ? 'bg-gradient-to-r from-[#8B5CF6] to-amber-500'
              : 'bg-gradient-to-r from-[#8B5CF6] to-[#7c3aed]'
          }`}
          style={{ width: `${Math.max(score, 5)}%` }}
        />
      </div>

      {/* Sugerencias de acción rápida */}
      {missingItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 font-sans flex items-center gap-1">
            <Target className="w-3 h-3 text-[#8B5CF6] stroke-[1.75]" />
            Impulsa tu precisión:
          </span>
          {missingItems.slice(0, 3).map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => onActionClick?.(item.section)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8B5CF6] hover:text-[#6D28D9] dark:text-[#C4B5FD] bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
            >
              <span>{item.label}</span>
              <ArrowUpRight className="w-3 h-3 stroke-[1.75]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
