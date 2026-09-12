"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { JobOffer } from '@/db/schema';
import { CvListItem, ApplicationSummary } from '@/lib/job-offer-queries';
import { restoreArchivedJobOffer, deleteJobOffer, updateJobOfferCv, getOwnedJobOffer } from '@/app/dashboard/applications/actions';
import JobOfferDetailsModal from '@/components/applications/JobOfferDetailsModal';
import AlertModal from '@/components/ui/AlertModal';
import { formatDate } from '@/lib/utils';
import { 
  ArrowLeft, Archive, Search, SlidersHorizontal, Trash2, Eye, 
  RotateCcw, ChevronLeft, ChevronRight, Inbox, Link2, 
  ExternalLink, Calendar, Bookmark, Send, PartyPopper, Ban, 
  Sliders, ArrowUpDown, X, FileText, Sparkles, Building2
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ArchivedOffersClientProps {
  offers: ApplicationSummary[];
  userCvs: CvListItem[];
  isPremium: boolean;
}

const ARCHIVED_STATUS_PREFIX = 'archived:';

export default function ArchivedOffersClient({ offers, userCvs, isPremium }: ArchivedOffersClientProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  
  // Hydration state
  const [hasMounted, setHasMounted] = useState(false);

  // States
  const [loading, setLoading] = useState<string | null>(null); // Guardará el ID de la oferta en acción
  const [selectedOfferForDetails, setSelectedOfferForDetails] = useState<JobOffer | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleOpenDetails = async (offer: ApplicationSummary) => {
    setDetailsLoading(true);
    setSelectedOfferForDetails(null);
    try {
      const result = await getOwnedJobOffer(offer.id);
      if (result.offer) {
        setSelectedOfferForDetails(result.offer);
      }
    } finally {
      setDetailsLoading(false);
    }
  };
  const [offerToDelete, setOfferToDelete] = useState<ApplicationSummary | null>(null);

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
    interested: t('applications.columns.interested.title'),
    applied: t('applications.columns.applied.title'),
    interview: t('applications.columns.interview.title'),
    offer: t('applications.columns.offer.title'),
    rejected: t('applications.columns.rejected.title'),
  };

  const getStatusConfig = (status: string) => {
    const originalStatus = getOriginalStatus(status);
    switch (originalStatus) {
      case 'interested':
        return {
          title: t('applications.columns.interested.title'),
          style: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
          icon: <Bookmark className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'applied':
        return {
          title: t('applications.columns.applied.title'),
          style: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          icon: <Send className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'interview':
        return {
          title: t('applications.columns.interview.title'),
          style: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Calendar className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'offer':
        return {
          title: t('applications.columns.offer.title'),
          style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: <PartyPopper className="w-3 h-3 stroke-[1.75]" />,
        };
      case 'rejected':
        return {
          title: t('applications.columns.rejected.title'),
          style: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: <Ban className="w-3 h-3 stroke-[1.75]" />,
        };
      default:
        return {
          title: originalStatus,
          style: 'text-slate-400 bg-control/10 border-slate-500/20',
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
        return 'bg-canvas text-text-muted border-subtle';
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

  const handleDeleteClick = (offer: ApplicationSummary) => {
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
        <RotateCcw className="w-8 h-8 text-ai animate-spin stroke-[1.75]" />
        <p className="text-xs text-text-muted mt-3 font-sans">{t('applications.archived.loadingText')}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      
      {/* Cabecera de Página */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
        <div>
          <NextLink
            href="/dashboard/applications"
            className="inline-flex items-center gap-1.5 text-xs text-ai hover:text-ai/90 dark:hover:text-violet-300 font-bold mb-2 font-display group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 stroke-[1.75]" />
            {t('applications.archived.backBtn')}
          </NextLink>
          <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2 font-display">
            <Archive className="w-6 h-6 text-amber-500 stroke-[1.75]" />
            {t('applications.archived.title')}
          </h2>
          <p className="text-text-muted text-sm mt-1 font-sans">
            {t('applications.archived.subtitle')}
          </p>
        </div>
      </div>

      {/* Tarjetas Informativas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-display">
        <div className="rounded-[12px] border border-subtle bg-surface px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">{t('applications.archived.totalBadge')}</p>
          <p className="text-xl font-bold text-text mt-1">{offers.length}</p>
        </div>
        <div className="rounded-[12px] border border-subtle bg-surface px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">{t('applications.archived.filteredBadge')}</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-300 mt-1">{filteredOffers.length}</p>
        </div>
        <div className="rounded-[12px] border border-subtle bg-surface px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">{t('applications.archived.cvBadge')}</p>
          <p className="text-xl font-bold text-success-text mt-1">{offers.filter(o => o.cvId).length}</p>
        </div>
        <div className="rounded-[12px] border border-subtle bg-surface px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">{t('applications.archived.pageBadge')}</p>
          <p className="text-xl font-bold text-ai mt-1">{activePage} {t('applications.archived.paginationOf')} {totalPages}</p>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-surface border border-subtle rounded-[12px] p-4 md:p-5 shadow-sm space-y-4">
        
        {/* Fila 1: Buscador de texto principal */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-text-muted stroke-[1.75]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('applications.archived.searchPlaceholder')}
            className="w-full bg-canvas border border-control rounded-[8px] pl-10 pr-10 py-3 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/45 transition-colors"
              aria-label={t('applications.board.clearSearch')}
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>

        {/* Fila 2: Filtros desplegables */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          
          {/* Filtro Estado Original */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <Sliders className="w-3 h-3 stroke-[1.75]" />
              {t('applications.archived.statusLabel')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-canvas border border-control rounded-[8px] px-3 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer font-sans"
            >
              <option value="all">{t('applications.archived.statusAll')}</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Filtro CV Enlazado */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <Link2 className="w-3 h-3 stroke-[1.75]" />
              {t('applications.archived.cvLabel')}
            </label>
            <select
              value={cvFilter}
              onChange={(e) => setCvFilter(e.target.value)}
              className="w-full bg-canvas border border-control rounded-[8px] px-3 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer font-sans"
            >
              <option value="all">{t('applications.archived.cvAll')}</option>
              <option value="linked">{t('applications.archived.cvLinked')}</option>
              <option value="unlinked">{t('applications.archived.cvUnlinked')}</option>
            </select>
          </div>

          {/* Filtro Ordenar Por */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <ArrowUpDown className="w-3 h-3 stroke-[1.75]" />
              {t('applications.archived.sortLabel')}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-canvas border border-control rounded-[8px] px-3 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer font-sans"
            >
              <option value="newest">{t('applications.archived.sortNewest')}</option>
              <option value="oldest">{t('applications.archived.sortOldest')}</option>
              <option value="title_asc">{t('applications.archived.sortTitleAsc')}</option>
              <option value="company_asc">{t('applications.archived.sortCompanyAsc')}</option>
            </select>
          </div>

          {/* Filtro Elementos por Página */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <SlidersHorizontal className="w-3 h-3 stroke-[1.75]" />
              {t('applications.archived.perPageLabel')}
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="w-full bg-canvas border border-control rounded-[8px] px-3 py-2.5 text-xs text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer font-sans"
            >
              <option value={6}>6 {t('applications.board.offersCount')}</option>
              <option value={9}>9 {t('applications.board.offersCount')}</option>
              <option value={12}>12 {t('applications.board.offersCount')}</option>
              <option value={24}>24 {t('applications.board.offersCount')}</option>
            </select>
          </div>

        </div>

        {/* Indicador de filtros activos y botón de restaurar filtros */}
        {(searchQuery || statusFilter !== 'all' || cvFilter !== 'all' || sortBy !== 'newest') && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-subtle font-display">
            <span className="text-[11px] text-amber-500 font-semibold">
              {t('applications.archived.filterActiveMessage', { count: filteredOffers.length })}
            </span>
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-[8px] transition-all"
            >
              <X className="w-3 h-3 stroke-[1.75]" />
              {t('applications.archived.clearFiltersBtn')}
            </button>
          </div>
        )}
      </div>

      {/* Grilla de Ofertas Archivadas */}
      {paginatedOffers.length === 0 ? (
        /* Estado vacío */
        <div className="min-h-[400px] flex flex-col items-center justify-center text-center border-2 border-dashed border-subtle rounded-[12px] bg-surface/35 p-8">
          <Inbox className="w-10 h-10 mb-4 text-text-muted dark:text-slate-600 stroke-[1.75]" />
          <h3 className="text-base font-bold text-text font-display">
            {offers.length === 0 ? t('applications.archived.emptyTitle') : t('applications.archived.emptyTitleSearch')}
          </h3>
          <p className="text-xs text-text-muted mt-1.5 max-w-sm font-sans mx-auto leading-relaxed">
            {offers.length === 0 
              ? t('applications.archived.emptyDesc')
              : t('applications.archived.emptyDescSearch')}
          </p>
          {offers.length === 0 ? (
            <NextLink
              href="/dashboard/applications"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-[8px] bg-text dark:bg-white text-canvas font-bold text-xs shadow-sm hover:opacity-90 transition-all font-display"
            >
              {t('applications.archived.backBtn')}
            </NextLink>
          ) : (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-[8px] bg-amber-500 dark:bg-amber-500 text-white font-bold text-xs shadow-sm hover:bg-amber-600 transition-all font-display"
            >
              {t('applications.archived.emptyRestoreFiltersBtn')}
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
                onClick={() => handleOpenDetails(offer)}
                className={`bg-surface border border-subtle hover:border-control dark:hover:border-white/10 hover:shadow-md transition-all rounded-[12px] p-5 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
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
                      {t('applications.archived.cardBeforeStatus', { status: statusConfig.title })}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-text text-sm leading-snug group-hover:text-ai dark:group-hover:text-violet-400 transition-colors break-words font-display mt-2">
                      {offer.title}
                    </h4>
                    <p className="text-text-muted text-xs font-medium mt-0.5 flex items-center gap-1 font-sans">
                      <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0 stroke-[1.75]" />
                      {offer.company}
                    </p>
                  </div>
                </div>

                {/* Contenido intermedio: CV Vinculado */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="bg-canvas/45 border border-subtle rounded-[8px] flex items-center gap-2 p-2.5 my-3.5"
                >
                  <Link2 className="w-3 h-3 text-text-muted shrink-0 stroke-[1.75]" />
                  <select
                    value={offer.cvId || ''}
                    onChange={(e) => handleCvChange(offer.id, e.target.value)}
                    className="w-full bg-transparent text-[10px] text-text-muted dark:text-slate-300 font-medium focus:outline-none cursor-pointer font-sans"
                  >
                    <option value="" className="bg-canvas text-text-muted dark:text-slate-550">{t('applications.card.placeholderCv')}</option>
                    {userCvs.map((cv) => (
                      <option key={cv.id} value={cv.id} className="bg-canvas text-text">
                        {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Footer de Tarjeta con Controles */}
                <div className="flex items-center justify-between border-t border-subtle pt-3">
                  <span className="text-[10px] text-text-muted font-light font-sans">
                    {t('applications.archived.cardArchivedAt', { date: new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US') })}
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(offer)}
                      className="text-text-muted hover:text-text dark:hover:text-white p-1.5 bg-canvas/45 border border-subtle rounded-[8px] transition-all hover:shadow-xs"
                      title={t('applications.archived.cardDetailsBtn')}
                    >
                      <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(offer.id)}
                      className="inline-flex items-center gap-1 text-success-text hover:text-success-text/90 p-1.5 bg-action/10 border border-action/20 rounded-[8px] transition-all text-[11px] font-bold"
                      title={t('applications.archived.cardRestoreTitle')}
                    >
                      <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>{t('applications.archived.cardRestoreBtn')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(offer)}
                      className="text-text-muted hover:text-rose-600 dark:hover:text-rose-400 p-1.5 bg-canvas/45 border border-subtle rounded-[8px] transition-all"
                      title={t('applications.archived.cardDeleteBtn')}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-subtle pt-5 mt-6 font-display">
          
          {/* Indicador de registros */}
          <span className="text-xs text-text-muted">
            {t('applications.archived.paginationShowing', { start: startIndex + 1, end: endIndex, total: totalItems })}
          </span>

          {/* Botones de página */}
          <div className="flex items-center gap-1.5">
            
            {/* Botón Anterior */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={activePage === 1}
              className="p-2 border border-subtle rounded-[8px] text-text-muted hover:text-text dark:hover:text-white bg-surface hover:bg-canvas dark:hover:bg-canvas/45 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label={t('applications.archived.paginationPrev')}
            >
              <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
            </button>

            {/* Páginas individuales */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Lógica básica para ocultar páginas en paginación muy larga
              if (totalPages > 5 && Math.abs(page - activePage) > 1 && page !== 1 && page !== totalPages) {
                if (page === 2 || page === totalPages - 1) {
                  return <span key={page} className="text-xs text-text-muted px-1 select-none">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[32px] h-8 text-xs font-bold rounded-[8px] border transition-all ${
                    activePage === page
                      ? 'bg-text dark:bg-white border-text dark:border-white text-canvas shadow-sm'
                      : 'border-subtle bg-surface text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-canvas/45'
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
              className="p-2 border border-subtle rounded-[8px] text-text-muted hover:text-text dark:hover:text-white bg-surface hover:bg-canvas dark:hover:bg-canvas/45 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label={t('applications.archived.paginationNext')}
            >
              <ChevronRight className="w-4 h-4 stroke-[1.75]" />
            </button>

          </div>
        </div>
      )}

      {detailsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-surface px-4 py-3 text-sm text-text shadow-lg">
            {language === 'es' ? 'Cargando oferta…' : 'Loading offer…'}
          </div>
        </div>
      )}

      {selectedOfferForDetails && (
        <JobOfferDetailsModal
          isOpen={!!selectedOfferForDetails}
          onClose={() => setSelectedOfferForDetails(null)}
          offer={selectedOfferForDetails}
          userCvs={userCvs}
        />
      )}

      <AlertModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('applications.archived.deleteTitle')}
        message={t('applications.archived.deleteMessage', { title: offerToDelete?.title || '', company: offerToDelete?.company || '' })}
        type="danger"
        confirmLabel={t('applications.archived.cardDeleteBtn')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        isPending={!!(offerToDelete && loading === offerToDelete.id)}
      />

    </div>
  );
}
