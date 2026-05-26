"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobOffer, CV } from '@/db/schema';
import KanbanCard from './KanbanCard';
import JobOfferDetailsModal from './JobOfferDetailsModal';
import { createJobOffer, restoreArchivedJobOffer } from '@/app/dashboard/kanban/actions';
import { formatDate } from '@/lib/utils';
import { Plus, X, Briefcase, Building2, Link, FileText, CheckCircle2, RefreshCw, Bookmark, Send, Calendar, PartyPopper, Ban, Search, SlidersHorizontal, Minimize2, Maximize2, Link2, ListChecks, Archive, RotateCcw, Eye, Inbox } from 'lucide-react';

interface KanbanBoardProps {
  offers: JobOffer[];
  userCvs: CV[];
}

interface Column {
  id: 'interested' | 'applied' | 'interview' | 'offer' | 'rejected';
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  borderColor: string;
  glowColor: string;
}

const ARCHIVED_STATUS_PREFIX = 'archived:';

function isArchivedStatus(status: string) {
  return status.startsWith(ARCHIVED_STATUS_PREFIX);
}

export default function KanbanBoard({ offers, userCvs }: KanbanBoardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBacklogOpen, setIsBacklogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfferForDetails, setSelectedOfferForDetails] = useState<JobOffer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [backlogSearchQuery, setBacklogSearchQuery] = useState('');
  const [cvFilter, setCvFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable'>('compact');
  const [restoringOfferId, setRestoringOfferId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    platform: 'linkedin',
    description: '',
  });

  const columns: Column[] = [
    { id: 'interested', title: 'Interesado', shortTitle: 'Interés', description: 'Por valorar', color: 'text-indigo-400 bg-indigo-500/10', borderColor: 'border-indigo-500/20', glowColor: 'rgba(99,102,241,0.15)' },
    { id: 'applied', title: 'Postulado', shortTitle: 'Postulado', description: 'Ya enviada', color: 'text-blue-400 bg-blue-500/10', borderColor: 'border-blue-500/20', glowColor: 'rgba(59,130,246,0.15)' },
    { id: 'interview', title: 'Entrevista', shortTitle: 'Entrevista', description: 'En conversación', color: 'text-amber-400 bg-amber-500/10', borderColor: 'border-amber-500/20', glowColor: 'rgba(245,158,11,0.15)' },
    { id: 'offer', title: 'Ofrecido', shortTitle: 'Oferta', description: 'Resultado positivo', color: 'text-emerald-400 bg-emerald-500/10', borderColor: 'border-emerald-500/20', glowColor: 'rgba(16,185,129,0.15)' },
    { id: 'rejected', title: 'Rechazado', shortTitle: 'Descartado', description: 'Cerradas', color: 'text-rose-400 bg-rose-500/10', borderColor: 'border-rose-500/20', glowColor: 'rgba(244,63,94,0.15)' },
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedBacklogSearch = backlogSearchQuery.trim().toLowerCase();
  const boardOffers = offers.filter((offer) => !isArchivedStatus(offer.status));
  const archivedOffers = offers.filter((offer) => isArchivedStatus(offer.status));
  const linkedOffers = boardOffers.filter((offer) => Boolean(offer.cvId)).length;
  const filteredOffers = boardOffers.filter((offer) => {
    const matchesSearch = !normalizedSearch || [offer.title, offer.company, offer.platform]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
    const matchesCvFilter =
      cvFilter === 'all' ||
      (cvFilter === 'linked' && Boolean(offer.cvId)) ||
      (cvFilter === 'unlinked' && !offer.cvId);

    return matchesSearch && matchesCvFilter;
  });
  const filteredArchivedOffers = archivedOffers.filter((offer) => {
    return !normalizedBacklogSearch || [offer.title, offer.company, offer.platform]
      .some((value) => value?.toLowerCase().includes(normalizedBacklogSearch));
  });
  const hasActiveFilters = Boolean(normalizedSearch) || cvFilter !== 'all';

  const getOriginalStatusLabel = (status: string) => {
    const originalStatus = status.startsWith(ARCHIVED_STATUS_PREFIX)
      ? status.slice(ARCHIVED_STATUS_PREFIX.length)
      : status;
    return columns.find((column) => column.id === originalStatus)?.title || 'Interesado';
  };

  const handleRestoreArchivedOffer = async (offerId: string) => {
    setRestoringOfferId(offerId);
    const result = await restoreArchivedJobOffer(offerId);
    if (result.success) {
      router.refresh();
    }
    setRestoringOfferId(null);
  };

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
      default:
        return null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.company) {
      setError('El puesto y la empresa son campos obligatorios.');
      return;
    }

    setLoading(true);
    const result = await createJobOffer(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsModalOpen(false);
      setFormData({
        title: '',
        company: '',
        url: '',
        platform: 'linkedin',
        description: '',
      });
      router.refresh();
    }
  };

  return (
    <div className="w-full">
      {/* Cabecera del Tablero */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-[#1e1b4b] dark:text-white tracking-tight flex items-center gap-2 font-display">
            <Briefcase className="w-6 h-6 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
            Embudo de Candidaturas
          </h2>
          <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-sm mt-1 font-sans">
            Gestiona tus ofertas por etapa y encuentra rápido la candidatura que necesitas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto font-display">
          <button
            onClick={() => setIsBacklogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-[8px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 hover:border-amber-500/30 text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white font-semibold text-sm transition-all shadow-sm"
          >
            <Archive className="w-4 h-4 text-amber-500 stroke-[1.75]" />
            Backlog archivadas
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-200 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {archivedOffers.length}
            </span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0b0f19] font-semibold text-sm shadow-sm transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[1.75]" />
            Nueva Candidatura
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 font-display">
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Activas</p>
          <p className="text-xl font-bold text-[#1e1b4b] dark:text-white mt-1">{boardOffers.length}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Archivadas</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-300 mt-1">{archivedOffers.length}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Con CV</p>
          <p className="text-xl font-bold text-[#2ecc71] mt-1">{linkedOffers}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Mostrando</p>
          <p className="text-xl font-bold text-[#1e1b4b] dark:text-white mt-1">{filteredOffers.length}</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por puesto, empresa o plataforma"
            className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] pl-10 pr-10 py-3 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-[#1e1b4b]/40 dark:text-slate-500 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#1f2937] transition-colors"
              aria-label="Limpiar búsqueda"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex items-center gap-1 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 bg-white dark:bg-[#1f2937] p-1 shadow-sm font-display">
            <SlidersHorizontal className="w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-500 ml-2 hidden sm:block stroke-[1.75]" />
            {[
              { value: 'all', label: 'Todas' },
              { value: 'linked', label: 'Con CV' },
              { value: 'unlinked', label: 'Sin CV' },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCvFilter(filter.value as 'all' | 'linked' | 'unlinked')}
                className={`px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                  cvFilter === filter.value
                    ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] shadow-sm'
                    : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 bg-white dark:bg-[#1f2937] p-1 shadow-sm font-display">
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                viewMode === 'compact'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              Compacta
            </button>
            <button
              type="button"
              onClick={() => setViewMode('comfortable')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                viewMode === 'comfortable'
                  ? 'bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] shadow-sm'
                  : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
              Cómoda
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Columnas (Kanban) */}
      <div className="-mx-4 px-4 overflow-x-auto pb-4 scrollbar-custom">
        <div className="grid min-w-[1180px] grid-cols-5 gap-4 items-start">
          {columns.map((column) => {
            const rawColumnOffers = boardOffers.filter((offer) => offer.status === column.id);
            const columnOffers = filteredOffers.filter((offer) => offer.status === column.id);

            return (
              <div
                key={column.id}
                aria-label={`Columna ${column.title}`}
                className={`flex h-[calc(100vh-330px)] min-h-[520px] max-h-[760px] flex-col bg-white dark:bg-[#1f2937] rounded-[12px] border ${column.borderColor} relative overflow-hidden shadow-sm hover:shadow-md transition-all`}
              >
                {/* Cabecera de la columna */}
                <div className="shrink-0 p-3.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/5 bg-[#fafafa] dark:bg-[#0b0f19]/45">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${column.color}`}>
                        {renderColumnIcon(column.id)}
                        {column.shortTitle}
                      </span>
                      <p className="text-[11px] text-[#1e1b4b]/50 dark:text-slate-400 mt-2 truncate font-sans">{column.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 font-display">
                      <span className="text-sm font-bold text-[#1e1b4b] dark:text-white bg-white dark:bg-[#0b0f19] px-2.5 py-1 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 shadow-sm">
                        {hasActiveFilters && rawColumnOffers.length > 0 ? `${columnOffers.length}/${rawColumnOffers.length}` : rawColumnOffers.length}
                      </span>
                      <span className="text-[10px] font-medium text-[#1e1b4b]/40 dark:text-slate-500">
                        ofertas
                      </span>
                    </div>
                  </div>
                  {rawColumnOffers.length > 0 && (
                    <div className="mt-3 h-1.5 rounded-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${column.color.split(' ')[1]}`}
                        style={{
                          width: `${Math.max(8, Math.round((columnOffers.length / rawColumnOffers.length) * 100))}%`,
                          opacity: hasActiveFilters ? 0.8 : 1,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Lista de tarjetas */}
                <div className={`flex-1 overflow-y-auto scrollbar-custom p-3 pr-2 ${viewMode === 'compact' ? 'space-y-2.5' : 'space-y-4'}`}>
                  {columnOffers.length === 0 ? (
                    <div className="h-full min-h-[260px] flex flex-col items-center justify-center border-2 border-dashed border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-6 text-center text-[#1e1b4b]/40 dark:text-slate-500">
                      {hasActiveFilters ? (
                        <>
                          <Search className="w-6 h-6 mb-2 text-[#1e1b4b]/30 dark:text-slate-600 opacity-70 stroke-[1.75]" />
                          <p className="text-[11px] font-bold uppercase tracking-wider font-display">Sin resultados</p>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-6 h-6 mb-2 text-[#1e1b4b]/30 dark:text-slate-600 opacity-60 stroke-[1.75]" />
                          <p className="text-[11px] font-bold uppercase tracking-wider font-display">Vacío</p>
                        </>
                      )}
                    </div>
                  ) : (
                    columnOffers.map((offer) => (
                      <KanbanCard
                        key={offer.id}
                        offer={offer}
                        userCvs={userCvs}
                        onOpenDetails={setSelectedOfferForDetails}
                        density={viewMode}
                      />
                    ))
                  )}
                </div>

                <div className="shrink-0 border-t border-[#1e1b4b]/10 dark:border-white/5 bg-[#fafafa] dark:bg-[#0b0f19]/45 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 font-sans">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <ListChecks className="w-3.5 h-3.5 shrink-0 stroke-[1.75]" />
                      <span className="truncate">{columnOffers.length} visibles</span>
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

      {/* Backlog de candidaturas archivadas */}
      {isBacklogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="relative w-full max-w-4xl max-h-[88vh] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] shadow-2xl overflow-hidden flex flex-col">
            <div className="shrink-0 p-5 md:p-6 border-b border-[#1e1b4b]/10 dark:border-white/5 bg-[#fafafa] dark:bg-[#0b0f19]/35">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 font-display">
                    <Archive className="w-5 h-5 text-amber-500 stroke-[1.75]" />
                    Backlog de Archivadas
                  </h3>
                  <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">
                    Revisa candidaturas retiradas del tablero activo y rescátalas cuando vuelvan a interesarte.
                  </p>
                </div>
                <button
                  onClick={() => setIsBacklogOpen(false)}
                  className="text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-[8px] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-all"
                  aria-label="Cerrar backlog"
                  title="Cerrar backlog"
                >
                  <X className="w-5 h-5 stroke-[1.75]" />
                </button>
              </div>

              <div className="relative mt-5">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75]" />
                <input
                  type="search"
                  value={backlogSearchQuery}
                  onChange={(event) => setBacklogSearchQuery(event.target.value)}
                  placeholder="Buscar archivadas por puesto, empresa o plataforma"
                  className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] pl-10 pr-10 py-3 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all font-sans"
                />
                {backlogSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBacklogSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-[#1e1b4b]/40 dark:text-slate-500 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-colors"
                    aria-label="Limpiar búsqueda de archivadas"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-custom p-4 md:p-6">
              {archivedOffers.length === 0 ? (
                <div className="min-h-[320px] flex flex-col items-center justify-center text-center border-2 border-dashed border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] text-[#1e1b4b]/40 dark:text-slate-500">
                  <Inbox className="w-8 h-8 mb-3 text-[#1e1b4b]/30 dark:text-slate-600 stroke-[1.75]" />
                  <p className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">No hay postulaciones archivadas</p>
                  <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">Cuando archives una candidatura, aparecerá aquí.</p>
                </div>
              ) : filteredArchivedOffers.length === 0 ? (
                <div className="min-h-[320px] flex flex-col items-center justify-center text-center border-2 border-dashed border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] text-[#1e1b4b]/40 dark:text-slate-500">
                  <Search className="w-8 h-8 mb-3 text-[#1e1b4b]/30 dark:text-slate-600 stroke-[1.75]" />
                  <p className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">Sin resultados</p>
                  <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">Prueba con otro puesto, empresa o plataforma.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArchivedOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-[#fafafa] dark:bg-[#0b0f19]/45 p-4 hover:border-[#1e1b4b]/20 dark:hover:border-white/10 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2 font-display">
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20">
                              Archivada
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-[#1e1b4b]/5 dark:bg-white/5 text-[#1e1b4b]/70 dark:text-slate-350 border-[#1e1b4b]/10 dark:border-white/10">
                              Antes: {getOriginalStatusLabel(offer.status)}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b]/50 dark:text-slate-400 border border-[#1e1b4b]/10 dark:border-white/10">
                              {offer.platform}
                            </span>
                          </div>
                          <h4 className="font-bold text-[#1e1b4b] dark:text-white text-sm leading-snug truncate font-display">{offer.title}</h4>
                          <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-0.5 truncate font-sans">{offer.company}</p>
                          <p className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-500 mt-2 font-sans">Archivada: {formatDate(offer.updatedAt)}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 font-display">
                          <button
                            type="button"
                            onClick={() => setSelectedOfferForDetails(offer)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/75 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white text-xs font-bold transition-all shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
                            Ver
                          </button>
                          <button
                            type="button"
                            disabled={restoringOfferId === offer.id}
                            onClick={() => handleRestoreArchivedOffer(offer.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-[#2ecc71]/10 border border-[#2ecc71]/20 hover:border-[#2ecc71]/40 text-[#2ecc71] hover:text-[#2ecc71]/90 text-xs font-bold transition-all disabled:opacity-50"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${restoringOfferId === offer.id ? 'animate-spin' : ''} stroke-[1.75]`} />
                            Rescatar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Premium para crear Candidatura */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-6 md:p-8 shadow-2xl overflow-hidden">
            
            {/* Adornos visuales */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 font-display">
                  <Briefcase className="w-5 h-5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                  Agregar Candidatura
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">
                  Registra los datos de la oferta. Luego podrás optimizar tu CV para este puesto.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-1 rounded-[8px] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-all"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-455 text-xs rounded-[8px] font-medium font-sans">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                    <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    Puesto *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Ej. Senior React Developer"
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                    <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    Empresa *
                  </label>
                  <input
                    type="text"
                    name="company"
                    required
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Ej. Stripe"
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                    <Link className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    Enlace de la Oferta
                  </label>
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">Plataforma</label>
                  <select
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="infojobs">InfoJobs</option>
                    <option value="indeed">Indeed</option>
                    <option value="other">Otra</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">
                  Descripción / Requisitos de la Oferta (Opcional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Pega aquí la descripción del puesto. El motor de IA comparará esta descripción con tu CV para optimizarlo y adaptarlo a la oferta."
                  className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all resize-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5 font-display">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 dark:text-[#0b0f19] rounded-[8px] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Candidatura'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedOfferForDetails && (
        <JobOfferDetailsModal
          isOpen={!!selectedOfferForDetails}
          onClose={() => setSelectedOfferForDetails(null)}
          offer={offers.find(o => o.id === selectedOfferForDetails.id) || selectedOfferForDetails}
          userCvs={userCvs}
        />
      )}
    </div>
  );
}
