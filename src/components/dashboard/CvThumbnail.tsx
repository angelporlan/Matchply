'use client';

import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { FileText } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  cvThumbnailKey,
  getCachedCvThumbnail,
  renderCvThumbnail,
} from '@/lib/cv-thumbnail';

interface CvThumbnailProps {
  cvId: string;
  version: string | number;
  className?: string;
}

export default function CvThumbnail({ cvId, version, className }: CvThumbnailProps) {
  const { t } = useLanguage();
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '240px 0px' });
  const [dataUrl, setDataUrl] = useState<string | null>(() =>
    getCachedCvThumbnail(cvThumbnailKey(cvId, version)) ?? null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inView) return;

    const cached = getCachedCvThumbnail(cvThumbnailKey(cvId, version));
    if (cached) {
      setDataUrl(cached);
      return;
    }

    let cancelled = false;
    renderCvThumbnail(cvId, version)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [inView, cvId, version]);

  if (dataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUrl}
        alt=""
        className={`w-full h-full object-cover object-top ${className ?? ''}`}
      />
    );
  }

  if (failed) {
    return (
      <div
        ref={ref}
        className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-canvas text-text-muted ${className ?? ''}`}
      >
        <FileText className="w-6 h-6 stroke-[1.75]" aria-hidden="true" />
        <span className="text-[11px] font-medium font-sans px-4 text-center">
          {t('dashboard.cvs.card.noPreview')}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`w-full h-full bg-white flex flex-col gap-3 p-5 ${className ?? ''}`}
      aria-hidden="true"
    >
      <div className="h-3 w-2/5 rounded bg-surface-muted" />
      <div className="h-2 w-3/5 rounded bg-surface-muted" />
      <div className="mt-2 h-2 w-full rounded bg-surface-muted" />
      <div className="h-2 w-11/12 rounded bg-surface-muted" />
      <div className="h-2 w-4/5 rounded bg-surface-muted" />
      <div className="mt-3 h-2 w-1/3 rounded bg-surface-muted" />
      <div className="h-2 w-full rounded bg-surface-muted" />
      <div className="h-2 w-10/12 rounded bg-surface-muted" />
    </div>
  );
}
