"use client";

import { useEffect, useRef, useState } from 'react';
import { Ban, Bookmark, Calendar, Check, ChevronDown, Loader2, PartyPopper, Send } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { APPLICATION_STATUSES } from '@/lib/application-views';

export const APPLICATION_STATUS_STYLES: Record<string, { color: string; border: string; icon: 'bookmark' | 'send' | 'calendar' | 'party' | 'ban' }> = {
  interested: { color: 'text-indigo-400 bg-indigo-500/10', border: 'border-indigo-500/20', icon: 'bookmark' },
  applied: { color: 'text-blue-400 bg-blue-500/10', border: 'border-blue-500/20', icon: 'send' },
  interview: { color: 'text-amber-400 bg-amber-500/10', border: 'border-amber-500/20', icon: 'calendar' },
  offer: { color: 'text-emerald-400 bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'party' },
  rejected: { color: 'text-rose-400 bg-rose-500/10', border: 'border-rose-500/20', icon: 'ban' },
};

export function ApplicationStatusIcon({ status, className = 'w-3 h-3 stroke-[1.75]' }: { status: string; className?: string }) {
  switch (status) {
    case 'applied':
      return <Send className={className} />;
    case 'interview':
      return <Calendar className={className} />;
    case 'offer':
      return <PartyPopper className={className} />;
    case 'rejected':
      return <Ban className={className} />;
    default:
      return <Bookmark className={className} />;
  }
}

interface ApplicationStatusSelectProps {
  status: string;
  onChange: (status: string) => void;
  disabled?: boolean;
  saving?: boolean;
  className?: string;
}

export default function ApplicationStatusSelect({
  status,
  onChange,
  disabled = false,
  saving = false,
  className = '',
}: ApplicationStatusSelectProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const config = APPLICATION_STATUS_STYLES[status] || APPLICATION_STATUS_STYLES.interested;

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('applications.table.statusLabel')}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition-all disabled:opacity-60 ${config.color} ${config.border} hover:brightness-110`}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ApplicationStatusIcon status={status} />}
        <span>{t(`applications.columns.${status}.title`)}</span>
        <ChevronDown className="w-3 h-3 opacity-70 stroke-[2]" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1.5 w-44 rounded-[10px] border border-subtle bg-surface p-1.5 shadow-xl animate-in fade-in duration-100"
        >
          {APPLICATION_STATUSES.map((option) => {
            const optionConfig = APPLICATION_STATUS_STYLES[option];
            const isActive = option === status;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsOpen(false);
                  if (option !== status) onChange(option);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold transition-colors ${
                  isActive ? 'bg-canvas dark:bg-surface-muted' : 'hover:bg-canvas dark:hover:bg-surface-muted text-text-muted'
                }`}
              >
                <span className="flex items-center gap-2 text-text">
                  <ApplicationStatusIcon status={option} />
                  {t(`applications.columns.${option}.title`)}
                </span>
                {isActive && <Check className="w-3.5 h-3.5 text-ai stroke-[2]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
