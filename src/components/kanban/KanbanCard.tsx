"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobOffer, CV } from '@/db/schema';
import { updateJobOfferStatus, updateJobOfferCv, deleteJobOffer } from '@/app/dashboard/kanban/actions';
import { ExternalLink, Trash2, ArrowLeft, ArrowRight, Link as LinkIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import AlertModal from '../ui/AlertModal';
interface KanbanCardProps {
  offer: JobOffer;
  userCvs: CV[];
  onOpenDetails: (offer: JobOffer) => void;
  density?: 'compact' | 'comfortable';
}

export default function KanbanCard({ offer, userCvs, onOpenDetails, density = 'compact' }: KanbanCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedCv, setSelectedCv] = useState<string>(offer.cvId || '');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const isCompact = density === 'compact';

  // Determinar colores de plataforma
  const getPlatformStyle = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'infojobs':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'indeed':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
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
    interested: 'Interesado',
    applied: 'Postulado',
    interview: 'Entrevista',
    offer: 'Ofrecido',
    rejected: 'Rechazado',
  };
  const currentIndex = statuses.indexOf(offer.status);

  return (
    <div 
      onClick={() => onOpenDetails(offer)}
      className={`glass-card border border-slate-800 transition-all hover:border-slate-700 hover:bg-slate-900/70 relative group overflow-hidden cursor-pointer ${
        isCompact ? 'p-3 rounded-xl' : 'p-5 rounded-2xl'
      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className={`flex items-start justify-between gap-3 ${isCompact ? 'mb-2.5' : 'mb-3'}`}>
        <div className="min-w-0">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPlatformStyle(offer.platform)}`}>
            {offer.platform}
          </span>
          <h4 className={`font-bold text-white leading-snug group-hover:text-sky-400 transition-colors break-words ${
            isCompact ? 'text-[13px] mt-1.5' : 'text-sm mt-2'
          }`}>
            {offer.title}
          </h4>
          <p className="text-slate-400 text-xs font-medium mt-0.5 truncate">{offer.company}</p>
        </div>

        {offer.url && (
          <a
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-500 hover:text-white p-1 rounded-lg transition-colors shrink-0"
            title="Ver oferta original"
            aria-label="Ver oferta original"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Selector de CV Personalizado */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center gap-2 ${
          isCompact ? 'mb-2.5 p-2' : 'mb-4 p-2.5'
        }`}
      >
        <LinkIcon className="w-3 h-3 text-slate-500 shrink-0" />
        <select
          value={selectedCv}
          onChange={handleCvChange}
          className="w-full bg-transparent text-[10px] text-slate-300 font-medium focus:outline-none cursor-pointer"
        >
          <option value="" className="bg-[#030712] text-slate-500">Vincular CV...</option>
          {userCvs.map((cv) => (
            <option key={cv.id} value={cv.id} className="bg-[#030712] text-slate-300">
              {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
            </option>
          ))}
        </select>
      </div>

      {/* Controles de cambio de estado y eliminación */}
      <div className={`flex items-center justify-between border-t border-slate-800/80 ${isCompact ? 'pt-2' : 'pt-3'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors shrink-0"
            title="Eliminar candidatura"
            aria-label="Eliminar candidatura"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-500 font-light truncate">
            {formatDate(offer.updatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(statuses[currentIndex - 1]);
              }}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
              title={`Mover a ${statusLabels[statuses[currentIndex - 1]]}`}
              aria-label={`Mover a ${statusLabels[statuses[currentIndex - 1]]}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {currentIndex < statuses.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(statuses[currentIndex + 1]);
              }}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
              title={`Mover a ${statusLabels[statuses[currentIndex + 1]]}`}
              aria-label={`Mover a ${statusLabels[statuses[currentIndex + 1]]}`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Candidatura"
        message={`¿Estás seguro de que deseas eliminar la candidatura para "${offer.title}" en "${offer.company}"?

Esta acción es permanente y no se puede deshacer.`}
        type="danger"
        confirmLabel="Eliminar permanentemente"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        isPending={loading}
      />
    </div>
  );
}
