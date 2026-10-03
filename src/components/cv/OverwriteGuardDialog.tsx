'use client';

import { Button } from '@/components/ui/Button';
import { ModalScrim } from '@/components/ui/ModalScrim';
import { OVERWRITE_UPGRADE_HREF } from '@/lib/free-overwrite-guard';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function OverwriteGuardDialog({
  open,
  replacesBase,
  intent,
  onReplace,
  onClose,
}: {
  open: boolean;
  replacesBase: boolean;
  intent: 'adapt' | 'import';
  onReplace: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  if (!open) return null;

  const body = intent === 'adapt'
    ? t(replacesBase ? 'dashboard.overwrite.bodyBase' : 'dashboard.overwrite.body')
    : t(replacesBase ? 'dashboard.overwrite.importBodyBase' : 'dashboard.overwrite.importBody');

  return (
    <ModalScrim>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="overwrite-guard-title"
        className="w-full max-w-md bg-surface border border-subtle rounded-[12px] p-6 shadow-dialog"
      >
        <h2 id="overwrite-guard-title" className="font-display text-lg font-bold text-text">
          {t('dashboard.overwrite.title')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('dashboard.overwrite.cancel')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => { window.location.href = OVERWRITE_UPGRADE_HREF; }}>
            {t('dashboard.overwrite.upgrade')}
          </Button>
          <Button type="button" variant="primary" onClick={onReplace}>
            {t('dashboard.overwrite.replace')}
          </Button>
        </div>
      </div>
    </ModalScrim>
  );
}
