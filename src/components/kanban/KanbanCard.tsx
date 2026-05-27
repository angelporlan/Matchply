"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobOffer, CV } from '@/db/schema';
import { updateJobOfferStatus, updateJobOfferCv, deleteJobOffer, archiveJobOffer } from '@/app/dashboard/kanban/actions';
import { ExternalLink, Trash2, ArrowLeft, ArrowRight, Link as LinkIcon, Archive } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import AlertModal from '../ui/AlertModal';
import { Draggable } from '@hello-pangea/dnd';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface KanbanCardProps {
  offer: JobOffer;
  userCvs: CV[];
  onOpenDetails: (offer: JobOffer) => void;
  density?: 'compact' | 'comfortable';
  index: number;
}

export default function KanbanCard({
  offer,
  userCvs,
  onOpenDetails,
  density = 'compact',
  index,
}: KanbanCardProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [selectedCv, setSelectedCv] = useState<string>(offer.cvId || '');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const isCompact = density === 'compact';

  // Determinar colores de plataforma
  const getPlatformStyle = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'infojobs':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'indeed':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
      default:
        return 'bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b]/50 dark:text-slate-400 border-[#1e1b4b]/10 dark:border-white/10';
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    const result = await updateJobOfferStatus(offer.id, newStatus);
    if (result.success) {
      router.refresh();
    }
    setLoading(false);
  };

  const handleCvChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cvId = e.target.value;
    setSelectedCv(cvId);
    setLoading(true);
    const result = await updateJobOfferCv(offer.id, cvId === '' ? null : cvId);
    if (result.success) {
      router.refresh();
    }
    setLoading(false);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleArchive = async () => {
    setLoading(true);
    const result = await archiveJobOffer(offer.id);
    if (result.success) {
      router.refresh();
    }
    setLoading(false);
  };

  const confirmDelete = async () => {
    setIsDeleteModalOpen(false);
    setLoading(true);
    const result = await deleteJobOffer(offer.id);
    if (result.success) {
      router.refresh();
    }
    setLoading(false);
  };

  // Estados ordenados del pipeline para controles de dirección
  const statuses = ['interested', 'applied', 'interview', 'offer', 'rejected'];
  const statusLabels: Record<string, string> = {
    interested: t('kanban.columns.interested.title'),
    applied: t('kanban.columns.applied.title'),
    interview: t('kanban.columns.interview.title'),
    offer: t('kanban.columns.offer.title'),
    rejected: t('kanban.columns.rejected.title'),
  };
  const currentIndex = statuses.indexOf(offer.status);

  // Dynamic translated tooltip title
  const getMoveToTooltip = (statusKey: string) => {
    return t('kanban.card.moveTo', { status: statusLabels[statusKey] });
  };

  return (
    <Draggable draggableId={offer.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpenDetails(offer)}
          style={{
            ...provided.draggableProps.style,
          }}
          className={`bg-white dark:bg-[#1f2937] border transition-all relative group overflow-hidden cursor-grab active:cursor-grabbing hover:scale-[1.01] hover:-translate-y-0.5 select-none ${
            isCompact ? 'p-3 rounded-[12px]' : 'p-5 rounded-[12px]'
          } ${
            snapshot.isDragging 
              ? 'opacity-95 border-[#8b5cf6] dark:border-violet-500/80 bg-white/95 dark:bg-[#1f2937]/95 shadow-2xl shadow-[#8b5cf6]/10 scale-[1.02] rotate-[-0.5deg]' 
              : 'border-[#1e1b4b]/10 dark:border-white/5 hover:border-[#1e1b4b]/20 dark:hover:border-white/10 shadow-sm hover:shadow-md'
          } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className={`flex items-start justify-between gap-3 ${isCompact ? 'mb-2.5' : 'mb-3'}`}>
            <div className="min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPlatformStyle(offer.platform)}`}>
                {offer.platform}
              </span>
              <h4 className={`font-bold text-[#1e1b4b] dark:text-white leading-snug group-hover:text-[#8b5cf6] dark:group-hover:text-violet-400 transition-colors break-words font-display ${
                isCompact ? 'text-[13px] mt-1.5' : 'text-sm mt-2'
              }`}>
                {offer.title}
              </h4>
              <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium mt-0.5 truncate font-sans">{offer.company}</p>
            </div>

            {offer.url && (
              <a
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[#1e1b4b]/40 dark:text-slate-500 hover:text-[#1e1b4b] dark:hover:text-white p-1 rounded-[8px] transition-colors shrink-0"
                title={t('kanban.modal.linkCvOfficial')}
                aria-label={t('kanban.modal.linkCvOfficial')}
              >
                <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
              </a>
            )}
          </div>

          {/* Selector de CV Personalizado */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[8px] flex items-center gap-2 ${
              isCompact ? 'mb-2.5 p-2' : 'mb-4 p-2.5'
            }`}
          >
            <LinkIcon className="w-3 h-3 text-[#1e1b4b]/40 dark:text-slate-500 shrink-0 stroke-[1.75]" />
            <select
              value={selectedCv}
              onChange={handleCvChange}
              className="w-full bg-transparent text-[10px] text-[#1e1b4b]/80 dark:text-slate-300 font-medium focus:outline-none cursor-pointer font-sans"
            >
              <option value="" className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b]/45 dark:text-slate-550">{t('kanban.card.placeholderCv')}</option>
              {userCvs.map((cv) => (
                <option key={cv.id} value={cv.id} className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b] dark:text-slate-300">
                  {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                </option>
              ))}
            </select>
          </div>

          {/* Controles de cambio de estado y eliminación */}
          <div className={`flex items-center justify-between border-t border-[#1e1b4b]/10 dark:border-white/5 ${isCompact ? 'pt-2' : 'pt-3'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive();
                }}
                className="text-[#1e1b4b]/40 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 p-1.5 rounded-[8px] transition-colors shrink-0"
                title={t('kanban.card.archiveBtn')}
                aria-label={t('kanban.card.archiveBtn')}
              >
                <Archive className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="text-[#1e1b4b]/40 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-[8px] transition-colors shrink-0"
                title={t('kanban.card.deleteBtn')}
                aria-label={t('kanban.card.deleteBtn')}
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
              <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 font-light truncate font-sans">
                {t('kanban.card.updatedAtText')} {new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {currentIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(statuses[currentIndex - 1]);
                  }}
                  className="bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#1e1b4b]/20 dark:hover:border-white/20 text-[#1e1b4b]/70 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-1.5 rounded-[8px] transition-colors"
                  title={getMoveToTooltip(statuses[currentIndex - 1])}
                  aria-label={getMoveToTooltip(statuses[currentIndex - 1])}
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
                </button>
              )}

              {currentIndex < statuses.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(statuses[currentIndex + 1]);
                  }}
                  className="bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#1e1b4b]/20 dark:hover:border-white/20 text-[#1e1b4b]/70 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-1.5 rounded-[8px] transition-colors"
                  title={getMoveToTooltip(statuses[currentIndex + 1])}
                  aria-label={getMoveToTooltip(statuses[currentIndex + 1])}
                >
                  <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
                </button>
              )}
            </div>
          </div>

          <AlertModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            title={t('kanban.card.deleteTitle')}
            message={t('kanban.card.deleteMessage', { title: offer.title, company: offer.company })}
            type="danger"
            confirmLabel={t('kanban.card.deleteConfirm')}
            cancelLabel={t('common.cancel')}
            onConfirm={confirmDelete}
            isPending={loading}
          />
        </div>
      )}
    </Draggable>
  );
}
