'use client';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { ModalScrim } from '@/components/ui/ModalScrim';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { OptimizeModeId } from '@/lib/optimize-modes';

export function CvVariantConfirm({ mode, onClose, onConfirm }: { mode: OptimizeModeId | null; onClose: () => void; onConfirm: () => void }) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!mode) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => dialog.current?.querySelector<HTMLButtonElement>('button')?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length-1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length-1]) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [mode]);
  if (!mode) return null;
  return <ModalScrim onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="variant-confirm-title" aria-describedby="variant-confirm-description" className="w-full max-w-md rounded-[12px] border border-subtle bg-surface p-6 shadow-dialog">
      <h2 id="variant-confirm-title" className="font-display text-xl font-semibold text-text">{t('variants.confirmTitle').replace('{mode}', t(`variants.names.${mode}`))}</h2>
      <div id="variant-confirm-description" className="mt-3 space-y-2 text-sm leading-6 text-text-muted">
        <p>{t(`variants.descriptions.${mode}`)}</p><p>{t('variants.confirmBody')}</p>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>{t('variants.cancel')}</Button>
        <Button variant="ai" onClick={onConfirm}>{t('variants.confirm')}</Button>
      </div>
    </div>
  </ModalScrim>;
}
