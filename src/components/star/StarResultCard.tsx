import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface StarResultCardProps {
  title: string;
  description: string;
  success: boolean;
}

/**
 * Premium UI component to display the result of a STAR (Situation, Task, Action, Result)
 * analysis. It follows the design system (color palette, micro‑animations) defined
 * in `design.md`.
 */
export default function StarResultCard({ title, description, success }: StarResultCardProps) {
  return (
    <div className="border border-[#1e1b4b]/10 dark:border-white/5 rounded-xl p-4 bg-white dark:bg-[#1f2937] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        {success ? (
          <CheckCircle className="w-5 h-5 text-[#2ecc71]" />
        ) : (
          <XCircle className="w-5 h-5 text-[#ef4444]" />
        )}
        <h3 className="font-bold text-[#1e1b4b] dark:text-white text-lg">{title}</h3>
      </div>
      <p className="text-sm text-[#1e1b4b]/70 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
