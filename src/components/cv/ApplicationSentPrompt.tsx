'use client';

import { createPortal } from 'react-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function ApplicationSentPrompt({
  open,
  context,
  hasDocument,
  exportId,
  onYes,
  onNo,
  onDismiss,
}: {
  open: boolean;
  context?: string;
  hasDocument?: boolean;
  exportId?: string | null;
  onYes: (withoutDocument?: boolean) => void | Promise<void>;
  onNo: () => void;
  onDismiss: () => void;
}) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const confirm = async (withoutDocument = false) => { if (busy) return; setBusy(true); try { await onYes(withoutDocument); } finally { setBusy(false); } };
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div
        role="region"
        aria-label={t('editor.sentPrompt.question')}
        className="pointer-events-auto w-full max-w-lg bg-surface border border-subtle rounded-[12px] p-4 shadow-dialog"
      >
        <p className="text-sm font-medium text-text">{t('editor.sentPrompt.question')}</p>
        {context && <p className="mt-2 text-sm">{context}</p>}
        <p className="mt-2 text-xs text-text-muted">{hasDocument ? (language === 'es' ? 'Se conservará el PDF de tu última descarga. Confirma que es el que enviaste.' : 'The PDF from your last download will be retained. Confirm it is the one you submitted.') : (language === 'es' ? 'Envío sin documento conservado.' : 'Submission without a retained document.')}</p>
        {exportId && <a className="mt-2 inline-flex min-h-11 items-center text-sm underline" href={`/api/cv/exports/${exportId}`}>{language === 'es' ? 'Revisar PDF conservado' : 'Review retained PDF'}</a>}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            {t('editor.sentPrompt.later')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onNo}>
            {t('editor.sentPrompt.no')}
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={busy} onClick={() => void confirm()}>
            {t('editor.sentPrompt.yes')}
          </Button>
          {hasDocument && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void confirm(true)}>{language === 'es' ? 'Enviada sin documento' : 'Submitted without document'}</Button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
