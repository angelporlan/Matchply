"use client";

import React, { useMemo } from 'react';
import { ArrowUpRight, Target, Zap } from 'lucide-react';

interface ProfileCompletenessBarProps {
  dumpText: string;
  masterDocument: string;
  curationCriteria: string;
  onActionClick?: (section: string) => void;
}

export default function ProfileCompletenessBar({
  dumpText,
  masterDocument,
  curationCriteria,
  onActionClick,
}: ProfileCompletenessBarProps) {
  const { score, level, missingItems } = useMemo(() => {
    let currentScore = 0;
    const missing: Array<{ label: string; boost: number; section: string }> = [];

    if (dumpText && dumpText.trim().length >= 80) {
      currentScore += 35;
    } else {
      missing.push({ label: '+35% Pega tu experiencia', boost: 35, section: 'dump' });
    }

    if (masterDocument && masterDocument.trim().length >= 120) {
      currentScore += 40;
    } else {
      missing.push({ label: '+40% Genera el documento maestro', boost: 40, section: 'master' });
    }

    if (curationCriteria && curationCriteria.trim().length >= 20) {
      currentScore += 25;
    } else {
      missing.push({ label: '+25% Añade reglas de puntuación', boost: 25, section: 'criteria' });
    }

    let lvl = 'Básico';
    if (currentScore >= 80) lvl = 'Listo para la IA';
    else if (currentScore >= 50) lvl = 'A medio camino';

    return { score: currentScore, level: lvl, missingItems: missing };
  }, [dumpText, masterDocument, curationCriteria]);

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
                Fuerza del perfil
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                score >= 80
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20'
              }`}>
                {level}
              </span>
            </div>
            <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
              Pega experiencia, genera el documento y define cómo puntuar ofertas. El rol objetivo es opcional.
            </p>
          </div>
        </div>
        <span className="text-xl font-extrabold text-[#1e1b4b] dark:text-white font-display">{score}%</span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#2ECC71] transition-all duration-500"
          style={{ width: `${Math.max(score, 5)}%` }}
        />
      </div>
      {missingItems.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[10px] font-bold text-[#1e1b4b]/60 flex items-center gap-1">
            <Target className="w-3 h-3 text-[#8B5CF6] stroke-[1.75]" />
            Siguiente paso:
          </span>
          {missingItems.map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => onActionClick?.(item.section)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8B5CF6] bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 px-2 py-0.5 rounded-lg"
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
