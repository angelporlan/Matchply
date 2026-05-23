"use client";

import { useState, useEffect } from 'react';
import { Eye, Download, FileText, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

interface PdfViewerProps {
  cvId: string;
  version: number;
}

export default function PdfViewer({ cvId, version }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const [errorTimeout, setErrorTimeout] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    setLoading(true);
    setErrorTimeout(false);

    // Configurar un timeout de 7 segundos para evitar bucles infinitos de carga
    const timer = setTimeout(() => {
      if (active) setErrorTimeout(true);
    }, 7000);

    const fetchPdf = async () => {
      try {
        const response = await fetch(`/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`);
        if (!response.ok) {
          throw new Error(`Server returned status: ${response.status}`);
        }
        const blob = await response.blob();
        if (!active) return;

        localUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(localUrl);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching PDF preview blob:', error);
        if (active) {
          // Fallback to direct URL if blob fetching fails to ensure user has something
          const fallbackUrl = `/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`;
          setPdfBlobUrl(fallbackUrl);
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
  }, [version, cvId, retryKey]);

  const pdfUrl = `/api/pdf?cvId=${cvId}&v=${version}&r=${retryKey}`;

  const handleManualReload = () => {
    setLoading(true);
    setErrorTimeout(false);
    setRetryKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-full glass-card border border-slate-800 bg-slate-950/40 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* Barra de cabecera */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Eye className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">Vista Previa PDF</span>
        </div>

        {/* Descargar PDF */}
        <a
          href={`/api/pdf?cvId=${cvId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 hover:text-white transition-all"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Descargar PDF</span>
        </a>
      </div>

      {/* Contenedor del Iframe */}
      <div className="flex-1 bg-[#1e293b]/10 relative flex items-center justify-center p-4">
        {loading && errorTimeout ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/90 backdrop-blur-md z-10 gap-4 text-center px-6">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">La generación está tardando más de lo habitual</h4>
              <p className="text-slate-400 text-xs font-light max-w-xs leading-relaxed">
                El motor de renderizado PDF podría estar procesando cambios complejos.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleManualReload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-white transition-all shadow-md shadow-black/40 hover:bg-slate-850"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                <span>Reintentar Carga</span>
              </button>
              <a
                href={`/api/pdf?cvId=${cvId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-950/20 border border-sky-850 text-xs font-bold text-sky-400 hover:text-sky-350 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ver PDF Directo</span>
              </a>
            </div>
          </div>
        ) : loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/60 backdrop-blur-sm z-10 gap-3">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <p className="text-slate-400 text-xs font-semibold tracking-wide uppercase">Generando PDF en tiempo real...</p>
          </div>
        ) : null}
        
        {(pdfBlobUrl || errorTimeout) && (
          <iframe
            src={pdfBlobUrl || pdfUrl}
            className="w-full h-full rounded-2xl border border-slate-900 shadow-lg bg-slate-950"
            title="Vista Previa de CV"
          />
        )}
      </div>
    </div>
  );
}
