'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { signIn } from 'next-auth/react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { GUEST_POST_DOWNLOAD_REGISTER_HREF, guestPostDownloadClaimPath } from '@/lib/guest-save-prompt';

export function GuestSavePrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [googleLoading, setGoogleLoading] = useState(false);
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div
        role="region"
        aria-label={t('editor.pdf.savePrompt.body')}
        className="pointer-events-auto w-full max-w-xl bg-surface border border-subtle rounded-[12px] p-4 shadow-dialog"
      >
        <p className="text-sm leading-6 text-text">{t('editor.pdf.savePrompt.body')}</p>
        <div className="mt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('editor.pdf.savePrompt.dismiss')}
          </Button>
          <ButtonLink href={GUEST_POST_DOWNLOAD_REGISTER_HREF} variant="secondary" size="sm">
            {t('editor.pdf.savePrompt.email')}
          </ButtonLink>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={googleLoading}
            onClick={() => {
              setGoogleLoading(true);
              void signIn('google', { callbackUrl: guestPostDownloadClaimPath() });
            }}
          >
            {t('editor.pdf.savePrompt.google')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
