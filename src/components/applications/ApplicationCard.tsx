"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CvListItem, ApplicationSummary } from '@/lib/job-offer-queries';
import { updateJobOfferStatus, updateJobOfferCv, deleteJobOffer } from '@/app/dashboard/applications/actions';
import { ExternalLink, Trash2, ArrowLeft, ArrowRight, Link as LinkIcon, Sparkles, Clock, FileText } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import AlertModal from '../ui/AlertModal';
import { Draggable } from '@hello-pangea/dnd';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ApplicationCardProps {
  offer: ApplicationSummary;
  userCvs: CvListItem[];
  onOpenDetails: (offer: ApplicationSummary) => void;
  density?: 'compact' | 'comfortable';
  index: number;
  onDelete?: (offerId: string) => void;
}

export default function ApplicationCard({
  offer,
  userCvs,
  onOpenDetails,
  density = 'compact',
  index,
  onDelete,
}: ApplicationCardProps) {
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
        return 'bg-canvas text-text-muted border-subtle';
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

  const confirmDelete = async () => {
    setIsDeleteModalOpen(false);
    // Optimistic UI update: hide card instantly
    if (onDelete) {
      onDelete(offer.id);
    }
    
    setLoading(true);
    const result = await deleteJobOffer(offer.id);
    if (!result.success) {
      alert(result.error || 'Error al eliminar');
      router.refresh();
    }
    setLoading(false);
  };

  // Estados ordenados del pipeline para controles de dirección
  const statuses = ['interested', 'applied', 'interview', 'offer', 'rejected', 'archived'];
  const statusLabels: Record<string, string> = {
    interested: t('applications.columns.interested.title'),
    applied: t('applications.columns.applied.title'),
    interview: t('applications.columns.interview.title'),
    offer: t('applications.columns.offer.title'),
    rejected: t('applications.columns.rejected.title'),
    archived: t('applications.columns.archived.title'),
  };
  const currentIndex = statuses.indexOf(offer.status);

  // Dynamic translated tooltip title
  const getMoveToTooltip = (statusKey: string) => {
    return t('applications.card.moveTo', { status: statusLabels[statusKey] });
  };

  return (
    <Draggable draggableId={offer.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => router.push(`/dashboard/applications/offer/${offer.id}`)}
          style={{
            ...provided.draggableProps.style,
          }}
          className={`bg-surface border transition-all relative group overflow-hidden cursor-grab active:cursor-grabbing hover:scale-[1.01] hover:-translate-y-0.5 select-none ${
            isCompact ? 'p-3 rounded-[12px]' : 'p-5 rounded-[12px]'
          } ${
            snapshot.isDragging 
              ? 'opacity-95 border-ai dark:border-violet-500/80 bg-white/95 dark:bg-surface-muted/95 shadow-2xl shadow-ai/10 scale-[1.02] rotate-[-0.5deg]' 
              : 'border-subtle hover:border-control dark:hover:border-white/10 shadow-sm hover:shadow-md'
          } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >          <div className={`flex items-start justify-between gap-3 ${isCompact ? 'mb-2.5' : 'mb-3'}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPlatformStyle(offer.platform)}`}>
                  {offer.platform}
                </span>

                {(offer as any).scoreOverall !== null && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0 font-sans shadow-2xs">
                    <Sparkles className="w-3 h-3 text-emerald-500 stroke-[1.75] animate-pulse" />
                    {(offer as any).scoreOverall > 5
                      ? `${(offer as any).scoreOverall.toFixed(0)}%`
                      : (offer as any).scoreOverall.toFixed(1)}
                  </span>
                )}
              </div>
              <h4 className={`font-bold text-text leading-snug group-hover:text-ai dark:group-hover:text-violet-400 transition-colors break-words font-display ${
                isCompact ? 'text-[13px] mt-1.5' : 'text-sm mt-2'
              }`}>
                {offer.title}
              </h4>
              <p className="text-text-muted text-xs font-medium mt-0.5 truncate font-sans">{offer.company}</p>
            </div>

            {offer.url && (
              <a
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-text-muted hover:text-text dark:hover:text-white p-1 rounded-[8px] transition-colors shrink-0 mt-0.5"
                title={t('applications.modal.linkCvOfficial')}
                aria-label={t('applications.modal.linkCvOfficial')}
              >
                <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
              </a>
            )}
          </div>

          {/* CV vinculado tag */}
          <div className="flex items-center justify-between gap-2 mt-2 font-display">
            {offer.cvId ? (
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-[6px] shrink-0 max-w-[65%]">
                <FileText className="w-3 h-3 stroke-[1.75]" />
                <span className="truncate">
                  {userCvs.find(cv => cv.id === offer.cvId)?.title || "CV vinculado"}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted bg-canvas/35 border border-subtle px-2 py-0.5 rounded-[6px] shrink-0">
                <FileText className="w-3 h-3 opacity-40 stroke-[1.75]" />
                <span>Sin CV vinculado</span>
              </div>
            )}

            <div className="flex items-center gap-1 text-[10px] text-text-muted font-sans font-light">
              <Clock className="w-3 h-3 stroke-[1.75]" />
              <span>{new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
            </div>
          </div>

          {/* Controles de cambio de estado y eliminación (Hover-only) */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center justify-between border-t border-subtle opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
              isCompact ? 'mt-2.5 pt-2' : 'mt-3 pt-3'
            }`}
          >
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="text-text-muted hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-[8px] hover:bg-canvas dark:hover:bg-canvas/60 transition-colors shrink-0"
                title={t('applications.card.deleteBtn')}
                aria-label={t('applications.card.deleteBtn')}
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {currentIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(statuses[currentIndex - 1]);
                  }}
                  className="bg-canvas border border-control hover:border-control dark:hover:border-white/20 text-text-muted hover:text-text dark:hover:text-white p-1.5 rounded-[8px] transition-colors"
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
                  className="bg-canvas border border-control hover:border-control dark:hover:border-white/20 text-text-muted hover:text-text dark:hover:text-white p-1.5 rounded-[8px] transition-colors"
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
            title={t('applications.card.deleteTitle')}
            message={t('applications.card.deleteMessage', { title: offer.title, company: offer.company })}
            type="danger"
            confirmLabel={t('applications.card.deleteConfirm')}
            cancelLabel={t('common.cancel')}
            onConfirm={confirmDelete}
            isPending={loading}
          />
        </div>
      )}
    </Draggable>
  );
}
