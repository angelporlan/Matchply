"use client";

import { useState } from 'react';
import {
  Archive,
  ArrowUpDown,
  Ban,
  Bookmark,
  Calendar,
  CheckCircle2,
  ListChecks,
  Link2,
  PartyPopper,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { ApplicationSummary, CvListItem } from '@/lib/job-offer-queries';
import type { ApplicationStatusCounts } from '@/lib/application-filter-bounds';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import ApplicationCard from './ApplicationCard';
import ApplicationDenseListItem from './ApplicationDenseListItem';

interface Column {
  id: 'interested' | 'applied' | 'interview' | 'offer' | 'rejected' | 'archived';
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  borderColor: string;
}

interface ApplicationsBoardViewProps {
  offers: ApplicationSummary[];
  filteredOffers: ApplicationSummary[];
  hasActiveFilters: boolean;
  userCvs: CvListItem[];
  viewMode: 'compact' | 'comfortable';
  interestedSortMode: 'score' | 'date';
  draggingOfferId: string | null;
  onDragStart: (offerId: string) => void;
  onDragEnd: (result: any) => void;
  onToggleInterestedSort: () => void;
  onOpenCurate: (simulation: boolean) => void;
  onOpenDetails: (offer: ApplicationSummary) => void;
  onDelete: (offerId: string) => void;
  columnCounts?: ApplicationStatusCounts;
}

export default function ApplicationsBoardView({
  offers,
  filteredOffers,
  hasActiveFilters,
  userCvs,
  viewMode,
  interestedSortMode,
  draggingOfferId,
  onDragStart,
  onDragEnd,
  onToggleInterestedSort,
  onOpenCurate,
  onOpenDetails,
  onDelete,
  columnCounts,
}: ApplicationsBoardViewProps) {
  const { t } = useLanguage();
  const [visibleByColumn, setVisibleByColumn] = useState<Partial<Record<Column['id'], number>>>({});
  const COLUMN_CAP = 50;

  const columns: Column[] = [
    { id: 'interested', title: t('applications.columns.interested.title'), shortTitle: t('applications.columns.interested.shortTitle'), description: t('applications.columns.interested.desc'), color: 'text-indigo-400 bg-indigo-500/10', borderColor: 'border-indigo-500/20' },
    { id: 'applied', title: t('applications.columns.applied.title'), shortTitle: t('applications.columns.applied.shortTitle'), description: t('applications.columns.applied.desc'), color: 'text-blue-400 bg-blue-500/10', borderColor: 'border-blue-500/20' },
    { id: 'interview', title: t('applications.columns.interview.title'), shortTitle: t('applications.columns.interview.shortTitle'), description: t('applications.columns.interview.desc'), color: 'text-amber-400 bg-amber-500/10', borderColor: 'border-amber-500/20' },
    { id: 'offer', title: t('applications.columns.offer.title'), shortTitle: t('applications.columns.offer.shortTitle'), description: t('applications.columns.offer.desc'), color: 'text-emerald-400 bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
    { id: 'rejected', title: t('applications.columns.rejected.title'), shortTitle: t('applications.columns.rejected.shortTitle'), description: t('applications.columns.rejected.desc'), color: 'text-rose-400 bg-rose-500/10', borderColor: 'border-rose-500/20' },
    { id: 'archived', title: t('applications.columns.archived.title'), shortTitle: t('applications.columns.archived.shortTitle'), description: t('applications.columns.archived.desc'), color: 'text-slate-400 bg-slate-500/10', borderColor: 'border-slate-500/20' },
  ];

  const renderColumnIcon = (columnId: Column['id']) => {
    switch (columnId) {
      case 'interested':
        return <Bookmark className="w-3.5 h-3.5" />;
      case 'applied':
        return <Send className="w-3.5 h-3.5" />;
      case 'interview':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'offer':
        return <PartyPopper className="w-3.5 h-3.5" />;
      case 'rejected':
        return <Ban className="w-3.5 h-3.5" />;
      case 'archived':
        return <Archive className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <DragDropContext
      onDragStart={(start) => onDragStart(start.draggableId)}
      onDragEnd={onDragEnd}
    >
      <div className="-mx-4 px-4 overflow-x-auto pb-4 scrollbar-custom">
        <div className="grid min-w-[1480px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-start">
          {columns.map((column) => {
            const rawColumnOffers = offers.filter((offer) => offer.status === column.id);
            let columnOffers = filteredOffers.filter((offer) => offer.status === column.id);
            const globalCount = columnCounts?.[column.id] ?? rawColumnOffers.length;

            if (column.id === 'interested') {
              columnOffers = [...columnOffers].sort((a, b) => {
                if (interestedSortMode === 'score') {
                  const scoreA = a.scoreOverall ?? -1;
                  const scoreB = b.scoreOverall ?? -1;
                  if (scoreA !== scoreB) return scoreB - scoreA;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });
            }

            const isInterested = column.id === 'interested';
            const visibleLimit = visibleByColumn[column.id] ?? COLUMN_CAP;
            const hiddenCount = Math.max(0, columnOffers.length - visibleLimit);
            const visibleOffers = columnOffers.slice(0, visibleLimit);

            return (
              <div
                key={column.id}
                aria-label={`Columna ${column.title}`}
                className={`flex h-[calc(100vh-330px)] min-h-[520px] max-h-[760px] flex-col bg-surface rounded-[12px] border relative overflow-hidden transition-all duration-300 ${
                  draggingOfferId && !visibleOffers.some(o => o.id === draggingOfferId)
                    ? 'shadow-sm border-subtle'
                    : `${column.borderColor} shadow-sm hover:shadow-md`
                }`}
              >
                {/* Cabecera de la columna */}
                <div className="shrink-0 p-3.5 pb-3 border-b border-subtle bg-canvas/45">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${column.color}`}>
                        {renderColumnIcon(column.id)}
                        {column.shortTitle}
                      </span>
                      <p className="text-[11px] text-text-muted mt-2 truncate font-sans">{column.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 font-display">
                      <span className="text-sm font-bold text-text bg-canvas px-2.5 py-1 rounded-[8px] border border-subtle shadow-sm">
                        {hasActiveFilters && globalCount > 0 ? `${columnOffers.length}/${globalCount}` : globalCount}
                      </span>
                      <span className="text-[10px] font-medium text-text-muted">
                        {t('applications.board.offersCount')}
                      </span>
                    </div>
                  </div>

                  {isInterested && rawColumnOffers.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-subtle flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenCurate(false)}
                        className="flex-1 text-[11px] font-bold py-1.5 px-2 rounded-lg bg-gradient-to-r from-ai to-ai-action text-white shadow-xs shadow-ai/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-1.5 font-display min-w-0"
                      >
                        <Sparkles className="w-3 h-3 stroke-[2] text-violet-200 shrink-0" />
                        <span className="truncate">Curar con IA</span>
                        <span className="bg-white/20 px-1.5 py-0.2 rounded text-[10px] shrink-0">
                          {rawColumnOffers.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenCurate(true)}
                        title="Probar animación de streaming en vivo sin consumir tokens"
                        className="text-[10.5px] font-bold px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 transition-all flex items-center gap-1 shrink-0"
                      >
                        <span>🧪 Test UI</span>
                      </button>

                      <button
                        type="button"
                        onClick={onToggleInterestedSort}
                        title={interestedSortMode === 'score' ? "Ordenado por Score IA (Click para ordenar por fecha)" : "Ordenado por Fecha (Click para ordenar por Score IA)"}
                        className={`text-[10.5px] font-bold px-2 py-1.5 rounded-lg border transition-colors flex items-center gap-1 shrink-0 ${
                          interestedSortMode === 'score'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-white dark:bg-surface text-slate-500 border-subtle'
                        }`}
                      >
                        <ArrowUpDown className="w-3 h-3 stroke-[2]" />
                        <span>{interestedSortMode === 'score' ? 'Score' : 'Fecha'}</span>
                      </button>
                    </div>
                  )}

                  {rawColumnOffers.length > 0 && !isInterested && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-canvas border border-control overflow-hidden">
                        <div
                          className={`h-full rounded-full ${column.color.split(' ')[1]}`}
                          style={{
                            width: `${Math.max(8, Math.round((columnOffers.length / rawColumnOffers.length) * 100))}%`,
                            opacity: hasActiveFilters ? 0.8 : 1,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de elementos (Lista densa en Interés, Tarjetas en las demás) */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto scrollbar-custom p-3 pr-2 transition-all duration-200 ${
                        isInterested
                          ? 'space-y-1.5'
                          : viewMode === 'compact' ? 'space-y-2.5' : 'space-y-4'
                      } ${
                        snapshot.isDraggingOver
                          ? 'bg-ai/5 dark:bg-ai/8 shadow-inner border border-dashed border-ai/25 dark:border-violet-500/25 rounded-b-[12px] -m-[1px]'
                          : ''
                      }`}
                    >
                      {visibleOffers.length === 0 ? (
                        <div className="h-full min-h-[260px] flex flex-col items-center justify-center border-2 border-dashed border-subtle rounded-[12px] p-6 text-center text-text-muted">
                          {hasActiveFilters ? (
                            <>
                              <Search className="w-6 h-6 mb-2 text-text-muted dark:text-slate-600 opacity-70 stroke-[1.75]" />
                              <p className="text-[11px] font-bold uppercase tracking-wider font-display">{t('applications.board.noResults')}</p>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-6 h-6 mb-2 text-text-muted dark:text-slate-600 opacity-60 stroke-[1.75]" />
                              <p className="text-[11px] font-bold uppercase tracking-wider font-display">{t('applications.board.emptyBoard')}</p>
                            </>
                          )}
                        </div>
                      ) : isInterested ? (
                        visibleOffers.map((offer, index) => (
                          <ApplicationDenseListItem
                            key={offer.id}
                            offer={offer}
                            index={index}
                            onOpenDetails={onOpenDetails}
                            onDelete={onDelete}
                          />
                        ))
                      ) : (
                        visibleOffers.map((offer, index) => (
                          <ApplicationCard
                            key={offer.id}
                            offer={offer}
                            userCvs={userCvs}
                            onOpenDetails={onOpenDetails}
                            density={viewMode}
                            index={index}
                            onDelete={onDelete}
                          />
                        ))
                      )}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setVisibleByColumn((prev) => ({
                            ...prev,
                            [column.id]: visibleLimit + COLUMN_CAP,
                          }))}
                          className="w-full mt-1 py-2 text-[11px] font-bold uppercase tracking-wider text-ai hover:bg-ai/8 rounded-[8px] font-display"
                        >
                          {t('applications.board.loadMore')} ({hiddenCount})
                        </button>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                <div className="shrink-0 border-t border-subtle bg-canvas/45 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted font-sans">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <ListChecks className="w-3.5 h-3.5 shrink-0 stroke-[1.75]" />
                      <span className="truncate">{columnOffers.length} {t('applications.board.visibleText')}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Link2 className="w-3.5 h-3.5 stroke-[1.75]" />
                      {columnOffers.filter((offer) => offer.cvId).length}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
