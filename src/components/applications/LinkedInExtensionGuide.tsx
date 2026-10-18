'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Puzzle, X } from 'lucide-react';
import { Button, ButtonLink, buttonClassName } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
function GuideDialog({ onClose, storeUrl }: { onClose: () => void; storeUrl: string | null }) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);

  function dismiss() {
    dialog.current?.close();
    onClose();
  }

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="extension-guide-title"
      aria-describedby="extension-guide-description"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-subtle bg-surface p-0 text-text shadow-dialog backdrop:bg-black/50"
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-muted">
              <Puzzle className="h-5 w-5" aria-hidden="true" /> Matchply · Chrome
            </div>
            <h2 id="extension-guide-title" className="font-display text-xl font-bold">{t('applications.extensionGuide.title')}</h2>
          </div>
          <Button type="button" variant="ghost" onClick={dismiss} aria-label={t('applications.extensionGuide.close')} className="min-w-11 shrink-0 px-2">
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <p id="extension-guide-description" className="mt-3 text-sm leading-relaxed text-text-muted">{t('applications.extensionGuide.description')}</p>

        <ol className="my-6 space-y-5">
          {['install', 'connect', 'capture', 'review'].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-bold" aria-hidden="true">{index + 1}</span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{t(`applications.extensionGuide.${step}Title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{t(`applications.extensionGuide.${step}Body`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-subtle bg-surface-muted p-4 text-sm leading-relaxed">
          <p className="font-semibold">{t('applications.extensionGuide.batchTitle')}</p>
          <p className="mt-1 text-text-muted">{t('applications.extensionGuide.batchBody')}</p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-text-muted">{t('applications.extensionGuide.controls')}</p>

        {!storeUrl && <p role="status" className="mt-5 text-sm text-text-muted">{t('applications.extensionGuide.comingSoon')}</p>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {storeUrl && <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={buttonClassName({ variant: 'secondary' })}>
            {t('applications.extensionGuide.installAction')} <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>}
          <ButtonLink href="/dashboard/profile?tab=integrations" variant="secondary">{t('applications.extensionGuide.connectAction')}</ButtonLink>
          <a href="https://www.linkedin.com/jobs/" target="_blank" rel="noopener noreferrer" className={buttonClassName({ variant: 'ghost' })}>
            {t('applications.extensionGuide.linkedinAction')} <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

export default function LinkedInExtensionGuide({ storeUrl = null }: { storeUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { t } = useLanguage();

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <>
      <Button ref={trigger} type="button" variant="ghost" onClick={() => setOpen(true)}
        aria-label={t('applications.extensionGuide.trigger')} title={t('applications.extensionGuide.trigger')}
        aria-haspopup="dialog" className="min-w-11 shrink-0 px-2">
        <Puzzle className="h-5 w-5" aria-hidden="true" />
      </Button>
      {open && <GuideDialog onClose={close} storeUrl={storeUrl} />}
    </>
  );
}
