"use client";

import { Sparkles } from 'lucide-react';
import { scoreToPercent } from '@/lib/application-views';
import { matchScoreBadgeClass, matchScoreBand } from './matchScoreStyle';

interface ApplicationScoreBadgeProps {
  score: number | null | undefined;
  className?: string;
}

export default function ApplicationScoreBadge({ score, className = '' }: ApplicationScoreBadgeProps) {
  const value = scoreToPercent(score);
  const band = matchScoreBand(value);

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 font-sans tabular-nums ${matchScoreBadgeClass(value)} ${className}`}>
      {band === 'high' && <Sparkles className="w-2.5 h-2.5 stroke-[2]" aria-hidden="true" />}
      {value === null ? 'N/D' : `${value}%`}
    </span>
  );
}
