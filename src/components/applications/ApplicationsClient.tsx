"use client";

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { JobOffer } from '@/db/schema';
import { CvListItem, ApplicationSummary } from '@/lib/job-offer-queries';
import CurateWithAiModal from './CurateWithAiModal';
import JobOfferDetailsModal from './JobOfferDetailsModal';
import ApplicationsTable from './ApplicationsTable';
import ApplicationViewsMenu, { type ApplicationViewOption } from './ApplicationViewsMenu';
import ApplicationColumnsMenu from './ApplicationColumnsMenu';
import AlertModal from '@/components/ui/AlertModal';
import { createJobOffer, updateJobOfferStatus, deleteJobOffer, getOwnedJobOffer } from '@/app/dashboard/applications/actions';
import { createApplicationView, deleteApplicationView, setDefaultApplicationView, updateApplicationView } from '@/app/dashboard/applications/view-actions';
import {
  DEFAULT_VIEW_CONFIG,
  SYSTEM_VIEWS,
  filterApplications,
  normalizeViewConfig,
  paginate,
  sortApplications,
  type ApplicationColumnFilter,
  type ApplicationColumnId,
  type ApplicationColumnWidth,
  type ApplicationColumnWidths,
  type ApplicationGrouping,
  type ApplicationSortDirection,
  type ApplicationSortKey,
  type ApplicationSortState,
  type ApplicationStatus,
  type ApplicationViewConfig,
  type ApplicationViewFilters,
} from '@/lib/application-views';
import { Plus, X, Briefcase, Building2, Link, FileText, CheckCircle2, RefreshCw, Search, Minimize2, Maximize2, Columns3, Table2, SquareKanban, ChevronLeft, ChevronRight, Trash2, CalendarClock, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const ApplicationsBoardView = dynamic(() => import('./ApplicationsBoardView'), { ssr: false });

interface SavedApplicationView {
  id: string;
  name: string;
  isDefault: boolean;
  config: ApplicationViewConfig;
}

type BoardColumnId = 'interested' | 'applied' | 'interview' | 'offer' | 'rejected' | 'archived';

interface ApplicationsClientProps {
  offers: ApplicationSummary[];
  userCvs: CvListItem[];
  savedViews: SavedApplicationView[];
  initialLayout: 'table' | 'board';
  initialViewId: string;
}

export default function ApplicationsClient({
  offers,
  userCvs,
  savedViews: initialSavedViews,
  initialLayout,
  initialViewId,
}: ApplicationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();

  const initialConfig = (() => {
    const saved = initialSavedViews.find((view) => view.id === initialViewId);
    if (saved) return saved.config;
    const system = SYSTEM_VIEWS.find((view) => view.id === initialViewId);
    return system ? system.config : DEFAULT_VIEW_CONFIG;
  })();

  const [savedViews, setSavedViews] = useState<SavedApplicationView[]>(initialSavedViews);
  const [layout, setLayout] = useState<'table' | 'board'>(initialLayout);
  const [activeViewId, setActiveViewId] = useState(initialViewId);
  const [columns, setColumns] = useState<ApplicationColumnId[]>(initialConfig.columns);
  const [sort, setSort] = useState<ApplicationSortState>(initialConfig.sort);
  const [grouping, setGrouping] = useState<ApplicationGrouping | null>(initialConfig.grouping);
  const [columnFilters, setColumnFilters] = useState<ApplicationColumnFilter[]>(initialConfig.filters.columnFilters ?? []);
  const [columnWidths, setColumnWidths] = useState<ApplicationColumnWidths>(initialConfig.columnWidths);
  const [actionsIndex, setActionsIndex] = useState<number | null>(initialConfig.actionsIndex);
  const [pageSize, setPageSize] = useState(initialConfig.pageSize);
  const [statusFilter, setStatusFilter] = useState<string>(initialConfig.filters.status || 'all');
  const [excludedStatuses, setExcludedStatuses] = useState<ApplicationStatus[]>(initialConfig.filters.excludedStatuses ?? []);
  const [followupFilter, setFollowupFilter] = useState<'all' | 'withDate' | 'overdue'>(initialConfig.filters.followup || 'all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [isSavingView, setIsSavingView] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<ApplicationSummary | null>(null);
  const [isDeletingOffer, setIsDeletingOffer] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfferForDetails, setSelectedOfferForDetails] = useState<JobOffer | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialConfig.filters.search || '');
  const [cvFilter, setCvFilter] = useState<'all' | 'linked' | 'unlinked'>(initialConfig.filters.cv || 'all');
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable'>('compact');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'custom'>(initialConfig.filters.date || 'all');
  const [startDate, setStartDate] = useState(initialConfig.filters.startDate || '');
  const [endDate, setEndDate] = useState(initialConfig.filters.endDate || '');
  const [isCurateModalOpen, setIsCurateModalOpen] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [curateTargetOffers, setCurateTargetOffers] = useState<ApplicationSummary[] | null>(null);
  const [interestedSortMode, setInterestedSortMode] = useState<'score' | 'date'>('score');
  const [curationToast, setCurationToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);


  // Vistas guardadas, columnas y orden de la tabla
  const viewOptions = useMemo<ApplicationViewOption[]>(() => [
    ...SYSTEM_VIEWS.map((view) => ({ id: view.id, name: t(view.nameKey), isDefault: false, isSystem: true })),
    ...savedViews.map((view) => ({ id: view.id, name: view.name, isDefault: view.isDefault, isSystem: false })),
  ], [savedViews, t]);

  const activeViewConfig = useMemo<ApplicationViewConfig>(() => {
    const system = SYSTEM_VIEWS.find((view) => view.id === activeViewId);
    if (system) return system.config;
    return savedViews.find((view) => view.id === activeViewId)?.config || DEFAULT_VIEW_CONFIG;
  }, [activeViewId, savedViews]);

  const activeViewOption = viewOptions.find((view) => view.id === activeViewId);

  const viewFilters = useMemo<ApplicationViewFilters>(() => ({
    search: searchQuery,
    status: statusFilter,
    cv: cvFilter,
    date: dateFilter,
    startDate,
    endDate,
    followup: followupFilter,
    columnFilters,
    excludedStatuses,
  }), [searchQuery, statusFilter, cvFilter, dateFilter, startDate, endDate, followupFilter, columnFilters, excludedStatuses]);

  const currentConfig = useMemo<ApplicationViewConfig>(() => normalizeViewConfig({
    columns,
    filters: viewFilters,
    sort,
    pageSize,
    grouping,
    columnWidths,
    actionsIndex,
  }), [columns, viewFilters, sort, pageSize, grouping, columnWidths, actionsIndex]);

  const isDirty = useMemo(
    () => JSON.stringify(currentConfig) !== JSON.stringify(normalizeViewConfig(activeViewConfig)),
    [currentConfig, activeViewConfig],
  );

  const resetPageAndSelection = () => {
    setPage(1);
    setSelectedIds(new Set());
  };

  const applyViewConfig = (viewConfig: ApplicationViewConfig) => {
    const normalized = normalizeViewConfig(viewConfig);
    setColumns(normalized.columns);
    setSort(normalized.sort);
    setGrouping(normalized.grouping);
    setColumnFilters(normalized.filters.columnFilters ?? []);
    setColumnWidths(normalized.columnWidths);
    setActionsIndex(normalized.actionsIndex);
    setPageSize(normalized.pageSize);
    setStatusFilter(normalized.filters.status || 'all');
    setExcludedStatuses(normalized.filters.excludedStatuses ?? []);
    setFollowupFilter(normalized.filters.followup || 'all');
    setSearchQuery(normalized.filters.search || '');
    setCvFilter(normalized.filters.cv || 'all');
    setDateFilter(normalized.filters.date || 'all');
    setStartDate(normalized.filters.startDate || '');
    setEndDate(normalized.filters.endDate || '');
    resetPageAndSelection();
  };

  const syncUrl = (patch: { layout?: 'table' | 'board'; view?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (patch.layout) params.set('layout', patch.layout);
    if (patch.view) params.set('view', patch.view);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleLayoutChange = (next: 'table' | 'board') => {
    setLayout(next);
    try {
      window.localStorage.setItem('applications.layout', next);
    } catch {}
    syncUrl({ layout: next });
  };

  const handleSelectView = (id: string, sync = true) => {
    const system = SYSTEM_VIEWS.find((view) => view.id === id);
    const saved = savedViews.find((view) => view.id === id);
    const viewConfig = system?.config || saved?.config;
    if (!viewConfig) return;
    applyViewConfig(viewConfig);
    setActiveViewId(id);
    if (sync) syncUrl({ view: id });
  };

  useEffect(() => {
    const urlLayout = searchParams.get('layout');
    if ((urlLayout === 'table' || urlLayout === 'board') && urlLayout !== layout) {
      setLayout(urlLayout);
    }
    const urlView = searchParams.get('view');
    if (urlView && urlView !== activeViewId) {
      handleSelectView(urlView, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('layout')) return;
    try {
      const stored = window.localStorage.getItem('applications.layout');
      if (stored === 'board') {
        setLayout('board');
        syncUrl({ layout: 'board' });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setCurationToast({ message, type });
    setTimeout(() => setCurationToast(null), 5000);
  };

  const handleSaveView = async () => {
    if (activeViewOption?.isSystem) return;
    setIsSavingView(true);
    const result = await updateApplicationView(activeViewId, { config: currentConfig });
    setIsSavingView(false);
    if (result.error || !result.view) {
      showToast(t('applications.views.toasts.error'), 'info');
      return;
    }
    setSavedViews((prev) => prev.map((view) => view.id === result.view!.id
      ? { ...view, name: result.view!.name, config: normalizeViewConfig(result.view!.config) }
      : view));
    showToast(t('applications.views.toasts.saved'));
    router.refresh();
  };

  const handleSaveViewAs = async (name: string) => {
    setIsSavingView(true);
    const result = await createApplicationView(name, currentConfig);
    setIsSavingView(false);
    if (result.error === 'DUPLICATE_NAME') {
      showToast(t('applications.views.toasts.duplicate'), 'info');
      return;
    }
    if (result.error || !result.view) {
      showToast(t('applications.views.toasts.error'), 'info');
      return;
    }
    const created: SavedApplicationView = {
      id: result.view.id,
      name: result.view.name,
      isDefault: result.view.isDefault,
      config: normalizeViewConfig(result.view.config),
    };
    setSavedViews((prev) => [...prev, created]);
    setActiveViewId(created.id);
    syncUrl({ view: created.id });
    showToast(t('applications.views.toasts.saved'));
    router.refresh();
  };

  const handleSetDefaultView = async () => {
    const result = await setDefaultApplicationView(activeViewId);
    if (result.error) {
      showToast(t('applications.views.toasts.error'), 'info');
      return;
    }
    setSavedViews((prev) => prev.map((view) => ({ ...view, isDefault: view.id === activeViewId })));
    showToast(t('applications.views.toasts.defaultUpdated'));
    router.refresh();
  };

  const handleDeleteView = async () => {
    if (!window.confirm(t('applications.views.deleteConfirm'))) return;
    const result = await deleteApplicationView(activeViewId);
    if (result.error) {
      showToast(t('applications.views.toasts.error'), 'info');
      return;
    }
    setSavedViews((prev) => prev.filter((view) => view.id !== activeViewId));
    handleSelectView('active');
    showToast(t('applications.views.toasts.deleted'));
    router.refresh();
  };

  const handleRevertView = () => {
    applyViewConfig(activeViewConfig);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCvFilter('all');
    setDateFilter('all');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setFollowupFilter('all');
    setColumnFilters([]);
    resetPageAndSelection();
  };

  const handleSetSort = (key: ApplicationSortKey, direction: ApplicationSortDirection) => {
    setSort({ key, direction });
    setPage(1);
  };

  const handleSetGrouping = (next: ApplicationGrouping | null) => {
    setGrouping(next);
    resetPageAndSelection();
  };

  const handleSetColumnFilter = (column: ApplicationColumnId, filter: ApplicationColumnFilter | null) => {
    setColumnFilters((prev) => {
      const next = prev.filter((item) => item.column !== column);
      if (filter) next.push(filter);
      return next;
    });
    setPage(1);
  };

  const handleSetColumnWidth = (column: ApplicationColumnId | 'actions', width: ApplicationColumnWidth) => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      if (width === 'auto') delete next[column];
      else next[column] = width;
      return next;
    });
  };

  const handleMoveColumn = (column: ApplicationColumnId, direction: -1 | 1) => {
    setColumns((prev) => {
      const index = prev.indexOf(column);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setPage(1);
  };

  const handleMoveActions = (direction: -1 | 1) => {
    setActionsIndex((prev) => {
      const max = columns.length;
      const current = prev === null ? max : Math.min(Math.max(0, prev), max);
      const next = Math.min(Math.max(0, current + direction), max);
      return next >= max ? null : next;
    });
    setPage(1);
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = (ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleRowStatusChange = async (offer: ApplicationSummary, status: string) => {
    const previous = localOffers;
    setPendingStatusId(offer.id);
    setLocalOffers((prev) => prev.map((item) => item.id === offer.id ? { ...item, status, updatedAt: new Date() } : item));
    const result = await updateJobOfferStatus(offer.id, status);
    setPendingStatusId(null);
    if (result.error) {
      setLocalOffers(previous);
      showToast(t('applications.table.statusError'), 'info');
      return;
    }
    showToast(t('applications.table.statusUpdated'));
    router.refresh();
  };

  const handleConfirmDeleteOffer = async () => {
    if (!offerToDelete) return;
    setIsDeletingOffer(true);
    const result = await deleteJobOffer(offerToDelete.id);
    setIsDeletingOffer(false);
    if (result.error) {
      showToast(t('applications.table.deleteError'), 'info');
      return;
    }
    setLocalOffers((prev) => prev.filter((item) => item.id !== offerToDelete.id));
    setOfferToDelete(null);
    showToast(t('applications.table.deleted'));
    router.refresh();
  };

  const handleBulkStatusChange = async (status: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !status) return;
    const previous = localOffers;
    setLocalOffers((prev) => prev.map((item) => selectedIds.has(item.id) ? { ...item, status, updatedAt: new Date() } : item));
    const results = await Promise.all(ids.map((id) => updateJobOfferStatus(id, status)));
    if (results.some((result) => result.error)) {
      setLocalOffers(previous);
      showToast(t('applications.table.statusError'), 'info');
    } else {
      showToast(t('applications.table.bulkStatusUpdated').replace('{count}', String(ids.length)));
    }
    setSelectedIds(new Set());
    router.refresh();
  };

  const handleCurateSelected = () => {
    if (selectedIds.size === 0) return;
    const selectedOffers = localOffers.filter((o) => selectedIds.has(o.id));
    if (selectedOffers.length === 0) return;
    setCurateTargetOffers(selectedOffers);
    setIsSimulationMode(false);
    setIsCurateModalOpen(true);
  };

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

  // Hydration state
  const [hasMounted, setHasMounted] = useState(false);

  const [localOffers, setLocalOffers] = useState(() =>
    offers.map((o) => (o.status.startsWith('archived:') ? { ...o, status: 'archived' } : o))
  );
  const [draggingOfferId, setDraggingOfferId] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setLocalOffers(
      offers.map((o) => (o.status.startsWith('archived:') ? { ...o, status: 'archived' } : o))
    );
  }, [offers]);

  // Drag and Drop Handlers
  const handleDragStart = (start: any) => {
    setDraggingOfferId(start.draggableId);
  };

  const handleDragEnd = async (result: any) => {
    setDraggingOfferId(null);
    const { destination, source, draggableId } = result;

    // Dropped outside a column or in the same place
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const targetColumnId = destination.droppableId as BoardColumnId;
    const offerId = draggableId;

    const offer = localOffers.find(o => o.id === offerId);
    if (!offer || offer.status === targetColumnId) return;

    // Optimistic UI update
    const previousOffers = [...localOffers];
    setLocalOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: targetColumnId, updatedAt: new Date() } : o));

    const actionResult = await updateJobOfferStatus(offerId, targetColumnId);
    if (actionResult.error) {
      // Revert if db update fails
      setLocalOffers(previousOffers);
    } else {
      router.refresh();
    }
  };

  const handleDeleteOffer = (offerId: string) => {
    setLocalOffers(prev => prev.filter(o => o.id !== offerId));
  };

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    platform: 'linkedin',
    description: '',
  });

  const boardOffers = localOffers;
  const filteredOffers = useMemo(
    () => filterApplications(boardOffers, viewFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localOffers, viewFilters],
  );
  const boardFilteredOffers = useMemo(
    () => filterApplications(boardOffers, { ...viewFilters, excludedStatuses: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localOffers, viewFilters],
  );
  const sortedOffers = useMemo(() => sortApplications(filteredOffers, sort), [filteredOffers, sort]);
  const pagination = useMemo(() => paginate(sortedOffers, page, pageSize), [sortedOffers, page, pageSize]);
  const hasActiveFilters = Boolean(searchQuery.trim()) || cvFilter !== 'all' || dateFilter !== 'all' || statusFilter !== 'all' || followupFilter !== 'all' || columnFilters.length > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.company) {
      setError(t('applications.modal.requiredError'));
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

  if (!hasMounted) {
    return (
      <div className="w-full min-h-[500px] flex flex-col items-center justify-center py-20 font-display">
        <RefreshCw className="w-8 h-8 text-ai animate-spin stroke-[1.75]" />
        <p className="text-xs text-text-muted mt-3 font-sans">{t('applications.board.loading')}</p>
      </div>
    );
  }

  return (
    <div className={`w-full ${layout === 'table' ? 'md:h-full md:flex md:flex-col md:min-h-0' : ''}`}>
      {/* Cabecera del Tablero */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2 font-display">
            <Briefcase className="w-6 h-6 text-ai stroke-[1.75]" />
            {t('applications.title')}
          </h2>
          <p className="text-text-muted text-sm mt-1 font-sans">
            {t('applications.subtitle')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto font-display">
          <div className="flex items-center gap-1 rounded-[8px] border border-subtle bg-surface p-1 shadow-sm">
            <button
              type="button"
              onClick={() => handleLayoutChange('table')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                layout === 'table'
                  ? 'bg-text dark:bg-white text-canvas shadow-sm'
                  : 'text-text-muted hover:text-text dark:hover:text-white'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('applications.layout.table')}
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange('board')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                layout === 'board'
                  ? 'bg-text dark:bg-white text-canvas shadow-sm'
                  : 'text-text-muted hover:text-text dark:hover:text-white'
              }`}
            >
              <SquareKanban className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('applications.layout.board')}
            </button>
          </div>


          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] bg-text hover:bg-text/90 dark:bg-white dark:hover:bg-surface-muted text-canvas font-semibold text-sm shadow-sm transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[1.75]" />
            {t('applications.board.newApplicationBtn')}
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-text-muted stroke-[1.75]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('applications.board.searchPlaceholder')}
            className="w-full bg-canvas border border-control rounded-[8px] pl-10 pr-10 py-3 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-text-muted hover:text-text dark:hover:text-white hover:bg-canvas dark:hover:bg-surface-muted transition-colors"
              aria-label={t('applications.board.clearSearch')}
              title={t('applications.board.clearSearch')}
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
          {followupFilter !== 'all' && (
            <button
              type="button"
              onClick={() => {
                setFollowupFilter('all');
                resetPageAndSelection();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <CalendarClock className="w-3.5 h-3.5 stroke-[1.75]" />
              {t(`applications.filters.followup.${followupFilter}`)}
              <X className="w-3 h-3 stroke-[2]" />
            </button>
          )}

          {layout === 'table' && (
            <>
              <ApplicationViewsMenu
                views={viewOptions}
                activeViewId={activeViewId}
                isDirty={isDirty}
                saving={isSavingView}
                onSelect={handleSelectView}
                onSave={handleSaveView}
                onSaveAs={handleSaveViewAs}
                onSetDefault={handleSetDefaultView}
                onDelete={handleDeleteView}
                onRevert={handleRevertView}
              />
              <ApplicationColumnsMenu
                visibleColumns={columns}
                onChange={(nextColumns) => {
                  setColumns(nextColumns);
                  setPage(1);
                }}
              />
            </>
          )}

          {layout === 'board' && (
            <div className="flex items-center gap-1 rounded-[8px] border border-subtle bg-surface p-1 shadow-sm font-display">
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                  viewMode === 'compact'
                    ? 'bg-text dark:bg-white text-canvas shadow-sm'
                    : 'text-text-muted hover:text-text dark:hover:text-white'
                }`}
              >
                <Minimize2 className="w-3.5 h-3.5 stroke-[1.75]" />
                {t('applications.board.viewCompact')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('comfortable')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all ${
                  viewMode === 'comfortable'
                    ? 'bg-text dark:bg-white text-canvas shadow-sm'
                    : 'text-text-muted hover:text-text dark:hover:text-white'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
                {t('applications.board.viewComfortable')}
              </button>
            </div>
          )}
        </div>
      </div>

      {layout === 'board' ? (
        <ApplicationsBoardView
          offers={boardOffers}
          filteredOffers={boardFilteredOffers}
          hasActiveFilters={hasActiveFilters}
          userCvs={userCvs}
          viewMode={viewMode}
          interestedSortMode={interestedSortMode}
          draggingOfferId={draggingOfferId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onToggleInterestedSort={() => setInterestedSortMode((prev) => (prev === 'score' ? 'date' : 'score'))}
          onOpenCurate={(simulation) => {
            setCurateTargetOffers(null);
            setIsSimulationMode(simulation);
            setIsCurateModalOpen(true);
          }}
          onOpenDetails={handleOpenDetails}
          onDelete={handleDeleteOffer}
        />
      ) : (
        <div className="md:flex md:flex-col md:flex-1 md:min-h-0">
          {selectedIds.size > 0 && (
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[12px] border border-ai/25 bg-ai/5 px-4 py-3">
              <span className="text-xs font-bold text-text font-display">
                {t('applications.table.bulk.selected').replace('{count}', String(selectedIds.size))}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCurateSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-gradient-to-r from-ai to-ai-action text-white text-xs font-bold font-display shadow-xs shadow-ai/20 hover:opacity-95 active:scale-98 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 stroke-[2] text-violet-200" />
                  <span>{t('applications.table.bulk.matchWithAi')}</span>
                </button>
                <label className="sr-only" htmlFor="bulk-status">{t('applications.table.bulk.changeStatus')}</label>
                <select
                  id="bulk-status"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) void handleBulkStatusChange(event.target.value);
                  }}
                  className="bg-surface border border-subtle rounded-[8px] px-3 py-2 text-xs font-semibold text-text focus:outline-none focus:border-ai transition-all cursor-pointer font-sans"
                >
                  <option value="">{t('applications.table.bulk.changeStatus')}</option>
                  <option value="interested">{t('applications.columns.interested.title')}</option>
                  <option value="applied">{t('applications.columns.applied.title')}</option>
                  <option value="interview">{t('applications.columns.interview.title')}</option>
                  <option value="offer">{t('applications.columns.offer.title')}</option>
                  <option value="rejected">{t('applications.columns.rejected.title')}</option>
                  <option value="archived">{t('applications.columns.archived.title')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:text-text transition-colors"
                >
                  <X className="w-3.5 h-3.5 stroke-[1.75]" />
                  {t('applications.table.bulk.clear')}
                </button>
              </div>
            </div>
          )}

          <ApplicationsTable
            offers={pagination.items}
            userCvs={userCvs}
            columns={columns}
            sort={sort}
            onSetSort={handleSetSort}
            grouping={grouping}
            onSetGrouping={handleSetGrouping}
            columnFilters={columnFilters}
            onSetColumnFilter={handleSetColumnFilter}
            columnWidths={columnWidths}
            onSetColumnWidth={handleSetColumnWidth}
            onMoveColumn={handleMoveColumn}
            actionsIndex={actionsIndex}
            onMoveActions={handleMoveActions}
            selectedIds={selectedIds}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
            onOpenDetails={handleOpenDetails}
            onDelete={setOfferToDelete}
            onStatusChange={handleRowStatusChange}
            pendingStatusId={pendingStatusId}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            onNewApplication={() => setIsModalOpen(true)}
            attachedFooter={filteredOffers.length > 0}
          />

          {filteredOffers.length > 0 && (
            <div className="sticky bottom-0 z-20 mt-3 bg-canvas pb-4 md:static md:mt-0 md:shrink-0">
              <div className="rounded-[12px] border border-subtle bg-surface px-4 py-3 shadow-sm md:rounded-t-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-display">
                <p className="text-xs text-text-muted">
                  {t('applications.table.pagination.showing')
                    .replace('{start}', String(pagination.total === 0 ? 0 : pagination.start + 1))
                    .replace('{end}', String(pagination.end))
                    .replace('{total}', String(pagination.total))}
                </p>
                <div className="flex items-center gap-2">
                  <label htmlFor="page-size" className="sr-only">{t('applications.table.pagination.perPage')}</label>
                  <select
                    id="page-size"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    className="bg-surface border border-subtle rounded-[8px] px-2.5 py-2 text-xs font-semibold text-text-muted focus:outline-none focus:border-ai transition-all cursor-pointer font-sans"
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>{size} {t('applications.table.pagination.perPageSuffix')}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={pagination.page <= 1}
                    aria-label={t('applications.table.pagination.previous')}
                    className="p-2 rounded-[8px] border border-subtle bg-surface text-text-muted hover:text-text disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
                  </button>
                  <span className="text-xs font-semibold text-text-muted">
                    {t('applications.table.pagination.page').replace('{page}', String(pagination.page)).replace('{total}', String(pagination.totalPages))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                    aria-label={t('applications.table.pagination.next')}
                    className="p-2 rounded-[8px] border border-subtle bg-surface text-text-muted hover:text-text disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[1.75]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Modal Premium para crear Candidatura */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="relative w-full max-w-lg bg-surface border border-subtle rounded-2xl p-6 md:p-8 shadow-dialog overflow-hidden">
            
            {/* Adornos visuales */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-text flex items-center gap-2 font-display">
                  <Briefcase className="w-5 h-5 text-ai stroke-[1.75]" />
                  {t('applications.modal.addTitle')}
                </h3>
                <p className="text-xs text-text-muted mt-1 font-sans">
                  {t('applications.modal.addDesc')}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text dark:hover:text-white p-1 rounded-[8px] hover:bg-canvas dark:hover:bg-canvas/45 transition-all"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-[8px] font-medium font-sans">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                    <FileText className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    {t('applications.modal.jobField')}
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder={t('applications.modal.jobPlaceholder')}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                    <Building2 className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    {t('applications.modal.companyField')}
                  </label>
                  <input
                    type="text"
                    name="company"
                    required
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder={t('applications.modal.companyPlaceholder')}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                    <Link className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    {t('applications.modal.linkField')}
                  </label>
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text font-display">{t('applications.modal.platformField')}</label>
                  <select
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer font-sans"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="infojobs">InfoJobs</option>
                    <option value="indeed">Indeed</option>
                    <option value="other">{t('applications.modal.platformOther')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted dark:text-text font-display">
                  {t('applications.modal.descField')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder={t('applications.modal.descPlaceholder')}
                  className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all resize-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-subtle font-display">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-text-muted hover:text-text dark:hover:text-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-text hover:bg-text/90 dark:bg-white dark:hover:bg-surface-muted dark:text-canvas rounded-[8px] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {t('applications.modal.savingBtn')}
                    </>
                  ) : (
                    t('applications.modal.saveBtn')
                  )}
                </button>
              </div>
            </form>
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
        isOpen={Boolean(offerToDelete)}
        onClose={() => setOfferToDelete(null)}
        title={t('applications.table.deleteTitle')}
        message={offerToDelete
          ? t('applications.table.deleteMessage')
            .replace('{title}', offerToDelete.title)
            .replace('{company}', offerToDelete.company)
          : ''}
        type="danger"
        confirmLabel={t('applications.table.deleteConfirm')}
        onConfirm={handleConfirmDeleteOffer}
        isPending={isDeletingOffer}
      />

      {/* Modal de Curación Inteligente de Candidaturas con IA (Efecto Mazo de Cartas) */}
      <CurateWithAiModal
        isOpen={isCurateModalOpen}
        onClose={() => {
          setIsCurateModalOpen(false);
          setCurateTargetOffers(null);
        }}
        onSuccess={(summary) => {
          setSelectedIds(new Set());
          setCurateTargetOffers(null);
          router.refresh();
          if (summary) {
            const count = summary.total;
            const message = count === 1
              ? `🎉 ¡1 candidatura puntuada con éxito! (${summary.kept} apta, ${summary.archived} suspensa)`
              : `🎉 ¡${count} candidaturas puntuadas con éxito! (${summary.kept} aptas, ${summary.archived} suspensas)`;
            setCurationToast({
              message,
              type: 'success',
            });
            setTimeout(() => setCurationToast(null), 6000);
          }
        }}
        onScoresUpdated={(newScores) => {
          const scoreMap = new Map(newScores.map((s) => [s.id, s.score]));
          setLocalOffers((prev) =>
            prev.map((o) => {
              const updatedScore = scoreMap.get(o.id);
              return updatedScore !== undefined ? { ...o, scoreOverall: updatedScore } : o;
            })
          );
        }}
        offersCount={(curateTargetOffers ?? boardOffers.filter((o) => o.status === 'interested')).length}
        offers={curateTargetOffers ?? boardOffers.filter((o) => o.status === 'interested')}
        isSimulation={isSimulationMode}
      />

      {/* Toast Flotante tras Curación Exitosa */}
      {curationToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-text dark:bg-white text-canvas px-5 py-3 rounded-2xl shadow-2xl border border-white/10 dark:border-black/10 flex items-center gap-3 font-display text-xs font-bold">
            <div className="w-6 h-6 rounded-full bg-action/20 text-success-text flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span>{curationToast.message}</span>
            <button
              onClick={() => setCurationToast(null)}
              className="ml-2 text-white/50 dark:text-black/50 hover:text-white dark:hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
