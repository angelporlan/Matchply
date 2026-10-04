'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/** A native modal dialog supplies focus containment and background inertness. */
export function PlanDialog({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useLanguage();
  useEffect(() => {
    if (!open || !dialog.current) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
      className="plan-dialog w-[calc(100%_-_2rem)] max-w-lg rounded-[12px] border border-control bg-surface text-text p-6 shadow-dialog max-h-[90dvh] overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-xl font-display font-semibold">{title}</h2>
        <button type="button" onClick={onClose} autoFocus aria-label={t('plans.close')} className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-[8px] border border-control">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      {children}
      <style jsx global>{`dialog.plan-dialog::backdrop { background: rgba(11, 15, 25, 0.65); }`}</style>
    </dialog>
  );
}
