"use client";

import React, { useMemo } from 'react';
import { ArrowUpRight, Target, Zap } from 'lucide-react';
import {
  computeProfileCompleteness,
  type KeyProject,
  type ProfileSkill,
} from '@/lib/career-profile';

interface ProfileCompletenessBarProps {
  dumpText: string;
  masterDocument: string;
  curationCriteria: string;
  skills?: ProfileSkill[];
  keyProjects?: KeyProject[];
  preferredLocations?: string;
  companyPreferences?: string;
  salaryMin?: number | '' | null;
  preferredWorkplaces?: string[];
  onActionClick?: (section: string) => void;
}

export default function ProfileCompletenessBar({
  dumpText,
  masterDocument,
  curationCriteria,
  skills = [],
  keyProjects = [],
  preferredLocations = '',
  companyPreferences = '',
  salaryMin = '',
  preferredWorkplaces = [],
  onActionClick,
}: ProfileCompletenessBarProps) {
  const { score, level, missingItems } = useMemo(
    () => computeProfileCompleteness({
      bio: dumpText,
      masterDocument,
      curationCriteria,
      skills,
      keyProjects,
      preferredLocations,
      companyPreferences,
      salaryMin,
      preferredWorkplaces,
    }),
    [
      dumpText,
      masterDocument,
      curationCriteria,
      skills,
      keyProjects,
      preferredLocations,
      companyPreferences,
      salaryMin,
      preferredWorkplaces,
    ],
  );

  return (
    <div className="bg-white dark:bg-surface border border-subtle rounded-2xl p-5 shadow-sm space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-ai to-ai-hover text-white flex items-center justify-center shadow-xs">
            <Zap className="w-4 h-4 stroke-[1.75]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-text font-display">
                Fuerza del perfil
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                score >= 80
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-ai/10 text-ai border-ai/20'
              }`}>
                {level}
              </span>
            </div>
            <p className="text-[11px] text-text-muted font-sans">
              Cuenta experiencia, stack con prueba, proyectos y preferencias. El rol objetivo es opcional.
            </p>
          </div>
        </div>
        <span className="text-xl font-extrabold text-text font-display">{score}%</span>
      </div>
      <div className="w-full h-2.5 bg-surface-muted rounded-full overflow-hidden p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-ai to-action transition-all duration-500"
          style={{ width: `${Math.max(score, 5)}%` }}
        />
      </div>
      {missingItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
            <Target className="w-3 h-3 text-ai stroke-[1.75]" />
            Siguiente paso:
          </span>
          {missingItems.map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => onActionClick?.(item.section)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-ai bg-ai/5 border border-ai/20 px-2 py-0.5 rounded-lg"
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
