'use client';

import { useEffect, useState } from 'react';
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
  Trash2,
} from 'lucide-react';
import { CvListItem, CvTargetSummary } from '@/lib/job-offer-queries';
import { scoreToPercent } from '@/lib/application-views';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { timeAgo } from '@/lib/time-ago';
import { cn } from '@/lib/utils';
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
  guestCanDownload?: boolean;
  onGuestDownloadConsumed?: () => void;
}

function matchScoreClass(percent: number) {
  if (percent >= 75) return 'text-success-text bg-success-surface border-success-text/20';
  if (percent >= 50) return 'text-warning-text bg-warning-surface border-warning-text/20';
  return 'text-danger-text bg-danger-surface border-danger-text/20';
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
  guestCanDownload = false,
  onGuestDownloadConsumed,
}: CvCardProps) {
  const { t, language } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(cv.title);

  useEffect(() => {
    if (!isEditing) setDraft(cv.title);
  }, [cv.title, isEditing]);

  const matchPercent = scoreToPercent(target?.scoreOverall);
  const scoreLabel = matchPercent != null ? `${matchPercent}%` : null;

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
          void (async () => {
            if (!guestCanDownload) {
              window.location.href = '/register?source=guest-pdf';
              return;
            }
            const response = await fetch(`/api/pdf?cvId=${cv.id}&download=true`);
            if (response.status === 403) {
              onGuestDownloadConsumed?.();
              window.location.href = '/register?source=guest-pdf';
              return;
            }
            if (!response.ok) return;
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `${cv.title || 'CV'}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
            onGuestDownloadConsumed?.();
          })();
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
      className={cn(
        'group relative z-0 flex flex-col min-w-0 bg-surface rounded-[12px] border shadow-card',
        'motion-safe:transition-[border-color,box-shadow] motion-safe:duration-[140ms] motion-safe:ease-out',
        'hover:z-10 focus-within:z-10',
        cv.isPrincipal
          ? 'border-ai/40'
          : 'border-subtle hover:border-control hover:shadow-[0_2px_8px_rgba(30,27,75,0.08)]',
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 z-10 w-1 h-full rounded-l-[12px]"
        style={{ backgroundColor: cv.accentColor || '#1E1B4B' }}
      />

      <button
        type="button"
        onClick={() => onPreview(cv)}
        aria-label={t('dashboard.cvs.card.quickPreview')}
        className="group/preview relative mt-3 mr-3 ml-4 h-[9.5rem] sm:h-[12rem] rounded-[8px] bg-surface-muted overflow-hidden"
      >
        <span className="absolute left-1/2 top-2.5 -translate-x-1/2 w-[78%] max-w-[17rem] aspect-[210/297] rounded-[4px] bg-white border border-subtle shadow-card overflow-hidden">
          <CvThumbnail
            cvId={cv.id}
            version={new Date(cv.updatedAt).getTime()}
          />
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-muted to-transparent"
        />
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-black/40',
            'opacity-0 pointer-events-none',
            'motion-safe:transition-opacity motion-safe:duration-150',
            'group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100',
          )}
        >
          <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-text shadow-card">
            <Eye className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
            {t('dashboard.cvs.card.quickPreview')}
          </span>
        </span>
      </button>

      <div className="flex flex-col flex-1 min-w-0 gap-2 px-4 pl-5 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
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
                className="w-full bg-canvas border border-control rounded-[8px] px-2 py-1 text-base font-semibold text-text font-display focus:outline-none focus:border-ai"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title={t('dashboard.cvs.card.renameHint')}
                className="group/title flex items-start gap-1.5 w-full min-w-0 text-left text-base font-semibold text-text leading-snug font-display motion-safe:transition-colors hover:text-ai-text"
              >
                <span className="line-clamp-2 min-w-0 flex-1">{cv.title}</span>
                <Pencil
                  className="w-3 h-3 mt-1 shrink-0 opacity-0 group-hover/title:opacity-60 motion-safe:transition-opacity"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
          <DropdownMenu items={menuItems} label={t('dashboard.cvs.card.actions')} />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted font-sans">
          <span
            className={cn(
              'inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-[6px] border leading-tight',
              cv.isBase
                ? 'bg-ai-surface text-ai-text border-ai/20'
                : 'bg-surface-muted text-text-muted border-subtle',
            )}
          >
            {cv.isBase ? t('dashboard.cvs.card.base') : t('dashboard.cvs.card.copy')}
          </span>
          {cv.isPrincipal && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-[6px] border border-subtle bg-canvas text-text leading-tight">
              <Star className="w-3 h-3 fill-current" aria-hidden="true" />
              {t('dashboard.cvs.card.primary')}
            </span>
          )}
          <span className="inline-flex items-center gap-1 capitalize min-w-0">
            <FileText className="w-3.5 h-3.5 shrink-0 stroke-[1.75]" aria-hidden="true" />
            <span className="truncate">{cv.templateName}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {t('dashboard.cvs.card.updated', {
              time: timeAgo(cv.updatedAt, language as 'es' | 'en'),
            })}
          </span>
        </div>

        {target && (
          <div className="flex items-center gap-2 min-w-0 rounded-[8px] bg-surface-muted px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 min-w-0 flex-1 text-xs font-medium text-text font-sans">
              <Building2 className="w-3.5 h-3.5 shrink-0 stroke-[1.75] text-text-muted" aria-hidden="true" />
              <span className="truncate">
                {target.title} · {target.company}
              </span>
            </span>
            {scoreLabel && (
              <span
                title={t('dashboard.cvs.card.matchScore')}
                className={cn(
                  'inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-[6px] border shrink-0 font-sans tabular-nums',
                  matchScoreClass(matchPercent ?? 0),
                )}
              >
                {scoreLabel}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
          <Link
            href={`/editor/${cv.id}`}
            className="group/link inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai-hover motion-safe:transition-colors"
          >
            {t('dashboard.cvs.card.edit')}
            <ArrowRight
              className="w-3.5 h-3.5 stroke-[1.75] motion-safe:transition-transform motion-safe:group-hover/link:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>

          <button
            type="button"
            onClick={() => onSetPrincipal(cv.id)}
            disabled={cv.isPrincipal || isPending}
            aria-label={t('dashboard.cvs.card.setPrimary')}
            className={cn(
              'inline-flex p-1.5 rounded-[8px] border motion-safe:transition-colors',
              cv.isPrincipal
                ? 'bg-canvas text-text border-subtle'
                : 'border-transparent text-text-muted hover:text-text hover:border-subtle hover:bg-canvas',
            )}
          >
            <Star
              className={cn('w-3.5 h-3.5 stroke-[1.75]', cv.isPrincipal && 'fill-current')}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </article>
  );
}
