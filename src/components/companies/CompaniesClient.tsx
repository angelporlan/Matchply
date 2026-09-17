'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  Building2,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CompanyListRow } from '@/lib/job-offer-queries';
import {
  createCompanyAction,
  deleteCompanyAction,
} from '@/app/dashboard/applications/companies/actions';
import AlertModal from '@/components/ui/AlertModal';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { formatDate } from '@/lib/utils';

type SortKey = 'name' | 'applicationCount' | 'noteCount' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

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
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', website: '', location: '', sector: '' });
  const [deleteTarget, setDeleteTarget] = useState<CompanyListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = needle
      ? initialCompanies.filter((company) => (
        [company.name, company.location, company.sector, company.website]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      ))
      : [...initialCompanies];

    rows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) * direction;
      if (sortKey === 'applicationCount') return (a.applicationCount - b.applicationCount) * direction;
      if (sortKey === 'noteCount') return (a.noteCount - b.noteCount) * direction;
      return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
    });
    return rows;
  }, [initialCompanies, search, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDirection(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sortLabel = (key: SortKey) => (
    sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
  ) as 'ascending' | 'descending' | 'none';

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
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
    router.refresh();
  };

  const handleDelete = async () => {
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
    showToast(t('companies.toasts.deleted'));
    router.refresh();
  };

  const headerButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 hover:text-text transition-colors"
    >
      {label}
    </button>
  );

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2 font-display">
            <Building2 className="w-6 h-6 text-ai stroke-[1.75]" />
            {t('companies.title')}
          </h2>
          <p className="text-text-muted text-sm mt-1 font-sans">{t('companies.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => { setError(null); setModalOpen(true); }}>
          <Plus className="w-4 h-4 stroke-[1.75]" />
          {t('companies.newBtn')}
        </Button>
      </div>

      <div className="mb-4">
        <label className="sr-only" htmlFor="companies-search">{t('companies.searchPlaceholder')}</label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted stroke-[1.75]" />
          <input
            id="companies-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('companies.searchPlaceholder')}
            className="w-full bg-surface border border-control rounded-[8px] pl-9 pr-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai font-sans"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-subtle bg-surface/50 p-12 text-center">
          <Building2 className="w-8 h-8 mx-auto mb-3 text-text-muted opacity-60 stroke-[1.75]" />
          <p className="text-sm font-bold text-text font-display">
            {search.trim() ? t('companies.empty.searchTitle') : t('companies.empty.title')}
          </p>
          <p className="text-xs text-text-muted font-sans mt-1">
            {search.trim() ? t('companies.empty.searchDesc') : t('companies.empty.desc')}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block border border-subtle bg-surface shadow-sm rounded-[12px] overflow-hidden">
            <div className="overflow-x-auto scrollbar-custom">
              <table className="min-w-full text-left text-xs font-sans">
                <caption className="sr-only">{t('companies.table.caption')}</caption>
                <thead className="bg-surface-muted/70 dark:bg-canvas/40 text-[10px] uppercase tracking-wider text-text-muted font-display">
                  <tr>
                    <th scope="col" className="px-3 py-3" aria-sort={sortLabel('name')}>{headerButton('name', t('companies.table.name'))}</th>
                    <th scope="col" className="px-3 py-3">{t('companies.table.location')}</th>
                    <th scope="col" className="px-3 py-3">{t('companies.table.sector')}</th>
                    <th scope="col" className="px-3 py-3">{t('companies.table.website')}</th>
                    <th scope="col" className="px-3 py-3" aria-sort={sortLabel('applicationCount')}>{headerButton('applicationCount', t('companies.table.applications'))}</th>
                    <th scope="col" className="px-3 py-3" aria-sort={sortLabel('noteCount')}>{headerButton('noteCount', t('companies.table.notes'))}</th>
                    <th scope="col" className="px-3 py-3" aria-sort={sortLabel('updatedAt')}>{headerButton('updatedAt', t('companies.table.updatedAt'))}</th>
                    <th scope="col" className="px-3 py-3 text-right">{t('companies.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle dark:divide-white/5">
                  {filtered.map((company) => (
                    <tr
                      key={company.id}
                      onClick={() => router.push(`/dashboard/applications/companies/${company.id}`)}
                      className="cursor-pointer hover:bg-canvas/70 dark:hover:bg-canvas/20 transition-colors"
                    >
                      <td className="px-3 py-2.5 font-display font-bold text-text">{company.name}</td>
                      <td className="px-3 py-2.5 text-text-muted">{company.location || '—'}</td>
                      <td className="px-3 py-2.5 text-text-muted">{company.sector || '—'}</td>
                      <td className="px-3 py-2.5">
                        {company.website ? (
                          <a
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-ai hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                            {t('companies.table.openWebsite')}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-text">{company.applicationCount}</td>
                      <td className="px-3 py-2.5 text-text">{company.noteCount}</td>
                      <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">{formatDate(company.updatedAt)}</td>
                      <td className="px-3 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(company)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          aria-label={t('companies.table.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-2.5">
            {filtered.map((company) => (
              <NextLink
                key={company.id}
                href={`/dashboard/applications/companies/${company.id}`}
                className="block rounded-[12px] border border-subtle bg-surface p-3.5 hover:border-ai/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-text truncate">{company.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {[company.location, company.sector].filter(Boolean).join(' · ') || t('companies.table.noMeta')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setDeleteTarget(company);
                    }}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-500"
                    aria-label={t('companies.table.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                </div>
                <p className="text-[11px] text-text-muted mt-2">
                  {t('companies.table.counts')
                    .replace('{applications}', String(company.applicationCount))
                    .replace('{notes}', String(company.noteCount))}
                </p>
              </NextLink>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1e1b4b]/40 dark:bg-black/60 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-subtle rounded-[12px] p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-text font-display">{t('companies.form.createTitle')}</h3>
                <p className="text-xs text-text-muted mt-1">{t('companies.form.createDesc')}</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-text-muted hover:text-text">
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-[8px]">
                {error}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label={t('companies.form.name')} required>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={t('companies.form.namePlaceholder')}
                  className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai font-sans"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('companies.form.website')}>
                  <input
                    value={form.website}
                    onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai font-sans"
                  />
                </Field>
                <Field label={t('companies.form.location')}>
                  <input
                    value={form.location}
                    onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                    placeholder={t('companies.form.locationPlaceholder')}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai font-sans"
                  />
                </Field>
              </div>
              <Field label={t('companies.form.sector')}>
                <input
                  value={form.sector}
                  onChange={(event) => setForm((prev) => ({ ...prev, sector: event.target.value }))}
                  placeholder={t('companies.form.sectorPlaceholder')}
                  className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai font-sans"
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={saving}>
                  {t('companies.form.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        type="danger"
        title={t('companies.delete.title')}
        message={t('companies.delete.message').replace('{name}', deleteTarget?.name || '')}
        confirmLabel={t('companies.delete.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDelete}
        isPending={deleting}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[8px] bg-text text-canvas px-4 py-2.5 text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-text-muted font-display">
        {label}{required ? ' *' : ''}
      </label>
      {children}
    </div>
  );
}
