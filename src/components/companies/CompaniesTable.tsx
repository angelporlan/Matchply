"use client";

import { useEffect, useMemo, useRef } from 'react';
import NextLink from 'next/link';
import {
  Building2,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { CompanyListRow } from '@/lib/job-offer-queries';
import {
  COMPANY_COLUMN_WIDTH_PX,
  type CompanyColumnFilter,
  type CompanyColumnId,
  type CompanyColumnWidth,
  type CompanyColumnWidths,
  type CompanySortDirection,
  type CompanySortKey,
  type CompanySortState,
} from './CompanyColumnHeaderMenu';
import CompanyColumnHeaderMenu from './CompanyColumnHeaderMenu';
import CompanyIcon from './CompanyIcon';
import { formatDate, cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/Button';

interface CompaniesTableProps {
  companies: CompanyListRow[];
  allSelectableIds?: string[];
  columns: CompanyColumnId[];
  sort: CompanySortState;
  onSetSort: (key: CompanySortKey, direction: CompanySortDirection) => void;
  columnFilters: CompanyColumnFilter[];
  onSetColumnFilter: (column: CompanyColumnId, filter: CompanyColumnFilter | null) => void;
  columnWidths: CompanyColumnWidths;
  onSetColumnWidth: (column: CompanyColumnId | 'actions', width: CompanyColumnWidth) => void;
  onMoveColumn: (column: CompanyColumnId, direction: -1 | 1) => void;
  actionsIndex: number | null;
  onMoveActions: (direction: -1 | 1) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onOpenDetails: (company: CompanyListRow) => void;
  onDelete: (company: CompanyListRow) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNewCompany: () => void;
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

export default function CompaniesTable({
  companies,
  allSelectableIds,
  columns,
  sort,
  onSetSort,
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
  hasActiveFilters,
  onClearFilters,
  onNewCompany,
  attachedFooter = false,
}: CompaniesTableProps) {
  const { t } = useLanguage();

  const selectableIds = allSelectableIds && allSelectableIds.length > 0
    ? allSelectableIds
    : companies.map((c) => c.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectableIds.some((id) => selectedIds.has(id));

  const isEmpty = companies.length === 0;

  const headerLabel = (column: CompanyColumnId | 'actions') => {
    switch (column) {
      case 'actions':
        return t('companies.table.actions');
      case 'applicationCount':
        return t('companies.table.applicationCount');
      case 'noteCount':
        return t('companies.table.noteCount');
      default:
        return t(`companies.table.${column}`);
    }
  };

  const actionsPosition = actionsIndex === null
    ? columns.length
    : Math.min(Math.max(0, actionsIndex), columns.length);

  const tableItems = useMemo(() => {
    const items: Array<CompanyColumnId | 'actions'> = [...columns];
    items.splice(actionsPosition, 0, 'actions');
    return items;
  }, [columns, actionsPosition]);

  const columnStyle = (column: CompanyColumnId | 'actions'): React.CSSProperties | undefined => {
    const px = COMPANY_COLUMN_WIDTH_PX[columnWidths[column] ?? 'auto'];
    return px ? { width: px, minWidth: px } : undefined;
  };

  const renderCell = (company: CompanyListRow, column: CompanyColumnId) => {
    switch (column) {
      case 'name':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <CompanyIcon companyId={company.id} iconHash={company.iconHash} name={company.name} />
            <span className="font-display font-bold text-text truncate max-w-[260px]" title={company.name}>
              {company.name}
            </span>
          </div>
        );
      case 'location':
        return (
          <span className="text-text-muted dark:text-slate-300 truncate max-w-[180px]" title={company.location || undefined}>
            {company.location || '—'}
          </span>
        );
      case 'sector':
        return (
          <span className="text-text-muted dark:text-slate-300 truncate max-w-[180px]" title={company.sector || undefined}>
            {company.sector || '—'}
          </span>
        );
      case 'website':
        return company.website ? (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 text-ai hover:underline whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>{t('companies.table.openWebsite')}</span>
          </a>
        ) : (
          <span className="text-slate-400 dark:text-text-muted">—</span>
        );
      case 'applicationCount':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-muted dark:bg-white/5 text-text border border-subtle">
            {company.applicationCount}
          </span>
        );
      case 'noteCount':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-muted dark:bg-white/5 text-text border border-subtle">
            {company.noteCount}
          </span>
        );
      case 'updatedAt':
        return (
          <span className="text-text-muted dark:text-slate-300 whitespace-nowrap">
            {formatDate(new Date(company.updatedAt))}
          </span>
        );
      default:
        return null;
    }
  };

  const rowActions = (company: CompanyListRow) => (
    <div className="flex items-center justify-end gap-0.5">
      <NextLink
        href={`/dashboard/applications/companies/${company.id}`}
        onClick={(event) => event.stopPropagation()}
        title={t('companies.detail.viewApplications')}
        aria-label={t('companies.detail.viewApplications')}
        className="p-1.5 rounded-md text-slate-400 hover:text-text dark:hover:text-white hover:bg-surface-muted dark:hover:bg-white/10 transition-colors opacity-60 group-hover:opacity-100"
      >
        <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
      </NextLink>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(company);
        }}
        title={t('companies.table.delete')}
        aria-label={t('companies.table.delete')}
        className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors opacity-60 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
      </button>
    </div>
  );

  const renderRow = (company: CompanyListRow) => {
    const isSelected = selectedIds.has(company.id);
    return (
      <tr
        key={company.id}
        onClick={() => onOpenDetails(company)}
        className={`group cursor-pointer transition-colors ${
          isSelected ? 'bg-ai/5 dark:bg-ai/10' : 'hover:bg-canvas/70 dark:hover:bg-canvas/20'
        }`}
      >
        <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
          <SelectionCheckbox
            checked={isSelected}
            onChange={() => onToggleRow(company.id)}
            label={t('companies.table.selectRow').replace('{name}', company.name)}
          />
        </td>
        {tableItems.map((item) => (
          item === 'actions' ? (
            <td key="actions" style={columnStyle('actions')} className="px-3 py-2.5 align-middle">
              {rowActions(company)}
            </td>
          ) : (
            <td key={item} style={columnStyle(item)} className="px-3 py-2.5 align-middle">
              {renderCell(company, item)}
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
            <p className="text-sm font-bold text-text font-display">{t('companies.empty.searchTitle')}</p>
            <p className="text-xs text-text-muted font-sans mt-1">{t('companies.empty.searchDesc')}</p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[8px] border border-subtle bg-surface text-xs font-semibold text-text-muted hover:text-text transition-colors"
            >
              {t('companies.table.clearFilters')}
            </button>
          </>
        ) : (
          <>
            <Building2 className="w-8 h-8 mx-auto mb-3 text-text-muted opacity-60 stroke-[1.75]" />
            <p className="text-sm font-bold text-text font-display">{t('companies.empty.title')}</p>
            <p className="text-xs text-text-muted font-sans mt-1">{t('companies.empty.desc')}</p>
            <Button type="button" onClick={onNewCompany} className="mt-4">
              <Plus className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('companies.newBtn')}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="md:flex md:flex-col md:min-h-0 md:flex-1">
      {/* Desktop Table */}
      <div className={`hidden md:flex md:flex-col md:min-h-0 md:flex-1 border border-subtle bg-surface shadow-sm overflow-hidden ${attachedFooter ? 'rounded-t-[12px] border-b-0' : 'rounded-[12px]'}`}>
        <div className="overflow-x-auto scrollbar-custom md:min-h-0 md:grow md:overflow-y-auto">
          <table className="min-w-full text-left text-xs font-sans">
            <caption className="sr-only">{t('companies.table.caption')}</caption>
            <thead className="bg-surface-muted/70 dark:bg-canvas/40 text-[10px] uppercase tracking-wider text-text-muted font-display md:sticky md:top-0 md:z-10 md:bg-surface-muted md:dark:bg-canvas">
              <tr>
                <th scope="col" className="w-10 px-3 py-3">
                  <SelectionCheckbox
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={(checked) => onToggleAll(selectableIds, checked)}
                    label={t('companies.table.selectAll')}
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
                        <CompanyColumnHeaderMenu
                          column="actions"
                          label={headerLabel('actions')}
                          sortable={false}
                          filterable={false}
                          sort={sort}
                          width={columnWidths.actions ?? 'auto'}
                          canMoveLeft={actionsPosition > 0}
                          canMoveRight={actionsPosition < columns.length}
                          onSetSort={onSetSort}
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
                      <CompanyColumnHeaderMenu
                        column={item}
                        label={headerLabel(item)}
                        sortable={true}
                        filterable={true}
                        sort={sort}
                        columnFilter={columnFilters.find((filter) => filter.column === item)}
                        width={columnWidths[item] ?? 'auto'}
                        canMoveLeft={columns.indexOf(item) > 0}
                        canMoveRight={columns.indexOf(item) < columns.length - 1}
                        onSetSort={onSetSort}
                        onSetColumnFilter={(filter) => onSetColumnFilter(item, filter)}
                        onSetWidth={(width) => onSetColumnWidth(item, width)}
                        onMove={(direction) => onMoveColumn(item, direction)}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle dark:divide-white/5">
              {companies.map((company) => renderRow(company))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2.5">
        {companies.map((company) => {
          const isSelected = selectedIds.has(company.id);
          return (
            <div
              key={company.id}
              onClick={() => onOpenDetails(company)}
              className={cn(
                'rounded-[12px] border border-subtle bg-surface p-3.5 transition-colors cursor-pointer',
                isSelected ? 'border-ai/40 bg-ai/5' : 'hover:border-ai/30',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
                    <SelectionCheckbox
                      checked={isSelected}
                      onChange={() => onToggleRow(company.id)}
                      label={t('companies.table.selectRow').replace('{name}', company.name)}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-text truncate flex items-center gap-2">
                      <CompanyIcon companyId={company.id} iconHash={company.iconHash} name={company.name} />
                      <span className="truncate">{company.name}</span>
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {[company.location, company.sector].filter(Boolean).join(' · ') || t('companies.table.noMeta')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()}>
                  <NextLink
                    href={`/dashboard/applications/companies/${company.id}`}
                    className="p-1.5 rounded-md text-slate-400 hover:text-text dark:hover:text-white"
                    title={t('companies.detail.viewApplications')}
                  >
                    <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
                  </NextLink>
                  <button
                    type="button"
                    onClick={() => onDelete(company)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-500"
                    aria-label={t('companies.table.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-text-muted border-t border-subtle/50 pt-2 font-sans">
                <span>
                  {t('companies.table.counts')
                    .replace('{applications}', String(company.applicationCount))
                    .replace('{notes}', String(company.noteCount))}
                </span>
                {company.website && (
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 text-ai hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 stroke-[1.75]" />
                    <span>{t('companies.table.openWebsite')}</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
