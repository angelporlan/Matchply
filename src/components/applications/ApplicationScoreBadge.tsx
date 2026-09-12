"use client";

import { Sparkles } from 'lucide-react';
import { scoreToPercent } from '@/lib/application-views';

interface ApplicationScoreBadgeProps {
  score: number | null | undefined;
  className?: string;
}

export default function ApplicationScoreBadge({ score, className = '' }: ApplicationScoreBadgeProps) {
  const value = scoreToPercent(score);

  if (value === null) {
    return (
      <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-muted dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10 shrink-0 font-sans ${className}`}>
        N/D
      </span>
    );
  }

  if (value >= 75) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 font-sans ${className}`}>
        <Sparkles className="w-2.5 h-2.5 text-emerald-500 stroke-[2]" />
        {value}%
      </span>
    );
  }

  if (value >= 50) {
    return (
      <span className={`inline-flex items-center text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 font-sans ${className}`}>
        {value}%
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 shrink-0 font-sans ${className}`}>
      {value}%
    </span>
  );
}
