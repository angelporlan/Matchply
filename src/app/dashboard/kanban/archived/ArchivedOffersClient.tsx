"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { JobOffer, CV } from '@/db/schema';
import { restoreArchivedJobOffer, deleteJobOffer, updateJobOfferCv } from '@/app/dashboard/kanban/actions';
import JobOfferDetailsModal from '@/components/kanban/JobOfferDetailsModal';
import AlertModal from '@/components/ui/AlertModal';
import { formatDate } from '@/lib/utils';
import { 
  ArrowLeft, Archive, Search, SlidersHorizontal, Trash2, Eye, 
  RotateCcw, ChevronLeft, ChevronRight, Inbox, Link2, 
  ExternalLink, Calendar, Bookmark, Send, PartyPopper, Ban, 
  Sliders, ArrowUpDown, X, FileText, Sparkles, Building2
} from 'lucide-react';

interface ArchivedOffersClientProps {
  offers: JobOffer[];
  userCvs: CV[];
  isPremium: boolean;
}

const ARCHIVED_STATUS_PREFIX = 'archived:';

export default function ArchivedOffersClient({ offers, userCvs, isPremium }: ArchivedOffersClientProps) {
  const router = useRouter();
  
  // Hydration state
  const [hasMounted, setHasMounted] = useState(false);

  // States
  const [loading, setLoading] = useState<string | null>(null); // Guardará el ID de la oferta en acción
  const [selectedOfferForDetails, setSelectedOfferForDetails] = useState<JobOffer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<JobOffer | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cvFilter, setCvFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Helpers
  const getOriginalStatus = (status: string) => {
    if (status.startsWith(ARCHIVED_STATUS_PREFIX)) {
      return status.slice(ARCHIVED_STATUS_PREFIX.length);
    }
    return status;
  };

  const statusLabels: Record<string, string> = {
    interested: 'Interesado',
    applied: 'Postulado',
    interview: 'Entrevista',
    offer: 'Ofrecido',
    rejected: 'Rechazado',
  };

  const getStatusConfig = (status: string) => {
    const originalStatus = getOriginalStatus(status);
    switch (originalStatus) {
      case 'interested':
        return {
          title: 'Interesado',
          style: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
          icon: <Bookmark className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'applied':
        return {
          title: 'Postulado',
          style: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          icon: <Send className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'interview':
        return {
          title: 'Entrevista',
          style: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Calendar className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'offer':
        return {
          title: 'Ofrecido',
          style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: <PartyPopper className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'rejected':
        return {
          title: 'Descartado',
          style: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: <Ban className="w-3 h-3 stroke-[1.75]" />,
        };
      default:
        return {
          title: originalStatus,
          style: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
          icon: <Archive className="w-3 h-3 stroke-[1.75]" />,
        };
    }
  };

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

  // Actions
  const handleRestore = async (offerId: string) => {
    setLoading(offerId);
    const result = await restoreArchivedJobOffer(offerId);
    if (result.success) {
      router.refresh();
    }
    setLoading(null);
  };

  const handleDeleteClick = (offer: JobOffer) => {
    setOfferToDelete(offer);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!offerToDelete) return;
    setIsDeleteModalOpen(false);
    setLoading(offerToDelete.id);
    const result = await deleteJobOffer(offerToDelete.id);
    if (result.success) {
      router.refresh();
    }
    setLoading(null);
    setOfferToDelete(null);
  };

  const handleCvChange = async (offerId: string, cvId: string | null) => {
    setLoading(offerId);
    const result = await updateJobOfferCv(offerId, cvId === '' ? null : cvId);
    if (result.success) {
      router.refresh();
    }
    setLoading(null);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCvFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  // Filters logic
  const filteredOffers = offers.filter((offer) => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch = !normalizedSearch || [offer.title, offer.company, offer.platform]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));

    const originalStatus = getOriginalStatus(offer.status);
    const matchesStatus = statusFilter === 'all' || originalStatus === statusFilter;

    const matchesCv = cvFilter === 'all' ||
      (cvFilter === 'linked' && Boolean(offer.cvId)) ||
      (cvFilter === 'unlinked' && !offer.cvId);

    return matchesSearch && matchesStatus && matchesCv;
  });

  // Sorting logic
  const sortedOffers = [...filteredOffers].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    if (sortBy === 'title_asc') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'company_asc') {
      return a.company.localeCompare(b.company);
    }
    return 0;
  });

  // Pagination logic
  const totalItems = sortedOffers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedOffers = sortedOffers.slice(startIndex, endIndex);

  // Set page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, cvFilter, sortBy, itemsPerPage]);

  if (!hasMounted) {
    return (
      <div className="w-full min-h-[500px] flex flex-col items-center justify-center py-20 font-display">
        <RotateCcw className="w-8 h-8 text-[#8b5cf6] animate-spin stroke-[1.75]" />
        <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-3 font-sans">Cargando ofertas archivadas...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      
      {/* Cabecera de Página */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
        <div>
          <NextLink
            href="/dashboard/kanban"
            className="inline-flex items-center gap-1.5 text-xs text-[#8b5cf6] dark:text-violet-400 hover:text-[#8b5cf6]/90 dark:hover:text-violet-300 font-bold mb-2 font-display group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 stroke-[1.75]" />
            Volver al embudo activo
          </NextLink>
          <h2 className="text-2xl font-bold text-[#1e1b4b] dark:text-white tracking-tight flex items-center gap-2 font-display">
            <Archive className="w-6 h-6 text-amber-500 stroke-[1.75]" />
            Candidaturas Archivadas
          </h2>
          <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-sm mt-1 font-sans">
            Visualiza y filtra todas las ofertas que retiraste del embudo Kanban. Puedes rescatarlas en cualquier momento.
          </p>
        </div>
      </div>

      {/* Tarjetas Informativas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-display">
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Total Archivadas</p>
          <p className="text-xl font-bold text-[#1e1b4b] dark:text-white mt-1">{offers.length}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Filtradas</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-300 mt-1">{filteredOffers.length}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Con CV Enlazado</p>
          <p className="text-xl font-bold text-[#2ecc71] mt-1">{offers.filter(o => o.cvId).length}</p>
        </div>
        <div className="rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 bg-white dark:bg-[#1f2937] px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#1e1b4b]/40 dark:text-slate-500 font-bold">Página Actual</p>
          <p className="text-xl font-bold text-[#8b5cf6] mt-1">{activePage} de {totalPages}</p>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-4 md:p-5 shadow-sm space-y-4">
        
        {/* Fila 1: Buscador de texto principal */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar archivadas por puesto, empresa o plataforma de publicación"
            className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] pl-10 pr-10 py-3 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-[#1e1b4b]/40 dark:text-slate-500 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>

        {/* Fila 2: Filtros desplegables */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          
          {/* Filtro Estado Original */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Sliders className="w-3 h-3 stroke-[1.75]" />
              Estado Original
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-2.5 text-xs text-[#1e1b4b] dark:text-slate-300 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
            >
              <option value="all">Todos los estados</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Filtro CV Enlazado */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Link2 className="w-3 h-3 stroke-[1.75]" />
              CV Vinculado
            </label>
            <select
              value={cvFilter}
              onChange={(e) => setCvFilter(e.target.value)}
              className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-2.5 text-xs text-[#1e1b4b] dark:text-slate-300 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
            >
              <option value="all">Todos</option>
              <option value="linked">Con CV vinculado</option>
              <option value="unlinked">Sin CV vinculado</option>
            </select>
          </div>

          {/* Filtro Ordenar Por */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <ArrowUpDown className="w-3 h-3 stroke-[1.75]" />
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-2.5 text-xs text-[#1e1b4b] dark:text-slate-300 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
            >
              <option value="newest">Archivado recientemente</option>
              <option value="oldest">Archivado antiguo</option>
              <option value="title_asc">Puesto (A-Z)</option>
              <option value="company_asc">Empresa (A-Z)</option>
            </select>
          </div>

          {/* Filtro Elementos por Página */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#1e1b4b]/50 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <SlidersHorizontal className="w-3 h-3 stroke-[1.75]" />
              Ofertas por página
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-2.5 text-xs text-[#1e1b4b] dark:text-slate-300 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
            >
              <option value={6}>6 por página</option>
              <option value={9}>9 por página</option>
              <option value={12}>12 por página</option>
              <option value={24}>24 por página</option>
            </select>
          </div>

        </div>

        {/* Indicador de filtros activos y botón de restaurar filtros */}
        {(searchQuery || statusFilter !== 'all' || cvFilter !== 'all' || sortBy !== 'newest') && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1e1b4b]/10 dark:border-white/5 font-display">
            <span className="text-[11px] text-amber-500 font-semibold">
              Filtros activos reducen las ofertas archivadas a {filteredOffers.length} visibles.
            </span>
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-[8px] transition-all"
            >
              <X className="w-3 h-3 stroke-[1.75]" />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Grilla de Ofertas Archivadas */}
      {paginatedOffers.length === 0 ? (
        /* Estado vacío */
        <div className="min-h-[400px] flex flex-col items-center justify-center text-center border-2 border-dashed border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] bg-white dark:bg-[#1f2937]/35 p-8">
          <Inbox className="w-10 h-10 mb-4 text-[#1e1b4b]/30 dark:text-slate-600 stroke-[1.75]" />
          <h3 className="text-base font-bold text-[#1e1b4b] dark:text-white font-display">
            {offers.length === 0 ? 'No tienes candidaturas archivadas' : 'No se encontraron ofertas archivadas'}
          </h3>
          <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1.5 max-w-sm font-sans mx-auto leading-relaxed">
            {offers.length === 0 
              ? 'Cuando archives una candidatura desde el tablero Kanban principal, aparecerá en esta página especial.'
              : 'Intenta modificar el término de búsqueda o desactivar alguno de los filtros aplicados para encontrar lo que buscas.'}
          </p>
          {offers.length === 0 ? (
            <NextLink
              href="/dashboard/kanban"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-[8px] bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] font-bold text-xs shadow-sm hover:opacity-90 transition-all font-display"
            >
              Ir al embudo activo
            </NextLink>
          ) : (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-[8px] bg-amber-500 dark:bg-amber-500 text-white font-bold text-xs shadow-sm hover:bg-amber-600 transition-all font-display"
            >
              Reestablecer Filtros
            </button>
          )}
        </div>
      ) : (
        /* Grilla activa */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedOffers.map((offer) => {
            const statusConfig = getStatusConfig(offer.status);
            const isOfferLoading = loading === offer.id;

            return (
              <div
                key={offer.id}
                onClick={() => setSelectedOfferForDetails(offer)}
                className={`bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 hover:border-[#1e1b4b]/20 dark:hover:border-white/10 hover:shadow-md transition-all rounded-[12px] p-5 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
                  isOfferLoading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Cabecera de tarjeta */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-display">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPlatformStyle(offer.platform)}`}>
                      {offer.platform}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusConfig.style}`}>
                      {statusConfig.icon}
                      Antes: {statusConfig.title}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-[#1e1b4b] dark:text-white text-sm leading-snug group-hover:text-[#8b5cf6] dark:group-hover:text-violet-400 transition-colors break-words font-display mt-2">
                      {offer.title}
                    </h4>
                    <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium mt-0.5 flex items-center gap-1 font-sans">
                      <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/30 shrink-0 stroke-[1.75]" />
                      {offer.company}
                    </p>
                  </div>
                </div>

                {/* Contenido intermedio: CV Vinculado */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[8px] flex items-center gap-2 p-2.5 my-3.5"
                >
                  <Link2 className="w-3 h-3 text-[#1e1b4b]/40 dark:text-slate-500 shrink-0 stroke-[1.75]" />
                  <select
                    value={offer.cvId || ''}
                    onChange={(e) => handleCvChange(offer.id, e.target.value)}
                    className="w-full bg-transparent text-[10px] text-[#1e1b4b]/80 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b]/45 dark:text-slate-500">Vincular CV...</option>
                    {userCvs.map((cv) => (
                      <option key={cv.id} value={cv.id} className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b] dark:text-slate-300">
                        {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Footer de Tarjeta con Controles */}
                <div className="flex items-center justify-between border-t border-[#1e1b4b]/10 dark:border-white/5 pt-3">
                  <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 font-light font-sans">
                    Archivado: {formatDate(offer.updatedAt)}
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedOfferForDetails(offer)}
                      className="text-[#1e1b4b]/50 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-1.5 bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] transition-all hover:shadow-xs"
                      title="Ver detalles completos"
                    >
                      <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(offer.id)}
                      className="inline-flex items-center gap-1 text-[#2ecc71] hover:text-[#2ecc71]/90 p-1.5 bg-[#2ecc71]/10 border border-[#2ecc71]/20 rounded-[8px] transition-all text-[11px] font-bold"
                      title="Rescatar y devolver al embudo activo"
                    >
                      <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>Rescatar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(offer)}
                      className="text-[#1e1b4b]/40 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] transition-all"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Controles de Paginación */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#1e1b4b]/10 dark:border-white/5 pt-5 mt-6 font-display">
          
          {/* Indicador de registros */}
          <span className="text-xs text-[#1e1b4b]/60 dark:text-slate-400">
            Mostrando <span className="font-bold text-[#1e1b4b] dark:text-white">{startIndex + 1}</span> a{' '}
            <span className="font-bold text-[#1e1b4b] dark:text-white">{endIndex}</span> de{' '}
            <span className="font-bold text-[#1e1b4b] dark:text-white">{totalItems}</span> candidaturas archivadas
          </span>

          {/* Botones de página */}
          <div className="flex items-center gap-1.5">
            
            {/* Botón Anterior */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={activePage === 1}
              className="p-2 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
            </button>

            {/* Páginas individuales */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Lógica básica para ocultar páginas en paginación muy larga
              if (totalPages > 5 && Math.abs(page - activePage) > 1 && page !== 1 && page !== totalPages) {
                if (page === 2 || page === totalPages - 1) {
                  return <span key={page} className="text-xs text-[#1e1b4b]/40 px-1 select-none">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[32px] h-8 text-xs font-bold rounded-[8px] border transition-all ${
                    activePage === page
                      ? 'bg-[#1e1b4b] dark:bg-white border-[#1e1b4b] dark:border-white text-white dark:text-[#0b0f19] shadow-sm'
                      : 'border-[#1e1b4b]/10 dark:border-white/10 bg-white dark:bg-[#1f2937] text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            {/* Botón Siguiente */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={activePage === totalPages}
              className="p-2 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white bg-white dark:bg-[#1f2937] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Página siguiente"
            >
              <ChevronRight className="w-4 h-4 stroke-[1.75]" />
            </button>

          </div>
        </div>
      )}

      {/* Modales de Detalles y Confirmación */}
      {selectedOfferForDetails && (
        <JobOfferDetailsModal
          isOpen={!!selectedOfferForDetails}
          onClose={() => setSelectedOfferForDetails(null)}
          offer={offers.find(o => o.id === selectedOfferForDetails.id) || selectedOfferForDetails}
          userCvs={userCvs}
        />
      )}

      <AlertModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Candidatura"
        message={`¿Estás seguro de que deseas eliminar permanentemente la candidatura para "${offerToDelete?.title}" de la empresa "${offerToDelete?.company}"?

Esta acción eliminará el registro de forma permanente de tu historial y no se puede deshacer.`}
        type="danger"
        confirmLabel="Eliminar permanentemente"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        isPending={!!(offerToDelete && loading === offerToDelete.id)}
      />

    </div>
  );
}
