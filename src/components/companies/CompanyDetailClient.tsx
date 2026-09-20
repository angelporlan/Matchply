'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Globe,
  MapPin,
  StickyNote,
  Tag,
  Trash2,
} from 'lucide-react';
import type { ApplicationSummary, CompanyListItem, CompanyNoteItem } from '@/lib/job-offer-queries';
import {
  createCompanyNoteAction,
  deleteCompanyNoteAction,
} from '@/app/dashboard/applications/companies/actions';
import CompanyIcon from '@/components/companies/CompanyIcon';
import ApplicationScoreBadge from '@/components/applications/ApplicationScoreBadge';
import AlertModal from '@/components/ui/AlertModal';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { formatDate } from '@/lib/utils';

interface CompanyDetailClientProps {
  company: CompanyListItem;
  notes: CompanyNoteItem[];
  offers: ApplicationSummary[];
  statusCounts: Record<string, number>;
}

function errorMessage(t: (key: string) => string, error?: string) {
  if (!error) return t('companies.errors.generic');
  const key = `companies.errors.${error}`;
  const translated = t(key);
  return translated === key ? t('companies.errors.generic') : translated;
}

export default function CompanyDetailClient({
  company,
  notes,
  offers,
  statusCounts,
}: CompanyDetailClientProps) {
  const { t } = useLanguage();
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<CompanyNoteItem | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleAddNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteContent.trim()) return;
    setSavingNote(true);
    const result = await createCompanyNoteAction(company.id, noteContent);
    setSavingNote(false);
    if ('error' in result && result.error) {
      showToast(errorMessage(t, result.error));
      return;
    }
    setNoteContent('');
    showToast(t('companies.toasts.noteAdded'));
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    setDeletingNote(true);
    const result = await deleteCompanyNoteAction(noteToDelete.id);
    setDeletingNote(false);
    setNoteToDelete(null);
    if ('error' in result && result.error) {
      showToast(errorMessage(t, result.error));
      return;
    }
    showToast(t('companies.toasts.noteDeleted'));
  };

  const websiteHref = company.website
    ? (company.website.startsWith('http') ? company.website : `https://${company.website}`)
    : null;

  const statusEntries = Object.entries(statusCounts).filter(([, count]) => count > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NextLink
          href="/dashboard/applications/companies"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-text"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          {t('companies.detail.back')}
        </NextLink>
        <NextLink
          href={`/dashboard/applications?company=${company.id}`}
          className="text-sm font-semibold text-ai hover:underline"
        >
          {t('companies.detail.viewApplications')}
        </NextLink>
      </div>

      <div className="bg-surface p-6 border border-subtle rounded-[12px] shadow-sm space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold text-text tracking-tight font-display flex items-center gap-2">
          {company.iconHash ? (
            <CompanyIcon companyId={company.id} iconHash={company.iconHash} name={company.name} size="md" />
          ) : (
            <Building2 className="w-6 h-6 text-ai shrink-0 stroke-[1.75]" />
          )}
          {company.name}
        </h1>
        <p className="text-sm text-text-muted">
          {t('companies.detail.summary')
            .replace('{applications}', String(offers.length))
            .replace('{notes}', String(notes.length))}
        </p>
        {statusEntries.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {statusEntries.map(([status, count]) => (
              <span
                key={status}
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-subtle bg-surface-muted text-text-muted"
              >
                {t(`applications.columns.${status}.title`)} · {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-sm font-bold font-display text-text mb-1">
              {t('companies.detail.infoTitle')}
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              {t('companies.detail.infoDesc')}
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-subtle">
            {/* Website */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-muted font-display block">
                {t('companies.form.website')}
              </span>
              {websiteHref ? (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ai hover:underline break-all"
                >
                  <Globe className="w-4 h-4 shrink-0 text-text-muted stroke-[1.75]" />
                  <span>{company.website}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </a>
              ) : (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Globe className="w-4 h-4 shrink-0 stroke-[1.75]" />
                  <span>—</span>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-muted font-display block">
                {t('companies.form.location')}
              </span>
              <div className="flex items-center gap-2 text-sm text-text">
                <MapPin className="w-4 h-4 shrink-0 text-text-muted stroke-[1.75]" />
                <span>{company.location || '—'}</span>
              </div>
            </div>

            {/* Sector */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-muted font-display block">
                {t('companies.form.sector')}
              </span>
              <div className="flex items-center gap-2 text-sm text-text">
                <Tag className="w-4 h-4 shrink-0 text-text-muted stroke-[1.75]" />
                {company.sector ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-text border border-subtle">
                    {company.sector}
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold font-display text-text flex items-center gap-2">
            <StickyNote className="w-4 h-4 stroke-[1.75]" />
            {t('companies.notes.title')}
          </h2>
          <form onSubmit={handleAddNote} className="space-y-2">
            <label className="sr-only" htmlFor="company-note">{t('companies.notes.placeholder')}</label>
            <textarea
              id="company-note"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              rows={3}
              placeholder={t('companies.notes.placeholder')}
              className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai font-sans resize-y min-h-[80px]"
            />
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={savingNote} disabled={!noteContent.trim()}>
                {t('companies.notes.add')}
              </Button>
            </div>
          </form>
          {notes.length === 0 ? (
            <p className="text-xs text-text-muted">{t('companies.notes.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-[8px] border border-subtle bg-canvas/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold text-text-muted">{formatDate(note.createdAt)}</p>
                    <button
                      type="button"
                      onClick={() => setNoteToDelete(note)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500"
                      aria-label={t('companies.notes.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                  </div>
                  <p className="text-sm text-text mt-1 whitespace-pre-wrap">{note.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold font-display text-text">{t('companies.detail.applicationsTitle')}</h2>
        {offers.length === 0 ? (
          <p className="text-xs text-text-muted">{t('companies.detail.applicationsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto scrollbar-custom">
            <table className="min-w-full text-left text-xs font-sans">
              <thead className="bg-surface-muted/70 text-[10px] uppercase tracking-wider text-text-muted font-display">
                <tr>
                  <th className="px-3 py-2.5">{t('applications.columns.labels.title')}</th>
                  <th className="px-3 py-2.5">{t('applications.columns.labels.status')}</th>
                  <th className="px-3 py-2.5">{t('applications.columns.labels.score')}</th>
                  <th className="px-3 py-2.5">{t('applications.columns.labels.updatedAt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-canvas/70">
                    <td className="px-3 py-2.5">
                      <NextLink
                        href={`/dashboard/applications/offer/${offer.id}`}
                        className="font-display font-bold text-text hover:text-ai hover:underline"
                      >
                        {offer.title}
                      </NextLink>
                    </td>
                    <td className="px-3 py-2.5 text-text-muted">{t(`applications.columns.${offer.status}.title`)}</td>
                    <td className="px-3 py-2.5"><ApplicationScoreBadge score={offer.scoreOverall} /></td>
                    <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">{formatDate(offer.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertModal
        isOpen={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(null)}
        type="danger"
        title={t('companies.notes.deleteTitle')}
        message={t('companies.notes.deleteMessage')}
        confirmLabel={t('companies.notes.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteNote}
        isPending={deletingNote}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[8px] bg-text text-canvas px-4 py-2.5 text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
