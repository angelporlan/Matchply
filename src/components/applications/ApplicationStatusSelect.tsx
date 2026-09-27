"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Ban, Bookmark, Calendar, Check, ChevronDown, Loader2, PartyPopper, Send } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { APPLICATION_STATUSES } from '@/lib/application-views';

export const APPLICATION_STATUS_STYLES: Record<string, { color: string; border: string; icon: 'bookmark' | 'send' | 'calendar' | 'party' | 'ban' | 'archive' }> = {
  interested: { color: 'text-ai-text bg-ai-surface', border: 'border-ai/20', icon: 'bookmark' },
  applied: { color: 'text-blue-400 bg-blue-500/10', border: 'border-blue-500/20', icon: 'send' },
  interview: { color: 'text-amber-400 bg-amber-500/10', border: 'border-amber-500/20', icon: 'calendar' },
  offer: { color: 'text-emerald-400 bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'party' },
  rejected: { color: 'text-rose-400 bg-rose-500/10', border: 'border-rose-500/20', icon: 'ban' },
  archived: { color: 'text-slate-400 bg-slate-500/10', border: 'border-slate-500/20', icon: 'archive' },
};

export function ApplicationStatusIcon({ status, className = 'w-3 h-3 stroke-[1.75]' }: { status: string; className?: string }) {
  const safeStatus = status.startsWith('archived:') ? 'archived' : status;
  switch (safeStatus) {
    case 'applied':
      return <Send className={className} />;
    case 'interview':
      return <Calendar className={className} />;
    case 'offer':
      return <PartyPopper className={className} />;
    case 'rejected':
      return <Ban className={className} />;
    case 'archived':
      return <Archive className={className} />;
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

const DROPDOWN_WIDTH = 176;
const ESTIMATED_HEIGHT = 240;

export default function ApplicationStatusSelect({
  status,
  onChange,
  disabled = false,
  saving = false,
  className = '',
}: ApplicationStatusSelectProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const computePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.max(8, Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8));
    const menuHeight = menuRef.current?.offsetHeight || ESTIMATED_HEIGHT;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuHeight && rect.top >= menuHeight;

    const top = openAbove
      ? Math.max(8, rect.top - menuHeight - 4)
      : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8);

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    computePosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    const handleResize = () => setIsOpen(false);

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, computePosition]);

  const safeStatus = status.startsWith('archived:')
    ? 'archived'
    : ((APPLICATION_STATUSES as readonly string[]).includes(status) ? status : 'interested');
  const config = APPLICATION_STATUS_STYLES[safeStatus] || APPLICATION_STATUS_STYLES.interested;
  const rawLabel = t(`applications.columns.${safeStatus}.title`);
  const label = rawLabel.startsWith('applications.columns.') ? safeStatus : rawLabel;

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            if (!isOpen) computePosition();
            setIsOpen((prev) => !prev);
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('applications.table.statusLabel')}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition-all disabled:opacity-60 ${config.color} ${config.border} hover:brightness-110`}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ApplicationStatusIcon status={safeStatus} />}
        <span>{label}</span>
        <ChevronDown className="w-3 h-3 opacity-70 stroke-[2]" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{ top: position.top, left: position.left, width: DROPDOWN_WIDTH }}
          className="fixed z-50 rounded-[10px] border border-subtle bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 font-sans"
        >
          {APPLICATION_STATUSES.map((option) => {
            const optionConfig = APPLICATION_STATUS_STYLES[option];
            const isActive = option === safeStatus;
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
        </div>,
        document.body,
      )}
    </div>
  );
}
