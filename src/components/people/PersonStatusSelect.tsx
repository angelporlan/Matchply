"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Check, ChevronDown, Clock, Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { PERSON_STATUSES } from '@/lib/people/types';
import { statusLabel } from './ui';

export const PERSON_STATUS_STYLES: Record<
  string,
  {
    color: string;
    border: string;
    icon: 'clock' | 'send' | 'message' | 'sparkles' | 'archive';
  }
> = {
  pending: {
    color: 'text-ai-text bg-ai-surface',
    border: 'border-ai/20',
    icon: 'clock',
  },
  contacted: {
    color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'send',
  },
  conversation: {
    color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'message',
  },
  keep_in_touch: {
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'sparkles',
  },
  closed: {
    color: 'text-slate-500 dark:text-slate-400 bg-slate-500/10',
    border: 'border-slate-500/20',
    icon: 'archive',
  },
};

export function PersonStatusIcon({
  status,
  className = 'w-3 h-3 stroke-[1.75]',
}: {
  status: string;
  className?: string;
}) {
  switch (status) {
    case 'contacted':
      return <Send className={className} />;
    case 'conversation':
      return <MessageSquare className={className} />;
    case 'keep_in_touch':
      return <Sparkles className={className} />;
    case 'closed':
      return <Archive className={className} />;
    case 'pending':
    default:
      return <Clock className={className} />;
  }
}

export function PersonStatusBadge({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const { language } = useLanguage();
  const safeStatus = (PERSON_STATUSES as readonly string[]).includes(status) ? status : 'pending';
  const config = PERSON_STATUS_STYLES[safeStatus] || PERSON_STATUS_STYLES.pending;
  const label = statusLabel(safeStatus, language === 'en');

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${config.color} ${config.border} ${className}`}
    >
      <PersonStatusIcon status={safeStatus} />
      <span>{label}</span>
    </span>
  );
}

interface PersonStatusSelectProps {
  status: string;
  onChange: (status: string) => void;
  disabled?: boolean;
  saving?: boolean;
  className?: string;
  ariaLabel?: string;
}

const DROPDOWN_WIDTH = 195;
const ESTIMATED_HEIGHT = 200;

export default function PersonStatusSelect({
  status,
  onChange,
  disabled = false,
  saving = false,
  className = '',
  ariaLabel,
}: PersonStatusSelectProps) {
  const { language } = useLanguage();
  const en = language === 'en';
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

  const safeStatus = (PERSON_STATUSES as readonly string[]).includes(status) ? status : 'pending';
  const config = PERSON_STATUS_STYLES[safeStatus] || PERSON_STATUS_STYLES.pending;
  const label = statusLabel(safeStatus, en);

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
        aria-label={ariaLabel || (en ? 'Change status' : 'Cambiar estado')}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition-all disabled:opacity-60 ${config.color} ${config.border} hover:brightness-110`}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <PersonStatusIcon status={safeStatus} />}
        <span>{label}</span>
        <ChevronDown className="w-3 h-3 opacity-70 stroke-[2]" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={en ? 'Statuses' : 'Estados'}
          style={{ top: position.top, left: position.left, width: DROPDOWN_WIDTH }}
          className="fixed z-50 rounded-[10px] border border-subtle bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 font-sans"
        >
          {PERSON_STATUSES.map((option) => {
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
                  isActive ? 'bg-canvas dark:bg-surface-muted text-text' : 'hover:bg-canvas dark:hover:bg-surface-muted text-text-muted hover:text-text'
                }`}
              >
                <span className="flex items-center gap-2">
                  <PersonStatusIcon status={option} />
                  {statusLabel(option, en)}
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

export function PersonBulkStatusSelect({
  onChange,
  disabled = false,
  saving = false,
  className = '',
}: {
  onChange: (status: string) => void;
  disabled?: boolean;
  saving?: boolean;
  className?: string;
}) {
  const { language } = useLanguage();
  const en = language === 'en';
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
        aria-label={en ? 'Change status' : 'Cambiar estado'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-subtle rounded-[8px] text-xs font-semibold text-text bg-surface hover:bg-canvas transition-colors disabled:opacity-50"
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        <span>{en ? 'Change status' : 'Cambiar estado'}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70 stroke-[2]" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={en ? 'Statuses' : 'Estados'}
          style={{ top: position.top, left: position.left, width: DROPDOWN_WIDTH }}
          className="fixed z-50 rounded-[10px] border border-subtle bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 font-sans"
        >
          {PERSON_STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={false}
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen(false);
                onChange(option);
              }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold transition-colors hover:bg-canvas dark:hover:bg-surface-muted text-text-muted hover:text-text"
            >
              <span className="flex items-center gap-2">
                <PersonStatusIcon status={option} />
                {statusLabel(option, en)}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
