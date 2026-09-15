"use client";

import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { ApplicationSummary } from '@/lib/job-offer-queries';
import { Sparkles, ExternalLink, Send, GripVertical } from 'lucide-react';
import { updateJobOfferStatus } from '@/app/dashboard/applications/actions';
import { scoreToPercent } from '@/lib/application-views';

interface ApplicationDenseListItemProps {
  offer: ApplicationSummary;
  index: number;
  onOpenDetails: (offer: ApplicationSummary) => void;
  onDelete?: (offerId: string) => void;
}

export default function ApplicationDenseListItem({
  offer,
  index,
  onOpenDetails,
}: ApplicationDenseListItemProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const rawScore = offer.scoreOverall;
  const scoreVal = scoreToPercent(rawScore);

  const getScoreBadge = () => {
    if (scoreVal === null) {
      return (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-muted dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10 shrink-0 font-sans">
          N/D
        </span>
      );
    }
    if (scoreVal >= 75) {
      return (
        <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-0.5 font-sans">
          <Sparkles className="w-2.5 h-2.5 text-emerald-500 stroke-[2]" />
          {scoreVal}%
        </span>
      );
    }
    if (scoreVal >= 50) {
      return (
        <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 font-sans">
          {scoreVal}%
        </span>
      );
    }
    return (
      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 shrink-0 font-sans">
        {scoreVal}%
      </span>
    );
  };

  const handleMoveToApplied = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoadingAction('applied');
      await updateJobOfferStatus(offer.id, 'applied');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Draggable draggableId={offer.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={() => onOpenDetails(offer)}
          className={`group relative px-3 py-2 rounded-xl transition-all duration-150 select-none ${
            snapshot.isDragging
              ? 'opacity-95 bg-surface border-2 border-ai shadow-xl scale-[1.02] z-50'
              : 'bg-surface/90 border border-subtle hover:border-ai/40 hover:shadow-sm'
          } ${loadingAction ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* Fila Principal: Grip, Score, Título completo y Acciones */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div 
                {...provided.dragHandleProps}
                className="text-text-muted dark:text-white/20 group-hover:text-ai cursor-grab active:cursor-grabbing p-0.5 -ml-1 transition-colors shrink-0"
                title="Arrastrar para mover"
              >
                <GripVertical className="w-3.5 h-3.5 stroke-[1.75]" />
              </div>

              {getScoreBadge()}

              <h4 
                className="text-[12.5px] font-bold text-text group-hover:text-ai dark:group-hover:text-violet-400 transition-colors truncate font-display flex-1 leading-tight"
                title={offer.title}
              >
                {offer.title}
              </h4>
            </div>

            {/* Acciones en Hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
              <button
                type="button"
                onClick={handleMoveToApplied}
                title="Mover a Postulado"
                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
              >
                <Send className="w-3 h-3 stroke-[2]" />
              </button>

              {offer.url && (
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Abrir oferta oficial"
                  className="p-1 rounded-md text-slate-400 hover:text-text dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 stroke-[2]" />
                </a>
              )}
            </div>
          </div>

          {/* Subtítulo: Empresa y Plataforma */}
          <div className="flex items-center justify-between gap-2 mt-0.5 pl-5">
            <p className="text-[11px] text-text-muted font-medium truncate font-sans">
              {offer.company}
            </p>
            {offer.platform && (
              <span className="text-[8.5px] font-semibold text-slate-400 dark:text-text-muted uppercase tracking-wider shrink-0">
                {offer.platform}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
