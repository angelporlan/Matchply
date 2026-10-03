'use client';

import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function ApplicationSentPrompt({
  open,
  onYes,
  onNo,
  onDismiss,
}: {
  open: boolean;
  onYes: () => void;
  onNo: () => void;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div
        role="region"
        aria-label={t('editor.sentPrompt.question')}
        className="pointer-events-auto w-full max-w-lg bg-surface border border-subtle rounded-[12px] p-4 shadow-dialog"
      >
        <p className="text-sm font-medium text-text">{t('editor.sentPrompt.question')}</p>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            {t('editor.sentPrompt.later')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onNo}>
            {t('editor.sentPrompt.no')}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onYes}>
            {t('editor.sentPrompt.yes')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
