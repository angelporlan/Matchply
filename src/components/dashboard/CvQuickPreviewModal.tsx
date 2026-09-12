'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { CvListItem } from '@/lib/job-offer-queries';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const PdfViewer = dynamic(() => import('@/components/editor/PdfViewer'), {
  ssr: false,
});

interface CvQuickPreviewModalProps {
  cv: CvListItem;
  onClose: () => void;
}

export default function CvQuickPreviewModal({ cv, onClose }: CvQuickPreviewModalProps) {
  const { t } = useLanguage();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={t('dashboard.cvs.card.preview')}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl h-[90vh] flex flex-col bg-surface border border-subtle rounded-2xl shadow-dialog overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-subtle shrink-0">
          <div className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wider font-bold text-text-muted font-sans">
              {t('dashboard.cvs.card.preview')}
            </span>
            <h3 className="text-sm font-bold text-text font-display truncate">{cv.title}</h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-[8px] border border-subtle bg-canvas text-text-muted hover:text-text dark:hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3 sm:p-4 bg-canvas/40">
          <PdfViewer cvId={cv.id} version={new Date(cv.updatedAt).getTime()} />
        </div>
      </div>
    </div>
  );
}
