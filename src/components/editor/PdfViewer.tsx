"use client";

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Eye, Download, Loader2, AlertTriangle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { A4PageSkeleton } from '@/components/skeletons';
import { GuestSavePrompt } from '@/components/cv/GuestSavePrompt';
import { consumeGuestSavePrompt } from '@/lib/guest-save-prompt';

export type PdfZoom = 'fit' | number;

export type PdfLivePreview = {
  content: string;
  templateName: string;
  accentColor: string;
  fontFamily: string;
  pageMargin: number;
  scale: number;
};

interface PdfViewerProps {
  cvId: string;
  /** Content version: changes whenever the saved PDF must be re-fetched. */
  version: number | string;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  liveContent?: string;
  templateName?: string;
  accentColor?: string;
  fontFamily?: string;
  pageMargin?: number;
  scale?: number;
  isAiStreaming?: boolean;
  isGuest?: boolean;
  guestCanDownload?: boolean;
  onGuestDownloadConsumed?: () => void;
  onDownloaded?: () => void;
  /** Debounced unsaved preview. When set, the sheet is rendered from this payload instead of the database. */
  livePreview?: PdfLivePreview | null;
  zoom?: PdfZoom;
  variant?: 'card' | 'sheet';
  onPageCount?: (pages: number) => void;
}

export function PdfDownloadLink({
  cvId,
  isGuest = false,
  guestCanDownload = false,
  onGuestDownloadConsumed,
  onDownloaded,
  className,
  children,
}: {
  cvId: string;
  isGuest?: boolean;
  guestCanDownload?: boolean;
  onGuestDownloadConsumed?: () => void;
  onDownloaded?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const downloadUrl = `/api/pdf?cvId=${cvId}&download=true`;
  const guestRegisterHref = '/register?source=guest-pdf';
  const guestDownloadLabel = guestCanDownload
    ? t('editor.pdf.guestDownloadBtn')
    : t('editor.pdf.guestDownloadUsed');
  const downloadHref = isGuest
    ? (guestCanDownload ? downloadUrl : guestRegisterHref)
    : downloadUrl;

  const handleGuestDownload = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isGuest) return;
    event.preventDefault();
    if (!guestCanDownload) {
      window.location.href = guestRegisterHref;
      return;
    }

    try {
      const response = await fetch(downloadUrl);
      if (response.status === 403) {
        onGuestDownloadConsumed?.();
        window.location.href = guestRegisterHref;
        return;
      }
      if (!response.ok) return;

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'CV.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      onGuestDownloadConsumed?.();
      onDownloaded?.();
      if (consumeGuestSavePrompt(sessionStorage)) setSavePromptOpen(true);
    } catch {
      // Keep the free download if the file never reached the browser.
    }
  };

  const handleAccountDownload = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onDownloaded) return;
    event.preventDefault();
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) return;
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'CV.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      onDownloaded();
    } catch {
      // Leave the candidacy untouched if the file never arrived.
    }
  };

  return (
    <>
      <a
        href={downloadHref}
        onClick={isGuest ? handleGuestDownload : (onDownloaded ? handleAccountDownload : undefined)}
        target={isGuest ? undefined : '_blank'}
        rel={isGuest ? undefined : 'noopener noreferrer'}
        className={className ?? 'btn-raised btn-raised--sm'}
      >
        {children ?? (
          <>
            <Download className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>{isGuest ? guestDownloadLabel : t('editor.pdf.downloadBtn')}</span>
          </>
        )}
      </a>
      <GuestSavePrompt open={savePromptOpen} onClose={() => setSavePromptOpen(false)} />
    </>
  );
}

function contentStamp(content: string): number {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function livePreviewKey(preview: PdfLivePreview | null | undefined): string {
  if (!preview) return '';
  return [
    preview.templateName,
    preview.accentColor,
    preview.fontFamily,
    preview.pageMargin,
    preview.scale,
    contentStamp(preview.content),
  ].join('|');
}

export default function PdfViewer({
  cvId,
  version,
  isFullScreen,
  onToggleFullScreen,
  liveContent,
  templateName = 'harvard',
  accentColor = '#1a5f7a',
  fontFamily = 'helvetica',
  pageMargin = 36,
  scale = 1.0,
  isAiStreaming = false,
  isGuest = false,
  guestCanDownload = false,
  onGuestDownloadConsumed,
  onDownloaded,
  livePreview = null,
  zoom = 'fit',
  variant = 'card',
  onPageCount,
}: PdfViewerProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [errorTimeout, setErrorTimeout] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const onPageCountRef = useRef(onPageCount);
  onPageCountRef.current = onPageCount;
  const livePreviewRef = useRef(livePreview);
  livePreviewRef.current = livePreview;
  const liveContentRef = useRef(liveContent);
  liveContentRef.current = liveContent;
  const styleRef = useRef({ templateName, accentColor, fontFamily, pageMargin, scale });
  styleRef.current = { templateName, accentColor, fontFamily, pageMargin, scale };

  useEffect(() => {
    return () => {
      if (blobUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const liveKey = livePreviewKey(livePreview);
  const fitted = zoom === 'fit';
  const percent = fitted ? 100 : zoom;

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    setLoading(true);
    setErrorTimeout(false);

    const timer = setTimeout(() => {
      if (active && !pdfBlobUrl) setErrorTimeout(true);
    }, 7000);

    const publishPages = (response: Response) => {
      const parsed = Number(response.headers.get('X-Pdf-Pages'));
      if (!Number.isFinite(parsed) || parsed < 1) return;
      setPageCount(parsed);
      onPageCountRef.current?.(parsed);
    };

    const fetchPdf = async () => {
      try {
        const preview = livePreviewRef.current;
        const streamingContent = isAiStreaming ? liveContentRef.current : '';
        let response: Response;
        if (preview) {
          response = await fetch('/api/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: preview.content,
              template: preview.templateName,
              accentColor: preview.accentColor || null,
              fontFamily: preview.fontFamily || 'helvetica',
              pageMargin: preview.pageMargin || 36,
              scale: preview.scale || 1.0,
            }),
          });
        } else if (streamingContent) {
          const style = styleRef.current;
          response = await fetch('/api/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: streamingContent,
              template: style.templateName,
              accentColor: style.accentColor || null,
              fontFamily: style.fontFamily || 'helvetica',
              pageMargin: style.pageMargin || 36,
              scale: style.scale || 1.0,
            }),
          });
        } else {
          response = await fetch(`/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`);
        }

        if (!response.ok) {
          throw new Error(`Server returned status: ${response.status}`);
        }
        publishPages(response);
        const blob = await response.blob();
        if (!active) return;

        localUrl = URL.createObjectURL(blob);
        blobUrlRef.current = localUrl;
        setPdfBlobUrl((prevUrl) => {
          if (prevUrl && prevUrl.startsWith('blob:') && prevUrl !== localUrl) URL.revokeObjectURL(prevUrl);
          return localUrl;
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching PDF preview blob:', error);
        if (active) {
          if (!pdfBlobUrl) {
            setPdfBlobUrl(`/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`);
          }
          setLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [version, cvId, retryKey, liveKey, isAiStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualReload = () => {
    setLoading(true);
    setErrorTimeout(false);
    setRetryKey((prev) => prev + 1);
  };

  const pageLabel = t('editor.pdf.pageIndicator')
    .replace('{current}', '1')
    .replace('{total}', String(pageCount ?? 1));

  // Screen zoom only. A numeric zoom grows an A4 sheet so the pane scrolls; it does not change print scale.
  const frameStyle: CSSProperties = fitted
    ? { width: '100%', height: '100%' }
    : { width: `${percent}%`, height: 'auto', aspectRatio: '210 / 297' };

  const shellClass = variant === 'sheet'
    ? 'flex flex-col h-full min-h-0 bg-surface-muted dark:bg-canvas relative'
    : 'flex flex-col h-full bg-surface border border-subtle rounded-2xl overflow-hidden shadow-sm relative transition-all duration-300';

  return (
    <div className={shellClass}>
      {variant === 'card' && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-canvas border-b border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Eye className="w-4 h-4 stroke-[1.75]" aria-hidden />
            </div>
            <span className="text-xs font-bold text-text tracking-wide uppercase font-display truncate">{t('editor.pdf.title')}</span>
            {loading && pdfBlobUrl && (
              <span className="flex items-center gap-1 text-[10px] text-text-muted font-semibold font-display ml-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden />
                {language === 'es' ? 'Actualizando vista previa...' : 'Updating preview...'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[10px] font-bold text-text bg-white dark:bg-surface border border-subtle px-3 py-1.5 rounded-[8px] shadow-sm font-mono">
              {pageLabel}
            </div>
            {onToggleFullScreen && (
              <button
                type="button"
                onClick={onToggleFullScreen}
                className="min-h-11 min-w-11 rounded-[8px] border border-subtle bg-canvas text-text-muted hover:text-text transition-colors flex items-center justify-center"
                aria-label={isFullScreen ? t('editor.pdf.fullScreenExit') : t('editor.pdf.fullScreenEnter')}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 stroke-[1.75]" aria-hidden />
                ) : (
                  <Maximize2 className="w-4 h-4 stroke-[1.75]" aria-hidden />
                )}
              </button>
            )}
            <PdfDownloadLink
              cvId={cvId}
              isGuest={isGuest}
              guestCanDownload={guestCanDownload}
              onGuestDownloadConsumed={onGuestDownloadConsumed}
              onDownloaded={onDownloaded}
            />
          </div>
        </div>
      )}

      <div className={`flex-1 min-h-0 relative flex ${variant === 'sheet' ? 'p-4 sm:p-6' : 'items-center justify-center p-4 bg-canvas/50 dark:bg-canvas/20'}`}>
        {loading && errorTimeout ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-canvas/90 z-10 gap-4 text-center px-6">
            <div className="p-3 bg-warning-surface text-warning-text rounded-full border border-warning-text/20">
              <AlertTriangle className="w-6 h-6 stroke-[1.75]" aria-hidden />
            </div>
            <div>
              <h4 className="text-sm font-bold text-text mb-1 font-display">{t('editor.pdf.timeoutTitle')}</h4>
              <p className="text-text-muted text-xs max-w-xs leading-relaxed">{t('editor.pdf.timeoutDesc')}</p>
            </div>
            <button
              type="button"
              onClick={handleManualReload}
              className="min-h-11 flex items-center gap-1.5 px-4 rounded-[8px] bg-surface border border-control text-xs font-bold text-text"
            >
              <RefreshCw className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden />
              <span>{t('editor.pdf.retry')}</span>
            </button>
          </div>
        ) : loading && !pdfBlobUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-canvas/80 dark:bg-canvas/70 z-10 p-4">
            <A4PageSkeleton className="max-h-[90%]" />
            <p className="sr-only">{t('editor.pdf.loading')}</p>
          </div>
        ) : null}

        {(pdfBlobUrl || errorTimeout) && (
          <div className={`w-full h-full min-h-[320px] overflow-auto ${variant === 'sheet' ? 'mx-auto max-w-[800px]' : ''}`}>
            <iframe
              src={pdfBlobUrl ? `${pdfBlobUrl}#toolbar=0&navpanes=0&view=FitH` : undefined}
              className={`block rounded-sm border border-subtle bg-white shadow-md ${fitted ? '' : 'mx-auto'}`}
              style={frameStyle}
              title={t('editor.pdf.title')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
