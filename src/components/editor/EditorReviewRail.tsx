"use client";

import { useEffect, useMemo, useState, type Ref } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Award,
  Briefcase,
  CheckCircle2,
  FileText,
  FolderGit2,
  GraduationCap,
  Info,
  Languages,
  Layers,
  Sparkles,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cvSectionChips, reviewCvMarkdown, type CvReviewIssue, type CvSectionChip } from '@/lib/cv-review';
import SectionForm from './SectionForm';

export type AdaptDraft = {
  jobTitle: string;
  company: string;
  url: string;
  platform: string;
  jobDescription: string;
  promptId: string;
  addToApplications: string;
};

export type LinkedOffer = {
  id: string;
  title: string;
  company: string;
  status?: string;
};

function sectionTarget(chip: CvSectionChip): 'contact' | number {
  return chip.kind === 'contact' ? 'contact' : Number(chip.id.slice('section-'.length));
}

function getSectionIcon(kind: 'contact' | 'section', title: string) {
  if (kind === 'contact') return User;
  const lower = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('perfil') || lower.includes('resumen') || lower.includes('summary') || lower.includes('about')) {
    return FileText;
  }
  if (lower.includes('experiencia') || lower.includes('experience') || lower.includes('laboral') || lower.includes('trabajo')) {
    return Briefcase;
  }
  if (lower.includes('proyecto') || lower.includes('project')) {
    return FolderGit2;
  }
  if (lower.includes('educaci') || lower.includes('education') || lower.includes('formaci') || lower.includes('estudios') || lower.includes('academ')) {
    return GraduationCap;
  }
  if (lower.includes('habilidad') || lower.includes('skill') || lower.includes('competencia') || lower.includes('tecnic') || lower.includes('stack')) {
    return Sparkles;
  }
  if (lower.includes('idioma') || lower.includes('language')) {
    return Languages;
  }
  if (lower.includes('certifica') || lower.includes('premio') || lower.includes('award') || lower.includes('logro')) {
    return Award;
  }
  return Layers;
}

function issueText(issue: CvReviewIssue, t: (key: string, replacements?: Record<string, string | number>) => string) {
  const section = issue.section ?? '';
  const entry = issue.entry ?? '';
  switch (issue.code) {
    case 'contact_ok':
      return t('editor.review.contactOk');
    case 'contact_missing_email':
      return t('editor.review.contactEmail');
    case 'contact_missing_phone':
      return t('editor.review.contactPhone');
    case 'summary_ok':
      return t('editor.review.summaryOk', { section });
    case 'summary_long':
      return t('editor.review.summaryLong', { section, words: issue.words ?? 0 });
    case 'summary_missing':
      return t('editor.review.summaryMissing');
    case 'entry_no_bullets':
      return t('editor.review.entryBullets', { entry, section });
    case 'entry_date':
      return t('editor.review.entryDate', { entry, section });
    default:
      return '';
  }
}

export default function EditorReviewRail({
  cvId,
  content,
  onContentChange,
  setSaveStatus,
  isBase,
  linkedOffer,
  pageCount,
  form,
  onFormChange,
  promptOptions,
  aiError,
  aiLoading,
  onSubmit,
  titleInputRef,
}: {
  cvId: string;
  content: string;
  onContentChange: (markdown: string) => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void;
  isBase: boolean;
  linkedOffer: LinkedOffer | null;
  pageCount: number | null;
  form: AdaptDraft;
  onFormChange: (next: AdaptDraft) => void;
  promptOptions: { id: string; label: string }[];
  aiError: string | null;
  aiLoading: boolean;
  onSubmit: () => void;
  titleInputRef?: Ref<HTMLInputElement>;
}) {
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<'contact' | number | null>(null);
  const chips = useMemo(() => cvSectionChips(content), [content]);
  const issues = useMemo(() => reviewCvMarkdown(content), [content]);
  const hasSections = chips.some((chip) => chip.kind === 'section');

  useEffect(() => {
    if (openSection === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      setOpenSection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSection]);
  const structural = issues.filter((issue) => !issue.code.startsWith('entry_'));
  const entries = issues.filter((issue) => issue.code.startsWith('entry_'));
  const shownEntries = entries.slice(0, 8);
  const hiddenEntries = entries.length - shownEntries.length;

  const pagesTone = pageCount == null ? 'info' : pageCount <= 1 ? 'ok' : 'info';
  const pagesText = pageCount == null
    ? t('editor.review.pagesPending')
    : pageCount <= 1
      ? t('editor.review.pagesOne')
      : t('editor.review.pagesMany', { count: pageCount });

  let targetText = t('editor.review.targetNone');
  if (isBase) targetText = t('editor.review.targetBase');
  else if (linkedOffer) targetText = t('editor.review.targetLinked', { title: linkedOffer.title, company: linkedOffer.company });

  const renderRow = (tone: 'ok' | 'warn' | 'info', text: string, key: string) => {
    const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : Info;
    const color = tone === 'ok'
      ? 'text-success-text'
      : tone === 'warn'
        ? 'text-warning-text'
        : 'text-info-text';
    return (
      <li key={key} className="flex gap-2 text-sm text-text leading-5">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 stroke-[1.75] ${color}`} aria-hidden />
        <span>{text}</span>
      </li>
    );
  };

  return (
    <aside className="h-full min-h-0 overflow-hidden bg-surface border-l border-subtle" aria-label={t('editor.review.title')}>
      {openSection !== null ? (
        <SectionForm
          cvId={cvId}
          content={content}
          target={openSection}
          onContentChange={onContentChange}
          setSaveStatus={setSaveStatus}
          onBack={() => setOpenSection(null)}
        />
      ) : (
      <div className="h-full min-h-0 overflow-y-auto">
      <div className="p-4 sm:p-5 space-y-5">
        <nav aria-label={t('editor.sections.label')} className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-sm font-bold text-text">
              {t('editor.sections.label')}
            </h2>
            <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-surface-muted text-text-muted border border-subtle">
              {chips.length}
            </span>
          </div>

          <ul className="flex flex-wrap gap-1.5 pt-0.5">
            {chips.map((chip) => {
              const label = chip.kind === 'contact' ? t('editor.sections.contact') : chip.title;
              const Icon = getSectionIcon(chip.kind, label);
              return (
                <li key={chip.id}>
                  <button
                    type="button"
                    data-section-id={chip.id}
                    title={label}
                    onClick={() => setOpenSection(sectionTarget(chip))}
                    className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-control bg-canvas text-xs font-semibold text-text hover:bg-surface-muted hover:border-text-muted/40 transition-colors shadow-2xs max-w-full"
                  >
                    <Icon className="w-3.5 h-3.5 text-text-muted group-hover:text-text shrink-0 stroke-[1.75]" aria-hidden />
                    <span className="truncate max-w-[140px]">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div>
          <h2 className="font-display text-sm font-bold text-text">{t('editor.review.title')}</h2>
          <p className="mt-1 text-xs leading-5 text-text-muted">{t('editor.review.disclaimer')}</p>
        </div>

        {!hasSections && (
          <p className="text-sm text-text">
            {t('editor.review.empty')}{' '}
            <Link href="/dashboard" className="underline font-semibold">
              {t('editor.review.emptyLink')}
            </Link>
          </p>
        )}

        <ul className="space-y-3">
          {renderRow(pagesTone, pagesText, 'pages')}
          {renderRow(linkedOffer && !isBase ? 'ok' : 'info', targetText, 'target')}
          {structural.map((issue) => renderRow(issue.tone, issueText(issue, t), issue.id))}
          {shownEntries.map((issue) => renderRow(issue.tone, issueText(issue, t), issue.id))}
        </ul>
        {hiddenEntries > 0 && (
          <p className="text-xs text-text-muted">{t('editor.review.moreIssues', { count: hiddenEntries })}</p>
        )}
        {linkedOffer && (
          <Link href={`/dashboard/applications/offer/${linkedOffer.id}`} className="inline-flex text-sm font-semibold text-text underline">
            {t('editor.review.viewApplication')}
          </Link>
        )}

        <form
          className="space-y-3 border-t border-subtle pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div>
            <h3 className="font-display text-sm font-bold text-text">{t('editor.review.adaptTitle')}</h3>
            <p className="mt-1 text-xs leading-5 text-text-muted">{t('editor.review.adaptHelp')}</p>
          </div>
          {aiError && (
            <p className="text-sm text-danger-text" role="alert">{aiError}</p>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-text">{t('editor.aiModal.jobTitle')}</span>
            <input
              ref={titleInputRef}
              value={form.jobTitle}
              onChange={(event) => onFormChange({ ...form, jobTitle: event.target.value })}
              placeholder={t('editor.aiModal.jobTitlePlaceholder')}
              className="w-full min-h-11 bg-canvas border border-control rounded-[8px] px-3 text-sm text-text"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-text">{t('editor.aiModal.company')}</span>
            <input
              value={form.company}
              onChange={(event) => onFormChange({ ...form, company: event.target.value })}
              placeholder={t('editor.aiModal.companyPlaceholder')}
              className="w-full min-h-11 bg-canvas border border-control rounded-[8px] px-3 text-sm text-text"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-text">{t('editor.aiModal.descLabel')}</span>
            <textarea
              value={form.jobDescription}
              onChange={(event) => onFormChange({ ...form, jobDescription: event.target.value })}
              placeholder={t('editor.aiModal.descPlaceholder')}
              rows={5}
              required
              className="w-full bg-canvas border border-control rounded-[8px] px-3 py-2 text-sm text-text"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.addToApplications === 'true'}
              onChange={(event) => onFormChange({ ...form, addToApplications: event.target.checked ? 'true' : 'false' })}
            />
            <span>
              <span className="font-semibold">{t('editor.aiModal.applications')}</span>
              <span className="block text-xs text-text-muted">{t('editor.aiModal.applicationsDesc')}</span>
            </span>
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-text">{t('editor.review.more')}</summary>
            <div className="mt-3 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-text">{t('editor.aiModal.link')}</span>
                <input
                  type="url"
                  value={form.url}
                  onChange={(event) => onFormChange({ ...form, url: event.target.value })}
                  placeholder="https://"
                  className="w-full min-h-11 bg-canvas border border-control rounded-[8px] px-3 text-sm text-text"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-text">{t('editor.aiModal.platform')}</span>
                <select
                  value={form.platform}
                  onChange={(event) => onFormChange({ ...form, platform: event.target.value })}
                  className="w-full min-h-11 bg-canvas border border-control rounded-[8px] px-3 text-sm text-text"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="infojobs">InfoJobs</option>
                  <option value="indeed">Indeed</option>
                  <option value="other">{t('editor.aiModal.platformOther')}</option>
                </select>
              </label>
              {promptOptions.length > 1 && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-text">{t('editor.aiModal.mode')}</span>
                  <select
                    value={form.promptId}
                    onChange={(event) => onFormChange({ ...form, promptId: event.target.value })}
                    className="w-full min-h-11 bg-canvas border border-control rounded-[8px] px-3 text-sm text-text"
                  >
                    {promptOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </details>
          <Button type="submit" variant="ai" disabled={aiLoading} loading={aiLoading}>
            {t('editor.header.adapt')}
          </Button>
        </form>
      </div>
      </div>
      )}
    </aside>
  );
}
