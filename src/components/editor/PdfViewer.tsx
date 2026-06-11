"use client";

import { useState, useEffect } from 'react';
import { Eye, Download, Loader2, AlertTriangle, RefreshCw, Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface PdfViewerProps {
  cvId: string;
  version: number;
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
  isGuest = false
}: PdfViewerProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [errorTimeout, setErrorTimeout] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  
  // Interactive zoom state
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    setLoading(true);
    setErrorTimeout(false);

    // Configurar un timeout de 7 segundos para evitar bucles infinitos de carga (solo si no hay PDF previo)
    const timer = setTimeout(() => {
      if (active && !pdfBlobUrl) setErrorTimeout(true);
    }, 7000);

    const fetchPdf = async () => {
      try {
        let response;
        if (isAiStreaming && liveContent) {
          // Usar POST para renderizado en tiempo real a partir del estado de la UI
          response = await fetch(`/api/pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: liveContent,
              template: templateName,
              accentColor: accentColor || null,
              fontFamily: fontFamily || 'helvetica',
              pageMargin: pageMargin || 36,
              scale: scale || 1.0
            })
          });
        } else {
          // Carga estándar mediante GET leyendo de base de datos
          response = await fetch(`/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`);
        }

        if (!response.ok) {
          throw new Error(`Server returned status: ${response.status}`);
        }
        const blob = await response.blob();
        if (!active) return;

        localUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(prevUrl => {
          if (prevUrl) {
            URL.revokeObjectURL(prevUrl);
          }
          return localUrl;
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching PDF preview blob:', error);
        if (active) {
          if (!pdfBlobUrl) {
            // Fallback a URL directa si falla la descarga de blob inicial
            const fallbackUrl = `/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`;
            setPdfBlobUrl(fallbackUrl);
          }
          setLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      active = false;
      clearTimeout(timer);
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [version, cvId, retryKey]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const pdfUrl = `/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`;

  const handleManualReload = () => {
    setLoading(true);
    setErrorTimeout(false);
    setRetryKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f1423]/75 border border-[#1e1b4b]/10 dark:border-slate-900 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl relative transition-all duration-300">
      
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#fafafa] dark:bg-[#131a2e] border-b border-[#1e1b4b]/10 dark:border-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Eye className="w-4 h-4 stroke-[1.75]" />
          </div>
          <span className="text-xs font-bold text-[#1e1b4b] dark:text-slate-200 tracking-wide uppercase font-display">{t('editor.pdf.title')}</span>
          {loading && pdfBlobUrl && (
            <span className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-semibold font-display animate-pulse ml-3 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {language === 'es' ? 'Actualizando vista previa...' : 'Updating preview...'}
            </span>
          )}
        </div>

        {/* Grouped controls: Zoom, Page Number, and Download Button */}
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-[#1e1b4b]/10 dark:border-slate-800 rounded-[8px] p-0.5 shadow-sm">
            <button
              onClick={() => setZoom(prev => Math.max(50, prev - 10))}
              className="p-1 text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#1e1b4b]/5 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={t('editor.pdf.zoomOut')}
            >
              <Minus className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
            <span className="text-[10px] font-bold text-[#1e1b4b] dark:text-slate-200 px-2 min-w-[36px] text-center font-mono">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(150, prev + 10))}
              className="p-1 text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#1e1b4b]/5 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={t('editor.pdf.zoomIn')}
            >
              <Plus className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>
          </div>

          {/* Page number */}
          <div className="text-[10px] font-bold text-[#1e1b4b] dark:text-slate-300 bg-white dark:bg-slate-900 border border-[#1e1b4b]/10 dark:border-slate-800 px-3 py-1.5 rounded-[8px] shadow-sm font-mono">
            {t('editor.pdf.pageIndicator').replace('{current}', '1').replace('{total}', '1')}
          </div>

          {/* Full Screen toggle button */}
          {onToggleFullScreen && (
            <button
              type="button"
              onClick={onToggleFullScreen}
              className="p-1.5 rounded-[8px] border border-[#1e1b4b]/10 dark:border-slate-800 bg-white dark:bg-[#0b0f19] text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white transition-all shadow-sm flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 shrink-0"
              title={isFullScreen ? t('editor.pdf.fullScreenExit') : t('editor.pdf.fullScreenEnter')}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 stroke-[1.75]" />
              ) : (
                <Maximize2 className="w-4 h-4 stroke-[1.75]" />
              )}
            </button>
          )}

          {/* Download PDF button */}
          <a
            href={isGuest ? '/register' : `/api/pdf?cvId=${cvId}&download=true`}
            target={isGuest ? undefined : "_blank"}
            rel={isGuest ? undefined : "noopener noreferrer"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>{isGuest ? (language === 'es' ? 'Guardar y descargar' : 'Save and download') : t('editor.pdf.downloadBtn')}</span>
          </a>
        </div>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 bg-[#fafafa]/50 dark:bg-slate-950/20 relative flex items-center justify-center p-4 overflow-hidden">
        {loading && errorTimeout ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-[#030712]/90 backdrop-blur-md z-10 gap-4 text-center px-6 transition-all">
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20 shadow-sm">
              <AlertTriangle className="w-6 h-6 animate-pulse stroke-[1.75]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1e1b4b] dark:text-white mb-1 font-display">{t('editor.pdf.timeoutTitle')}</h4>
              <p className="text-[#1e1b4b]/60 dark:text-slate-450 text-xs font-light max-w-xs leading-relaxed font-sans">
                {t('editor.pdf.timeoutDesc')}
              </p>
            </div>
            <div className="flex gap-3 mt-2 font-display">
              <button
                onClick={handleManualReload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-white dark:bg-slate-900 border border-[#1e1b4b]/10 dark:border-slate-800 hover:border-[#1e1b4b]/20 dark:hover:border-slate-700 text-xs font-bold text-[#1e1b4b] dark:text-white transition-all shadow-sm hover:bg-[#fafafa]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#8b5cf6] animate-spin stroke-[1.75]" />
                <span>{t('editor.pdf.retry')}</span>
              </button>
              <a
                href={isGuest ? '/register' : `/api/pdf?cvId=${cvId}&download=true`}
                target={isGuest ? undefined : "_blank"}
                rel={isGuest ? undefined : "noopener noreferrer"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-xs font-bold text-[#8b5cf6] hover:bg-[#8b5cf6]/20 transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{isGuest ? (language === 'es' ? 'Guardar primero' : 'Save first') : t('editor.pdf.direct')}</span>
              </a>
            </div>
          </div>
        ) : loading && !pdfBlobUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-[#030712]/60 backdrop-blur-xs z-10 gap-3 transition-all">
            <Loader2 className="w-8 h-8 text-[#8b5cf6] animate-spin stroke-[1.75]" />
            <p className="text-[#1e1b4b]/75 dark:text-slate-400 text-xs font-semibold tracking-wide uppercase font-display">{t('editor.pdf.loading')}</p>
          </div>
        ) : null}
        
        {(pdfBlobUrl || errorTimeout) && (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
            <iframe
              src={pdfBlobUrl || pdfUrl}
              className="rounded-2xl border border-[#1e1b4b]/10 dark:border-slate-900 shadow-lg bg-white dark:bg-slate-950 transition-transform duration-200"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center center',
                width: `${10000 / zoom}%`,
                height: `${10000 / zoom}%`
              }}
              title="Vista Previa de CV"
            />
          </div>
        )}
      </div>
    </div>
  );
}
