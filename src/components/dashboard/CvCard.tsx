'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Copy,
  Download,
  Eye,
  FileText,
  Pencil,
  Star,
  Target,
  Trash2,
} from 'lucide-react';
import { CvListItem, CvTargetSummary } from '@/lib/job-offer-queries';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { timeAgo } from '@/lib/time-ago';
import DropdownMenu, { DropdownMenuItem } from '@/components/ui/DropdownMenu';
import CvThumbnail from './CvThumbnail';

interface CvCardProps {
  cv: CvListItem;
  target?: CvTargetSummary;
  isGuest?: boolean;
  isPending: boolean;
  onPreview: (cv: CvListItem) => void;
  onSetPrincipal: (cvId: string) => void;
  onRename: (cvId: string, title: string) => void;
  onDuplicate: (cvId: string) => void;
  onDelete: (cvId: string) => void;
}

export default function CvCard({
  cv,
  target,
  isGuest = false,
  isPending,
  onPreview,
  onSetPrincipal,
  onRename,
  onDuplicate,
  onDelete,
}: CvCardProps) {
  const { t, language } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(cv.title);

  if (!isEditing && draft !== cv.title) {
    setDraft(cv.title);
  }

  const scoreLabel =
    target?.scoreOverall != null
      ? target.scoreOverall > 5
        ? `${target.scoreOverall.toFixed(0)}%`
        : target.scoreOverall.toFixed(1)
      : null;

  const commitRename = () => {
    const next = draft.trim().replace(/\s+/g, ' ');
    setIsEditing(false);
    if (!next || next === cv.title) {
      setDraft(cv.title);
      return;
    }
    onRename(cv.id, next);
  };

  const menuItems: DropdownMenuItem[] = [
    {
      label: t('dashboard.cvs.card.quickPreview'),
      icon: <Eye className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />,
      onSelect: () => onPreview(cv),
    },
    {
      label: t('dashboard.cvs.card.rename'),
      icon: <Pencil className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />,
      onSelect: () => setIsEditing(true),
    },
    {
      label: t('dashboard.cvs.card.duplicate'),
      icon: <Copy className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />,
      onSelect: () => onDuplicate(cv.id),
    },
    {
      label: t('dashboard.cvs.card.download'),
      icon: <Download className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />,
      onSelect: () => {
        if (isGuest) {
          window.location.href = '/register';
          return;
        }
        window.open(`/api/pdf?cvId=${cv.id}&download=true`, '_blank', 'noopener,noreferrer');
      },
    },
    ...(!cv.isPrincipal
      ? [
          {
            label: t('dashboard.cvs.card.setPrimary'),
            icon: <Star className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />,
            onSelect: () => onSetPrincipal(cv.id),
          },
        ]
      : []),
    {
      label: t('dashboard.cvs.card.delete'),
      icon: <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />,
      onSelect: () => onDelete(cv.id),
      destructive: true,
    },
  ];

  return (
    <article
      className={`group relative flex flex-col bg-surface rounded-[12px] border shadow-card transition-colors ${
        cv.isPrincipal ? 'border-ai/40' : 'border-subtle hover:border-control'
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 w-1.5 h-full rounded-l-[12px]"
        style={{ backgroundColor: cv.isPrincipal ? '#8B5CF6' : cv.accentColor || '#1E1B4B' }}
      />

      <div className="relative m-3 ml-5 rounded-[8px] border border-subtle overflow-hidden bg-white aspect-[210/297]">
        <CvThumbnail
          cvId={cv.id}
          version={new Date(cv.updatedAt).getTime()}
        />

        <div className="absolute inset-0 hidden sm:flex flex-col items-center justify-center gap-2 bg-black/45 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
          <button
            type="button"
            onClick={() => onPreview(cv)}
            className="btn-raised btn-raised--secondary btn-raised--sm"
          >
            <Eye className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
            {t('dashboard.cvs.card.quickPreview')}
          </button>
          <Link
            href={`/editor/${cv.id}`}
            className="btn-raised btn-raised--strong btn-raised--sm"
          >
            <Pencil className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
            {t('dashboard.cvs.card.edit')}
          </Link>
        </div>
      </div>

      <div className="flex flex-col flex-1 gap-3 px-4 pl-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-[6px] border ${
                cv.isBase
                  ? 'bg-ai-surface text-ai-text border-ai/20'
                  : 'bg-surface-muted text-text-muted border-subtle'
              }`}
            >
              {cv.isBase ? t('dashboard.cvs.card.base') : t('dashboard.cvs.card.copy')}
            </span>
            {cv.isPrincipal && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[6px] border border-subtle bg-canvas text-text-muted">
                <Star className="w-3 h-3 fill-current" aria-hidden="true" />
                {t('dashboard.cvs.card.primary')}
              </span>
            )}
          </div>

          <DropdownMenu items={menuItems} label={t('dashboard.cvs.card.actions')} />
        </div>

        <div className="min-h-[2.75rem]">
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              maxLength={120}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitRename();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setIsEditing(false);
                  setDraft(cv.title);
                }
              }}
              aria-label={t('dashboard.cvs.card.rename')}
              className="w-full bg-canvas border border-control rounded-[8px] px-2 py-1 text-base font-bold text-text font-display focus:outline-none focus:border-ai"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title={t('dashboard.cvs.card.renameHint')}
              className="group/title flex items-start gap-1.5 text-left text-base font-bold text-text leading-snug font-display transition-colors hover:text-ai-text"
            >
              <span className="line-clamp-2">{cv.title}</span>
              <Pencil
                className="w-3 h-3 mt-1 shrink-0 opacity-0 group-hover/title:opacity-60 transition-opacity"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted font-sans">
          <span className="inline-flex items-center gap-1 capitalize">
            <FileText className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
            {cv.templateName}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t('dashboard.cvs.card.updated', {
              time: timeAgo(cv.updatedAt, language as 'es' | 'en'),
            })}
          </span>
        </div>

        {target && (
          <div className="flex items-center justify-between gap-3 rounded-[8px] border border-subtle bg-canvas/50 px-3 py-2">
            <div className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-text-muted font-sans">
                {t('dashboard.cvs.card.target')}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-text truncate font-sans">
                <Building2 className="w-3.5 h-3.5 shrink-0 stroke-[1.75]" aria-hidden="true" />
                <span className="truncate">
                  {target.title} · {target.company}
                </span>
              </span>
            </div>
            {scoreLabel && (
              <span
                title={t('dashboard.cvs.card.matchScore')}
                className="inline-flex items-center gap-1 text-xs font-bold text-ai-text bg-ai-surface border border-ai/20 px-2 py-0.5 rounded-[6px] shrink-0 font-sans"
              >
                <Target className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
                {scoreLabel}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-subtle pt-3">
          <Link
            href={`/editor/${cv.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai-hover transition-colors"
          >
            {t('dashboard.cvs.card.edit')}
            <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => onPreview(cv)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text transition-colors sm:hidden"
          >
            <Eye className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
            {t('dashboard.cvs.card.preview')}
          </button>

          <button
            type="button"
            onClick={() => onSetPrincipal(cv.id)}
            disabled={cv.isPrincipal || isPending}
            aria-label={t('dashboard.cvs.card.setPrimary')}
            className={`hidden sm:inline-flex p-1.5 rounded-[8px] border transition-colors ${
              cv.isPrincipal
                ? 'bg-ai-surface text-ai-text border-ai/20'
                : 'border-transparent text-text-muted hover:text-ai-text hover:border-subtle hover:bg-canvas'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 stroke-[1.75] ${cv.isPrincipal ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </article>
  );
}
