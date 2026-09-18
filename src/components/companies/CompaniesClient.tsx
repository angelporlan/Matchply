"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe,
  MapPin,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { CompanyListRow } from '@/lib/job-offer-queries';
import {
  createCompanyAction,
  deleteCompanyAction,
  deleteCompaniesAction,
} from '@/app/dashboard/applications/companies/actions';
import AlertModal from '@/components/ui/AlertModal';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import CompaniesTable from './CompaniesTable';
import type {
  CompanyColumnFilter,
  CompanyColumnId,
  CompanyColumnWidth,
  CompanyColumnWidths,
  CompanySortDirection,
  CompanySortKey,
  CompanySortState,
} from './CompanyColumnHeaderMenu';

const DEFAULT_COLUMNS: CompanyColumnId[] = [
  'name',
  'location',
  'sector',
  'website',
  'applicationCount',
  'noteCount',
  'updatedAt',
];

interface CompaniesClientProps {
  companies: CompanyListRow[];
}

function errorMessage(t: (key: string) => string, error?: string) {
  if (!error) return t('companies.errors.generic');
  const key = `companies.errors.${error}`;
  const translated = t(key);
  return translated === key ? t('companies.errors.generic') : translated;
}

export default function CompaniesClient({ companies: initialCompanies }: CompaniesClientProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [columns, setColumns] = useState<CompanyColumnId[]>(DEFAULT_COLUMNS);
  const [sort, setSort] = useState<CompanySortState>({ key: 'name', direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState<CompanyColumnFilter[]>([]);
  const [columnWidths, setColumnWidths] = useState<CompanyColumnWidths>({});
  const [actionsIndex, setActionsIndex] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', website: '', location: '', sector: '' });

  const [deleteTarget, setDeleteTarget] = useState<CompanyListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const filtered = useMemo(() => {
    let rows = [...initialCompanies];

    const needle = search.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((company) =>
        [company.name, company.location, company.sector, company.website]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }

    if (columnFilters.length > 0) {
      rows = rows.filter((company) =>
        columnFilters.every((filter) => {
          const val = (() => {
            switch (filter.column) {
              case 'name':
                return company.name;
              case 'location':
                return company.location ?? '';
              case 'sector':
                return company.sector ?? '';
              case 'website':
                return company.website ?? '';
              case 'applicationCount':
                return String(company.applicationCount);
              case 'noteCount':
                return String(company.noteCount);
              case 'updatedAt':
                return new Date(company.updatedAt).toISOString();
              default:
                return '';
            }
          })().toLowerCase();

          const target = filter.value.toLowerCase();
          if (filter.operator === 'equals') {
            return val === target;
          }
          return val.includes(target);
        }),
      );
    }

    rows.sort((a, b) => {
      const direction = sort.direction === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'name':
          return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) * direction;
        case 'location':
          return (a.location || '').localeCompare(b.location || '', 'es', { sensitivity: 'base' }) * direction;
        case 'sector':
          return (a.sector || '').localeCompare(b.sector || '', 'es', { sensitivity: 'base' }) * direction;
        case 'website':
          return (a.website || '').localeCompare(b.website || '', 'es', { sensitivity: 'base' }) * direction;
        case 'applicationCount':
          return (a.applicationCount - b.applicationCount) * direction;
        case 'noteCount':
          return (a.noteCount - b.noteCount) * direction;
        case 'updatedAt':
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
        default:
          return 0;
      }
    });

    return rows;
  }, [initialCompanies, search, columnFilters, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(filtered.length, startIdx + pageSize);
  const paginatedCompanies = filtered.slice(startIdx, endIdx);

  const handleSetSort = (key: CompanySortKey, direction: CompanySortDirection) => {
    setSort({ key, direction });
    setPage(1);
  };

  const handleSetColumnFilter = (column: CompanyColumnId, filter: CompanyColumnFilter | null) => {
    setColumnFilters((prev) => {
      const next = prev.filter((f) => f.column !== column);
      if (filter) next.push(filter);
      return next;
    });
    setPage(1);
  };

  const handleSetColumnWidth = (column: CompanyColumnId | 'actions', width: CompanyColumnWidth) => {
    setColumnWidths((prev) => ({ ...prev, [column]: width }));
  };

  const handleMoveColumn = (column: CompanyColumnId, direction: -1 | 1) => {
    setColumns((prev) => {
      const idx = prev.indexOf(column);
      if (idx === -1) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleMoveActions = (direction: -1 | 1) => {
    setActionsIndex((prev) => {
      const current = prev === null ? columns.length : prev;
      const next = Math.max(0, Math.min(columns.length, current + direction));
      return next;
    });
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
      if (checked) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearch('');
    setColumnFilters([]);
    setPage(1);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t('companies.errors.COMPANY_NAME_REQUIRED'));
      return;
    }
    setSaving(true);
    const result = await createCompanyAction({
      name: form.name,
      website: form.website,
      location: form.location,
      sector: form.sector,
    });
    setSaving(false);
    if ('error' in result) {
      setError(errorMessage(t, result.error));
      return;
    }
    setModalOpen(false);
    setForm({ name: '', website: '', location: '', sector: '' });
    router.push(`/dashboard/applications/companies/${result.company.id}`);
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteCompanyAction(deleteTarget.id);
    setDeleting(false);
    if ('error' in result && result.error) {
      if (result.error === 'COMPANY_HAS_APPLICATIONS') {
        showToast(
          t('companies.errors.COMPANY_HAS_APPLICATIONS')
            .replace('{count}', String(result.applicationCount ?? deleteTarget.applicationCount)),
        );
      } else {
        showToast(errorMessage(t, result.error));
      }
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteTarget.id);
      return next;
    });
    showToast(t('companies.toasts.deleted'));
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const result = await deleteCompaniesAction(ids);
    setBulkDeleting(false);
    setIsBulkDeleteOpen(false);
    if ('error' in result) {
      showToast(errorMessage(t, result.error));
      return;
    }

    setSelectedIds(new Set());
    if (result.skippedCount > 0) {
      showToast(
        t('companies.table.bulk.deletedSummary')
          .replace('{deleted}', String(result.deletedCount))
          .replace('{skipped}', String(result.skippedCount)),
      );
    } else {
      showToast(t('companies.toasts.deleted'));
    }
  };

  const hasActiveFilters = Boolean(search.trim() || columnFilters.length > 0);

  return (
    <div className="w-full md:flex md:flex-col md:flex-1 md:min-h-0">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[10px] bg-text text-canvas dark:bg-white dark:text-canvas px-4 py-2.5 text-xs font-semibold shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2.5 font-display">
            <Building2 className="w-6 h-6 text-ai stroke-[1.75]" />
            <span>{t('companies.title')}</span>
          </h2>
          <p className="text-text-muted text-sm mt-1 font-sans">{t('companies.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => { setError(null); setModalOpen(true); }}>
          <Plus className="w-4 h-4 stroke-[1.75]" />
          <span>{t('companies.newBtn')}</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-4 shrink-0">
        <label className="sr-only" htmlFor="companies-search">{t('companies.searchPlaceholder')}</label>
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted stroke-[1.75]" />
          <input
            id="companies-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t('companies.searchPlaceholder')}
            className="w-full bg-canvas border border-control rounded-[8px] pl-10 pr-10 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
              aria-label={t('companies.table.clearFilters')}
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          )}
        </div>
      </div>

      {/* Bulk Toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[12px] border border-ai/25 bg-ai/5 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-text font-display">
              {selectedIds.size === filtered.length
                ? t('companies.table.bulk.allSelected').replace('{count}', String(filtered.length))
                : t('companies.table.bulk.selected').replace('{count}', String(selectedIds.size))}
            </span>
            {selectedIds.size < filtered.length && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(filtered.map((c) => c.id)))}
                className="text-xs font-bold text-ai hover:underline underline-offset-2 ml-1 cursor-pointer"
              >
                {t('companies.table.bulk.selectAllCount').replace('{count}', String(filtered.length))}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold font-display transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>{t('companies.table.bulk.deleteSelected')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>{t('companies.table.bulk.clear')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table Component */}
      <CompaniesTable
        companies={paginatedCompanies}
        allSelectableIds={filtered.map((c) => c.id)}
        columns={columns}
        sort={sort}
        onSetSort={handleSetSort}
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
        onOpenDetails={(company) => router.push(`/dashboard/applications/companies/${company.id}`)}
        onDelete={(company) => setDeleteTarget(company)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onNewCompany={() => {
          setError(null);
          setModalOpen(true);
        }}
        attachedFooter={filtered.length > 0}
      />

      {/* Attached Footer with Pagination */}
      {filtered.length > 0 && (
        <div className="sticky bottom-0 z-20 mt-3 bg-canvas pb-4 md:static md:mt-0 md:shrink-0">
          <div className="rounded-[12px] border border-subtle bg-surface px-4 py-3 shadow-sm md:rounded-t-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-display">
            <p className="text-xs text-text-muted">
              {t('companies.table.pagination.showing')
                .replace('{start}', String(filtered.length === 0 ? 0 : startIdx + 1))
                .replace('{end}', String(endIdx))
                .replace('{total}', String(filtered.length))}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="companies-page-size" className="sr-only">
                {t('companies.table.pagination.perPage')}
              </label>
              <select
                id="companies-page-size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="bg-surface border border-subtle rounded-[8px] px-2.5 py-2 text-xs font-semibold text-text-muted focus:outline-none focus:border-ai transition-all cursor-pointer font-sans"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} {t('companies.table.pagination.perPageSuffix')}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage <= 1}
                aria-label={t('companies.table.pagination.previous')}
                className="p-2 rounded-[8px] border border-subtle bg-surface text-text-muted hover:text-text disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
              </button>
              <span className="text-xs font-semibold text-text-muted">
                {t('companies.table.pagination.page')
                  .replace('{page}', String(safePage))
                  .replace('{total}', String(totalPages))}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage >= totalPages}
                aria-label={t('companies.table.pagination.next')}
                className="p-2 rounded-[8px] border border-subtle bg-surface text-text-muted hover:text-text disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Empresa */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="relative w-full max-w-lg bg-surface border border-subtle rounded-2xl p-6 md:p-8 shadow-dialog overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-text flex items-center gap-2 font-display">
                  <Building2 className="w-5 h-5 text-ai stroke-[1.75]" />
                  <span>{t('companies.form.createTitle')}</span>
                </h3>
                <p className="text-xs text-text-muted mt-1 font-sans">
                  {t('companies.form.createDesc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-text dark:hover:text-white p-1 rounded-[8px] hover:bg-canvas dark:hover:bg-canvas/45 transition-all"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-[8px] font-medium font-sans relative z-10">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 relative z-10">
              <div>
                <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display mb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                  <span>{t('companies.form.name')}</span> *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder={t('companies.form.namePlaceholder')}
                  className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    <span>{t('companies.form.location')}</span>
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    placeholder={t('companies.form.locationPlaceholder')}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display mb-1.5">
                    <Tag className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    <span>{t('companies.form.sector')}</span>
                  </label>
                  <input
                    type="text"
                    value={form.sector}
                    onChange={(event) => setForm({ ...form, sector: event.target.value })}
                    placeholder={t('companies.form.sectorPlaceholder')}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display mb-1.5">
                  <Globe className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                  <span>{t('companies.form.website')}</span>
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(event) => setForm({ ...form, website: event.target.value })}
                  placeholder="https://ejemplo.com"
                  className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-text-muted hover:text-text rounded-[8px] transition-colors font-display"
                >
                  {t('editor.cancel')}
                </button>
                <Button type="submit" disabled={saving}>
                  {saving ? t('editor.saving') : t('companies.form.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AlertModal para Borrado Individual */}
      <AlertModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSingle}
        title={t('companies.delete.title')}
        message={t('companies.delete.message').replace('{name}', deleteTarget?.name || '')}
        confirmLabel={t('companies.delete.confirm')}
        cancelLabel={t('editor.cancel')}
        type="danger"
        isPending={deleting}
      />

      {/* AlertModal para Borrado Múltiple */}
      <AlertModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleDeleteBulk}
        title={t('companies.table.bulk.deleteConfirmTitle').replace('{count}', String(selectedIds.size))}
        message={t('companies.table.bulk.deleteConfirmMessage')}
        confirmLabel={t('companies.table.bulk.deleteSelected')}
        cancelLabel={t('editor.cancel')}
        type="danger"
        isPending={bulkDeleting}
      />
    </div>
  );
}
