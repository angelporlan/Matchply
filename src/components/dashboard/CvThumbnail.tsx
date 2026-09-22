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
import { A4DocumentSkeleton } from '@/components/skeletons';

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

    const controller = new AbortController();
    renderCvThumbnail(cvId, version, 560, controller.signal)
      .then((url) => {
        setDataUrl(url);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      });

    return () => {
      controller.abort();
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
        className={`w-full h-full flex flex-col items-center justify-center gap-1.5 bg-canvas text-text-muted ${className ?? ''}`}
      >
        <FileText className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
        <span className="text-[10px] font-medium font-sans px-2 text-center leading-tight">
          {t('dashboard.cvs.card.noPreview')}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className={`w-full h-full ${className ?? ''}`} aria-busy="true">
      <A4DocumentSkeleton compact className="w-full h-full" />
    </div>
  );
}
