"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import NextLink from 'next/link';
import {
  CalendarClock,
  ChevronRight,
  ExternalLink,
  Eye,
  Inbox,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { ApplicationSummary, CompanyLookupItem, CvListItem } from '@/lib/job-offer-queries';
import type {
  ApplicationColumnFilter,
  ApplicationColumnId,
  ApplicationColumnWidth,
  ApplicationColumnWidths,
  ApplicationGrouping,
  ApplicationSortDirection,
  ApplicationSortKey,
  ApplicationSortState,
} from '@/lib/application-views';
import {
  APPLICATION_COLUMN_WIDTH_PX,
  formatApplicationTimestamp,
  groupApplications,
} from '@/lib/application-views';
import { formatDate, cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import ApplicationColumnHeaderMenu from './ApplicationColumnHeaderMenu';
import ApplicationScoreBadge from './ApplicationScoreBadge';
import ApplicationStatusSelect from './ApplicationStatusSelect';

const SORTABLE_COLUMNS: ApplicationColumnId[] = [
  'title',
  'company',
  'status',
  'score',
  'followup',
  'createdAt',
  'updatedAt',
];

const DAY_MS = 24 * 60 * 60 * 1000;

interface ApplicationsTableProps {
  offers: ApplicationSummary[];
  allSelectableIds?: string[];
  companies?: CompanyLookupItem[];
  userCvs: CvListItem[];
  columns: ApplicationColumnId[];
  sort: ApplicationSortState;
  onSetSort: (key: ApplicationSortKey, direction: ApplicationSortDirection) => void;
  grouping: ApplicationGrouping | null;
  onSetGrouping: (grouping: ApplicationGrouping | null) => void;
  columnFilters: ApplicationColumnFilter[];
  onSetColumnFilter: (column: ApplicationColumnId, filter: ApplicationColumnFilter | null) => void;
  columnWidths: ApplicationColumnWidths;
  onSetColumnWidth: (column: ApplicationColumnId | 'actions', width: ApplicationColumnWidth) => void;
  onMoveColumn: (column: ApplicationColumnId, direction: -1 | 1) => void;
  actionsIndex: number | null;
  onMoveActions: (direction: -1 | 1) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onOpenDetails: (offer: ApplicationSummary) => void;
  onDelete: (offer: ApplicationSummary) => void;
  onStatusChange: (offer: ApplicationSummary, status: string) => void;
  pendingStatusId: string | null;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNewApplication: () => void;
  attachedFooter?: boolean;
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  onClick,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  onClick?: (event: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      onClick={onClick}
      aria-label={label}
      className="h-3.5 w-3.5 rounded border-control accent-ai cursor-pointer"
    />
  );
}

export default function ApplicationsTable({
  offers,
  allSelectableIds,
  companies = [],
  userCvs,
  columns,
  sort,
  onSetSort,
  grouping,
  onSetGrouping,
  columnFilters,
  onSetColumnFilter,
  columnWidths,
  onSetColumnWidth,
  onMoveColumn,
  actionsIndex,
  onMoveActions,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onOpenDetails,
  onDelete,
  onStatusChange,
  pendingStatusId,
  hasActiveFilters,
  onClearFilters,
  onNewApplication,
  attachedFooter = false,
}: ApplicationsTableProps) {
  const { t } = useLanguage();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const cvTitles = useMemo(() => {
    const map = new Map<string, string>();
    userCvs.forEach((cv) => map.set(cv.id, cv.title));
    return map;
  }, [userCvs]);

  const groups = useMemo(
    () => (grouping ? groupApplications(offers, grouping) : null),
    [offers, grouping],
  );

  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [grouping]);

  const selectableIds = allSelectableIds && allSelectableIds.length > 0
    ? allSelectableIds
    : offers.map((offer) => offer.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectableIds.some((id) => selectedIds.has(id));
  const todayStart = new Date().setHours(0, 0, 0, 0);

  const isEmpty = offers.length === 0;

  const headerLabel = (column: ApplicationColumnId | 'actions') => t(`applications.columns.labels.${column}`);

  const actionsPosition = actionsIndex === null
    ? columns.length
    : Math.min(Math.max(0, actionsIndex), columns.length);

  const tableItems = useMemo(() => {
    const items: Array<ApplicationColumnId | 'actions'> = [...columns];
    items.splice(actionsPosition, 0, 'actions');
    return items;
  }, [columns, actionsPosition]);

  const columnStyle = (column: ApplicationColumnId | 'actions'): React.CSSProperties | undefined => {
    const px = APPLICATION_COLUMN_WIDTH_PX[columnWidths[column] ?? 'auto'];
    return px ? { width: px, minWidth: px } : undefined;
  };

  const groupLabel = (key: string) => {
    if (!grouping) return key;
    if (!key) return t('applications.columns.headerMenu.noValue');
    if (grouping.column === 'status') {
      const safeKey = key.startsWith('archived:') ? 'archived' : key;
      const label = t(`applications.columns.${safeKey}.title`);
      return label.startsWith('applications.columns.') ? safeKey : label;
    }
    if (grouping.column === 'liveness') {
      return key === 'expired'
        ? t('applications.table.livenessExpired')
        : t('applications.table.livenessActive');
    }
    if (grouping.column === 'company') {
      return companies.find((company) => company.id === key)?.name
        || offers.find((offer) => offer.companyId === key)?.company
        || key;
    }
    if (grouping.column === 'cv') return cvTitles.get(key) ?? key;
    if (grouping.column === 'createdAt' || grouping.column === 'updatedAt' || grouping.column === 'followup') {
      return formatDate(new Date(`${key}T00:00:00`));
    }
    if (grouping.column === 'score') return `${key}%`;
    return key;
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderCell = (offer: ApplicationSummary, column: ApplicationColumnId) => {
    switch (column) {
      case 'title':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display font-bold text-text truncate max-w-[260px]" title={offer.title}>
              {offer.title}
            </span>
            {offer.platform && (
              <span className="text-[9px] font-bold text-slate-400 dark:text-text-muted uppercase tracking-wider shrink-0">
                {offer.platform}
              </span>
            )}
          </div>
        );
      case 'company':
        if (offer.companyId) {
          return (
            <NextLink
              href={`/dashboard/applications/companies/${offer.companyId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="text-ai hover:underline truncate max-w-[200px] inline-block align-bottom"
              title={offer.company}
            >
              {offer.company}
            </NextLink>
          );
        }
        return (
          <span className="text-text-muted dark:text-slate-300 truncate max-w-[200px]" title={offer.company}>
            {offer.company}
          </span>
        );
      case 'status':
        return (
          <ApplicationStatusSelect
            status={offer.status}
            saving={pendingStatusId === offer.id}
            disabled={pendingStatusId === offer.id}
            onChange={(status) => onStatusChange(offer, status)}
          />
        );
      case 'score':
        return <ApplicationScoreBadge score={offer.scoreOverall} />;
      case 'cv': {
        const cvTitle = offer.cvId ? cvTitles.get(offer.cvId) : null;
        if (!offer.cvId) {
          return <span className="text-slate-400 dark:text-text-muted italic font-sans">{t('applications.table.noCv')}</span>;
        }
        return (
          <NextLink
            href={`/editor/${offer.cvId}`}
            onClick={(event) => event.stopPropagation()}
            className="text-ai hover:underline truncate max-w-[200px] inline-block align-bottom"
            title={cvTitle || undefined}
          >
            {cvTitle || t('applications.table.noCvTitle')}
          </NextLink>
        );
      }
      case 'followup': {
        if (!offer.nextFollowupDate) {
          return <span className="text-slate-400 dark:text-text-muted">—</span>;
        }
        const followupDate = new Date(offer.nextFollowupDate);
        const isOverdue = followupDate.setHours(0, 0, 0, 0) < todayStart;
        return (
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${isOverdue ? 'text-rose-500 dark:text-rose-400 font-semibold' : 'text-text-muted dark:text-slate-300'}`}>
            <CalendarClock className="w-3.5 h-3.5 stroke-[1.75]" />
            {formatDate(new Date(offer.nextFollowupDate))}
          </span>
        );
      }
      case 'platform':
        return offer.platform
          ? <span className="text-[10px] font-bold text-slate-400 dark:text-text-muted uppercase tracking-wider">{offer.platform}</span>
          : <span className="text-slate-400 dark:text-text-muted">—</span>;
      case 'url':
        return offer.url
          ? (
            <a
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 text-ai hover:underline whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('applications.table.openOffer')}
            </a>
          )
          : <span className="text-slate-400 dark:text-text-muted">—</span>;
      case 'source':
        return offer.source
          ? <span className="text-text-muted dark:text-slate-300">{offer.source}</span>
          : <span className="text-slate-400 dark:text-text-muted">—</span>;
      case 'liveness':
        return offer.livenessStatus === 'expired'
          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20">{t('applications.table.livenessExpired')}</span>
          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{t('applications.table.livenessActive')}</span>;
      case 'createdAt':
        return (
          <span className="text-text-muted dark:text-slate-300 whitespace-nowrap" title={formatApplicationTimestamp(offer.createdAt)}>
            {formatDate(new Date(offer.createdAt))}
          </span>
        );
      case 'updatedAt':
        return (
          <span className="text-text-muted dark:text-slate-300 whitespace-nowrap" title={formatApplicationTimestamp(offer.updatedAt)}>
            {formatDate(new Date(offer.updatedAt))}
          </span>
        );
      default:
        return null;
    }
  };

  const rowActions = (offer: ApplicationSummary, compact = false) => (
    <div className="flex items-center justify-end gap-0.5">
      <NextLink
        href={`/dashboard/applications/offer/${offer.id}`}
        onClick={(event) => event.stopPropagation()}
        title={t('applications.table.actions.openOffer')}
        aria-label={t('applications.table.actions.openOffer')}
        className={`p-1.5 rounded-md text-slate-400 hover:text-text dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/10 transition-colors ${compact ? '' : 'opacity-60 group-hover:opacity-100'}`}
      >
        <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
      </NextLink>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(offer);
        }}
        title={t('applications.table.actions.delete')}
        aria-label={t('applications.table.actions.delete')}
        className={`p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors ${compact ? '' : 'opacity-60 group-hover:opacity-100'}`}
      >
        <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
      </button>
    </div>
  );

  const renderRow = (offer: ApplicationSummary) => {
    const isSelected = selectedIds.has(offer.id);
    return (
      <tr
        key={offer.id}
        onClick={() => onOpenDetails(offer)}
        className={`group cursor-pointer transition-colors ${isSelected ? 'bg-ai/5 dark:bg-ai/10' : 'hover:bg-canvas/70 dark:hover:bg-canvas/20'}`}
      >
        <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
          <SelectionCheckbox
            checked={isSelected}
            onChange={() => onToggleRow(offer.id)}
            label={t('applications.table.selectRow', { title: offer.title })}
          />
        </td>
        {tableItems.map((item) => (
          item === 'actions' ? (
            <td key="actions" style={columnStyle('actions')} className="px-3 py-2.5 align-middle">
              {rowActions(offer)}
            </td>
          ) : (
            <td key={item} style={columnStyle(item)} className="px-3 py-2.5 align-middle">
              {renderCell(offer, item)}
            </td>
          )
        ))}
      </tr>
    );
  };

  if (isEmpty) {
    return (
      <div className="rounded-[12px] border border-dashed border-subtle bg-surface/50 p-12 text-center md:my-auto">
        {hasActiveFilters ? (
          <>
            <Search className="w-8 h-8 mx-auto mb-3 text-text-muted opacity-60 stroke-[1.75]" />
            <p className="text-sm font-bold text-text font-display">{t('applications.table.emptySearchTitle')}</p>
            <p className="text-xs text-text-muted font-sans mt-1">{t('applications.table.emptySearchDesc')}</p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[8px] border border-subtle bg-surface text-xs font-semibold text-text-muted hover:text-text transition-colors"
            >
              {t('applications.table.clearFilters')}
            </button>
          </>
        ) : (
          <>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-text-muted opacity-60 stroke-[1.75]" />
            <p className="text-sm font-bold text-text font-display">{t('applications.table.emptyTitle')}</p>
            <p className="text-xs text-text-muted font-sans mt-1">{t('applications.table.emptyDesc')}</p>
            <button
              type="button"
              onClick={onNewApplication}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-text dark:bg-white text-canvas text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('applications.board.newApplicationBtn')}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="md:flex md:flex-col md:min-h-0">
      {/* Tabla de escritorio */}
      <div className={`hidden md:flex md:flex-col md:min-h-0 border border-subtle bg-surface shadow-sm overflow-hidden ${attachedFooter ? 'rounded-t-[12px] border-b-0' : 'rounded-[12px]'}`}>
        <div className="overflow-x-auto scrollbar-custom md:min-h-0 md:grow md:overflow-y-auto">
          <table className="min-w-full text-left text-xs font-sans">
            <caption className="sr-only">{t('applications.table.caption')}</caption>
            <thead className="bg-surface-muted/70 dark:bg-canvas/40 text-[10px] uppercase tracking-wider text-text-muted font-display md:sticky md:top-0 md:z-10 md:bg-surface-muted md:dark:bg-canvas">
              <tr>
                <th scope="col" className="w-10 px-3 py-3">
                  <SelectionCheckbox
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={(checked) => onToggleAll(selectableIds, checked)}
                    label={t('applications.table.selectAll')}
                  />
                </th>
                {tableItems.map((item) => {
                  if (item === 'actions') {
                    return (
                      <th
                        key="actions"
                        scope="col"
                        style={columnStyle('actions')}
                        className="px-3 py-3 whitespace-nowrap font-bold"
                      >
                        <ApplicationColumnHeaderMenu
                          column="actions"
                          label={headerLabel('actions')}
                          sortable={false}
                          groupable={false}
                          filterable={false}
                          sort={sort}
                          grouping={grouping}
                          width={columnWidths.actions ?? 'auto'}
                          canMoveLeft={actionsPosition > 0}
                          canMoveRight={actionsPosition < columns.length}
                          onSetSort={onSetSort}
                          onSetGrouping={onSetGrouping}
                          onSetColumnFilter={() => {}}
                          onSetWidth={(width) => onSetColumnWidth('actions', width)}
                          onMove={onMoveActions}
                        />
                      </th>
                    );
                  }
                  const isSorted = sort.key === item;
                  return (
                    <th
                      key={item}
                      scope="col"
                      style={columnStyle(item)}
                      aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-3 py-3 whitespace-nowrap font-bold"
                    >
                      <ApplicationColumnHeaderMenu
                        column={item}
                        label={headerLabel(item)}
                        sortable={SORTABLE_COLUMNS.includes(item)}
                        sort={sort}
                        grouping={grouping}
                        columnFilter={columnFilters.find((filter) => filter.column === item)}
                        width={columnWidths[item] ?? 'auto'}
                        canMoveLeft={columns.indexOf(item) > 0}
                        canMoveRight={columns.indexOf(item) < columns.length - 1}
                        onSetSort={onSetSort}
                        onSetGrouping={onSetGrouping}
                        onSetColumnFilter={(filter) => onSetColumnFilter(item, filter)}
                        onSetWidth={(width) => onSetColumnWidth(item, width)}
                        onMove={(direction) => onMoveColumn(item, direction)}
                        lookupOptions={item === 'company' ? companies : undefined}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle dark:divide-white/5">
              {groups
                ? groups.map((group) => {
                    const collapsed = collapsedGroups.has(group.key);
                    return (
                      <Fragment key={`group-${group.key}`}>
                        <tr className="bg-surface-muted/60 dark:bg-canvas/30">
                          <td colSpan={columns.length + 2} className="px-3 py-1.5">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.key)}
                              aria-expanded={!collapsed}
                              className="flex items-center gap-2 w-full text-left text-[10px] uppercase tracking-wider font-display font-bold text-text-muted hover:text-text transition-colors"
                            >
                              <ChevronRight className={cn('w-3.5 h-3.5 stroke-[2] transition-transform', !collapsed && 'rotate-90')} />
                              <span className="truncate">{groupLabel(group.key)}</span>
                              <span className="px-1.5 py-0.5 rounded-full bg-canvas dark:bg-surface-muted border border-subtle text-[9px]">
                                {group.offers.length}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {!collapsed && group.offers.map((offer) => renderRow(offer))}
                      </Fragment>
                    );
                  })
                : offers.map((offer) => renderRow(offer))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tarjetas en móvil */}
      <div className="md:hidden space-y-2.5">
        {offers.map((offer) => {
          const isSelected = selectedIds.has(offer.id);
          return (
            <div
              key={offer.id}
              onClick={() => onOpenDetails(offer)}
              className={`rounded-[12px] border p-3.5 transition-colors cursor-pointer ${isSelected ? 'border-ai/40 bg-ai/5' : 'border-subtle bg-surface hover:border-ai/30'}`}
            >
              <div className="flex items-start gap-3">
                <div onClick={(event) => event.stopPropagation()} className="pt-0.5">
                  <SelectionCheckbox
                    checked={isSelected}
                    onChange={() => onToggleRow(offer.id)}
                    label={t('applications.table.selectRow', { title: offer.title })}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm text-text truncate">{offer.title}</p>
                      {offer.companyId ? (
                        <NextLink
                          href={`/dashboard/applications/companies/${offer.companyId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="text-xs text-ai hover:underline mt-0.5 truncate inline-block"
                        >
                          {offer.company}
                        </NextLink>
                      ) : (
                        <p className="text-xs text-text-muted mt-0.5 truncate">{offer.company}</p>
                      )}
                    </div>
                    <ApplicationScoreBadge score={offer.scoreOverall} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <ApplicationStatusSelect
                      status={offer.status}
                      saving={pendingStatusId === offer.id}
                      disabled={pendingStatusId === offer.id}
                      onChange={(status) => onStatusChange(offer, status)}
                    />
                    <span className="text-[11px] text-text-muted">
                      {formatDate(new Date(offer.updatedAt))}
                    </span>
                    {offer.platform && (
                      <span className="text-[9px] font-bold text-slate-400 dark:text-text-muted uppercase tracking-wider">
                        {offer.platform}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end mt-2">
                    {rowActions(offer, true)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
