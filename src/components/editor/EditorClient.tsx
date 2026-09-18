"use client";

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CV } from '@/db/schema';
import MarkdownEditor from './MarkdownEditor';
import PdfViewer from './PdfViewer';
import { updateCvStyling, createCvPlaceholder } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/Button';
import {
  Sparkles, ArrowLeft, Settings, Type, Layout, Grid, Sliders, Palette,
  Crown, Briefcase, Building2, Link, FileText, CheckCircle2, ChevronRight, X, Play, RefreshCw,
  AlertCircle
} from 'lucide-react';
import LinkNext from 'next/link';
import Sidebar from '@/app/dashboard/Sidebar';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAiPromptDebug } from '@/components/ai/AiPromptDebugContext';

interface EditorClientProps {
  cv: CV;
  isPremium: boolean;
  availablePrompts: {
    id: string;
    name: string;
    nameEn?: string | null;
    isActive: boolean;
    description?: string | null;
    descriptionEn?: string | null;
    color?: string | null;
  }[];
  baseCvContent?: string | null;
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  isGuest?: boolean;
}

export default function EditorClient({ cv, isPremium, availablePrompts, baseCvContent, user, isGuest = false }: EditorClientProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [pdfVersion, setPdfVersion] = useState(0);
  // Epoch estable durante la sesión: junto con pdfVersion forma la URL versionada (cacheable) del PDF.
  const [contentEpoch] = useState(() => new Date(cv.updatedAt).getTime());

  // Shared Save Status State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Dynamic Prompt Configs Mapper
  const getPromptConfig = (prompt: typeof availablePrompts[0]) => {
    const isEn = language === 'en';
    return {
      color: prompt.color || '#8b5cf6',
      desc: (isEn && prompt.descriptionEn) ? prompt.descriptionEn : (prompt.description || ''),
      displayName: (isEn && prompt.nameEn) ? prompt.nameEn : prompt.name,
    };
  };

  // Estado de Pantalla Completa ('none', 'editor', 'pdf')
  const [fullscreenPanel, setFullscreenPanel] = useState<'none' | 'editor' | 'pdf'>('none');

  // Estados de Estilo
  const templateName = cv.templateName || 'harvard';
  const [accentColor, setAccentColor] = useState(cv.accentColor || '#1a5f7a');
  const [fontFamily, setFontFamily] = useState(cv.fontFamily || 'helvetica');
  const [pageMargin, setPageMargin] = useState(cv.pageMargin || 36);
  const [scale, setScale] = useState(cv.scale || 1.0);

  // Estado del Cajón de Optimización por IA
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiStreamContent, setAiStreamContent] = useState('');
  const [cvContent, setCvContent] = useState(cv.content);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStep, setStreamingStep] = useState('');
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const { inspectOrExecutePrompt } = useAiPromptDebug();
  
  useEffect(() => {
    setCvContent(cv.content);
  }, [cv.content]);
  const [aiFormData, setAiFormData] = useState({
    jobTitle: '',
    company: '',
    url: '',
    platform: 'linkedin',
    jobDescription: '',
    promptId: availablePrompts.find(p => p.isActive)?.id || '',
    addToApplications: 'true',
  });

  // Resizer Split Screen states
  const [leftWidth, setLeftWidth] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isLg, setIsLg] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsLg(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (availablePrompts.length > 0 && !aiFormData.promptId) {
      const activePrompt = availablePrompts.find(p => p.isActive);
      setAiFormData(prev => ({ ...prev, promptId: activePrompt?.id || availablePrompts[0].id }));
    }
  }, [availablePrompts, aiFormData.promptId]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const shouldOptimize = searchParams.get('optimize') === 'true';
    const shouldImport = searchParams.get('importing') === 'true';

    if (shouldOptimize) {
      window.history.replaceState(null, '', window.location.pathname);
      const paramsStr = sessionStorage.getItem('matchply_optimize_params');
      if (paramsStr) {
        sessionStorage.removeItem('matchply_optimize_params');
        try {
          const params = JSON.parse(paramsStr);
          runOptimizeStream(params);
        } catch (e) {
          console.error("Error parsing optimize params from session:", e);
        }
      }
    } else if (shouldImport) {
      window.history.replaceState(null, '', window.location.pathname);
      const rawText = sessionStorage.getItem('matchply_import_raw_text');
      if (rawText) {
        sessionStorage.removeItem('matchply_import_raw_text');
        runImportStream(rawText);
      }
    }
  }, []);

  const runOptimizeStream = async (params: any) => {
    const proceed = await inspectOrExecutePrompt({
      action: 'optimize_cv',
      title: 'Optimización de CV con IA',
      data: {
        baseCvMarkdown: params.baseCvMarkdown || cvContent || cv.content,
        jobDescription: params.jobDescription,
        promptId: params.promptId,
        candidateName: params.candidateName,
        careerProfileContext: params.careerProfileContext,
      },
    });
    if (!proceed) {
      setSaveStatus('saved');
      return;
    }

    setIsStreaming(true);
    setStreamingError(null);
    setSaveStatus('saving');
    setStreamingStep(t('editor.aiModal.steps.keywords'));

    try {
      const response = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Error en la optimización.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo abrir el stream de respuesta.');

      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = '';
      let lastPdfReload = Date.now();
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: !done });

        if (chunk.includes('[METADATA:')) {
          const parts = chunk.split('[METADATA:');
          accumulatedText += parts[0];
        } else if (chunk.includes('[ERROR:')) {
          const parts = chunk.split('[ERROR:');
          accumulatedText += parts[0];
          const errorMsg = parts[1].replace(']', '').trim();
          throw new Error(errorMsg);
        } else {
          accumulatedText += chunk;
        }

        setCvContent(accumulatedText);
        if (accumulatedText.length > 50) {
          setStreamingStep(t('editor.aiModal.steps.generate'));
        }

        // Recargar PDF cada 5 segundos si ya hay contenido razonable (cada recarga es un render PDFKit)
        const now = Date.now();
        if (now - lastPdfReload > 5000 && accumulatedText.length > 50) {
          lastPdfReload = now;
          setPdfVersion(prev => prev + 1);
        }
      }

      setStreamingStep(t('editor.aiModal.steps.success'));
      setSaveStatus('saved');
      setPdfVersion(prev => prev + 1);
      // La API ya revalidó /dashboard en servidor; purgar la caché del router del cliente una sola vez.
      router.refresh();
      setTimeout(() => {
        setIsStreaming(false);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setStreamingError(err.message || 'Ocurrió un error al optimizar el currículum.');
      setSaveStatus('error');
      setIsStreaming(false);
    }
  };

  const runImportStream = async (rawText: string) => {
    const proceed = await inspectOrExecutePrompt({
      action: 'import_cv',
      title: 'Importar y Formatear CV con IA',
      data: {
        rawText,
      },
    });
    if (!proceed) {
      setSaveStatus('saved');
      return;
    }

    setIsStreaming(true);
    setStreamingError(null);
    setSaveStatus('saving');
    setStreamingStep(language === 'es' ? 'Analizando estructura original...' : 'Analyzing original structure...');

    try {
      const formData = new FormData();
      formData.append('text', rawText);
      formData.append('targetCvId', cv.id);

      const response = await fetch(`/api/cv/import?lang=${language}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Error al importar.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo abrir el stream de respuesta.');

      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = '';
      let lastPdfReload = Date.now();

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: !done });

        if (chunk.includes('[METADATA:')) {
          const parts = chunk.split('[METADATA:');
          accumulatedText += parts[0];
        } else if (chunk.includes('[ERROR:')) {
          const parts = chunk.split('[ERROR:');
          accumulatedText += parts[0];
          const errorMsg = parts[1].replace(']', '').trim();
          throw new Error(errorMsg);
        } else {
          accumulatedText += chunk;
        }

        setCvContent(accumulatedText);
        setStreamingStep(language === 'es' ? 'Transcribiendo contenido a Markdown Harvard...' : 'Transcribing content to Harvard Markdown...');

        // Recargar PDF cada 5 segundos si ya hay contenido razonable (cada recarga es un render PDFKit)
        const now = Date.now();
        if (now - lastPdfReload > 5000 && accumulatedText.length > 50) {
          lastPdfReload = now;
          setPdfVersion(prev => prev + 1);
        }
      }

      setStreamingStep(language === 'es' ? 'Currículum importado con éxito!' : 'Resume imported successfully!');
      setSaveStatus('saved');
      setPdfVersion(prev => prev + 1);
      router.refresh();
      setTimeout(() => {
        setIsStreaming(false);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setStreamingError(err.message || 'Ocurrió un error al importar el currículum.');
      setSaveStatus('error');
      setIsStreaming(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleDoubleClick = () => {
    setLeftWidth(50);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percentage = (relativeX / rect.width) * 100;
      const boundedPercentage = Math.max(25, Math.min(percentage, 75));
      setLeftWidth(boundedPercentage);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Efecto para actualizar el PDF al guardar cambios de Markdown
  const handleEditorSave = () => {
    setPdfVersion((prev) => prev + 1);
  };

  // Función para guardar cambios de estilo en la BD
  const saveStyling = async (updates: Parameters<typeof updateCvStyling>[1]) => {
    startTransition(async () => {
      const result = await updateCvStyling(cv.id, updates);
      if (result.success) {
        setPdfVersion((prev) => prev + 1);
      }
    });
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFontFamily(val);
    saveStyling({ fontFamily: val });
  };

  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPageMargin(val);
    saveStyling({ pageMargin: val });
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setScale(val);
    saveStyling({ scale: val });
  };

  const handleAccentChange = (color: string) => {
    setAccentColor(color);
    saveStyling({ accentColor: color });
  };

  // Paleta de colores preestablecidos premium
  const colorPresets = [
    { name: 'Classic Blue', hex: '#1e3a8a' },
    { name: 'Teal Depth', hex: '#0f766e' },
    { name: 'Emerald', hex: '#047857' },
    { name: 'Burgundy', hex: '#881337' },
    { name: 'Slate Gray', hex: '#334155' },
    { name: 'Warm Amber', hex: '#b45309' },
  ];

  // Optimización IA (Crea el placeholder y redirige al editor para streaming en tiempo real)
  const handleAiOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError(null);
    if (!aiFormData.jobTitle || !aiFormData.company || !aiFormData.jobDescription) {
      setAiError(t('editor.aiModal.requiredError'));
      return;
    }

    setAiLoading(true);
    setAiStep(t('editor.aiModal.steps.keywords'));

    try {
      // 1. Crear el currículum placeholder para la optimización
      const placeholderRes = await createCvPlaceholder({
        title: `Optimizado - ${aiFormData.jobTitle} (${aiFormData.company})`,
        isBase: false,
        isPrincipal: false
      });

      if (!placeholderRes.success || !placeholderRes.cvId) {
        throw new Error(placeholderRes.error || 'Error al inicializar el currículum.');
      }

      // 2. Guardar los parámetros de optimización en sessionStorage
      sessionStorage.setItem('matchply_optimize_params', JSON.stringify({
        baseCvId: cv.id,
        jobTitle: aiFormData.jobTitle,
        company: aiFormData.company,
        url: aiFormData.url,
        platform: aiFormData.platform,
        jobDescription: aiFormData.jobDescription,
        promptId: aiFormData.promptId,
        addToApplications: aiFormData.addToApplications === 'true',
        targetCvId: placeholderRes.cvId
      }));

      // 3. Redirigir al editor con el parámetro de streaming
      setIsAiOpen(false);
      setAiLoading(false);
      router.refresh();
      router.push(`/editor/${placeholderRes.cvId}?optimize=true`);

    } catch (err: any) {
      setAiError(err.message || t('dashboard.errors.unexpected'));
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={user} isPremium={isPremium} isGuest={isGuest} />
      <div className="flex-1 h-screen flex flex-col relative z-10 overflow-hidden">
        {/* Background glow effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      {/* Cabecera del Editor */}
      <header className="bg-white/80 dark:bg-canvas/80 backdrop-blur-md border-b border-subtle px-6 py-4 flex items-center justify-between shrink-0 relative z-30 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <LinkNext
            href={isGuest ? "/try" : "/dashboard"}
            className="text-text-muted hover:text-text dark:hover:text-white p-2 rounded-xl hover:bg-surface-muted dark:hover:bg-surface transition-colors"
            title={t('editor.header.backToDashboard')}
          >
            <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          </LinkNext>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-text tracking-wide font-display">{cv.title}</h1>
              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                {cv.isBase ? t('editor.header.titleBase') : t('editor.header.titleOptimized')}
              </span>
            </div>
            <p className="text-[10px] text-text-muted font-light mt-0.5 font-sans">
              {t('editor.header.subtitle')}
            </p>
          </div>
        </div>

        {/* Botones de acción principal */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAiOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-[8px] bg-ai-action hover:bg-ai-hover text-on-ai-action font-bold text-xs shadow-sm hover:shadow-md transition-all font-display hover:-translate-y-0.5"
          >
            <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
            {t('editor.header.optimizeBtn')}
          </button>
        </div>
      </header>

      {/* Toolbar Flotante de Estilos (Supercompacta) */}
      <div className="w-full bg-white/90 dark:bg-canvas/90 backdrop-blur-md border-b border-subtle px-6 py-2 flex flex-wrap items-center justify-between gap-4 shrink-0 relative z-20 transition-colors duration-300">
        <div className="flex flex-wrap items-center">
          {/* Selector de Plantilla */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-subtle dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <Layout className="w-3 h-3 text-text-muted stroke-[1.75]" />
              {t('editor.toolbar.design')}
            </span>
            <div className="bg-canvas border border-control rounded-[8px] px-2 h-7 flex items-center text-xs text-text font-medium shadow-sm">
              {t('editor.toolbar.templates.harvard')}
            </div>
          </div>

          {/* Selector de Fuente */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-subtle dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <Type className="w-3 h-3 text-text-muted stroke-[1.75]" />
              {t('editor.toolbar.font')}
            </span>
            <select
              value={fontFamily}
              onChange={handleFontChange}
              className="bg-canvas border border-control rounded-[8px] px-2 py-1 text-xs text-text font-medium focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer capitalize h-7 shadow-sm"
            >
              <option value="helvetica">{t('editor.toolbar.fonts.helvetica')}</option>
              <option value="times">{t('editor.toolbar.fonts.times')}</option>
              <option value="courier">{t('editor.toolbar.fonts.courier')}</option>
            </select>
          </div>

          {/* Selector de Margen */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-subtle dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <Sliders className="w-3 h-3 text-text-muted stroke-[1.75]" />
              {t('editor.toolbar.margin').replace('{margin}', pageMargin.toString())}
            </span>
            <div className="flex items-center h-7">
              <input
                type="range"
                min="18"
                max="72"
                step="6"
                value={pageMargin}
                onChange={handleMarginChange}
                className="w-24 accent-ai bg-canvas border border-control rounded-[8px] h-1.5 cursor-pointer shadow-sm"
              />
            </div>
          </div>

          {/* Selector de Escala */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-subtle dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
              <Grid className="w-3 h-3 text-text-muted stroke-[1.75]" />
              {t('editor.toolbar.scale').replace('{scale}', scale.toFixed(1))}
            </span>
            <div className="flex items-center h-7">
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.1"
                value={scale}
                onChange={handleScaleChange}
                className="w-24 accent-ai bg-canvas border border-control rounded-[8px] h-1.5 cursor-pointer shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Selector de Color de Acento */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 font-display">
            <Palette className="w-3 h-3 text-text-muted stroke-[1.75]" />
            {t('editor.toolbar.accent')}
          </span>
          <div className="flex items-center gap-1.5 bg-canvas border border-control px-2 py-0.5 rounded-[8px] h-7 shadow-sm">
            {colorPresets.map((preset) => (
              <button
                key={preset.hex}
                onClick={() => handleAccentChange(preset.hex)}
                className={`w-4 h-4 rounded-full border border-black/15 transition-transform hover:scale-125 shrink-0 ${accentColor === preset.hex ? 'ring-2 ring-ai ring-offset-1 ring-offset-white dark:ring-offset-[#0b0f19]' : ''}`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
            <div className="relative w-4 h-4 rounded-full border border-control dark:border-white/20 overflow-hidden cursor-pointer hover:scale-125 transition-all shrink-0">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => handleAccentChange(e.target.value)}
                className="absolute inset-0 w-8 h-8 -translate-x-2 -translate-y-2 cursor-pointer bg-transparent border-0 p-0"
                title={t('editor.toolbar.customColor')}
              />
            </div>
          </div>
        </div>
      </div>

      {isStreaming && (
        <div className="mx-6 mt-4 p-3 bg-purple-500/10 border border-purple-500/20 text-ai text-xs rounded-xl flex items-center justify-between shadow-sm animate-pulse z-15">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ai animate-spin" />
            <span className="font-bold uppercase tracking-wider font-display text-[10px]">Asistente de IA Matchply</span>
            <span className="text-slate-400">|</span>
            <span className="font-medium text-slate-700 dark:text-slate-350">{streamingStep}</span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 bg-ai/10 rounded border border-ai/20 font-bold">
            {cvContent.split(/\s+/).filter(Boolean).length} palabras
          </span>
        </div>
      )}

      {streamingError && (
        <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center justify-between z-15">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span className="font-bold uppercase tracking-wider font-display text-[10px]">Error</span>
            <span className="text-slate-400">|</span>
            <span className="font-medium">{streamingError}</span>
          </div>
          <button 
            onClick={() => setStreamingError(null)}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Panel del Editor y Visor en Split Screen */}
      <div 
        ref={containerRef}
        className={`flex-1 min-h-0 flex flex-col lg:flex-row p-6 overflow-y-auto lg:overflow-hidden editor-scrollbar transition-colors duration-300 ${isResizing ? 'select-none' : ''}`}
      >
        {fullscreenPanel !== 'pdf' && (
          <div 
            style={{ width: isLg && fullscreenPanel === 'none' ? `${leftWidth}%` : '100%' }}
            className="h-full min-h-[350px] lg:min-h-0 flex flex-col"
          >
            <MarkdownEditor
              cvId={cv.id}
              initialContent={cvContent}
              originalContent={baseCvContent || undefined}
              onSave={handleEditorSave}
              saveStatus={saveStatus}
              setSaveStatus={setSaveStatus}
              isFullScreen={fullscreenPanel === 'editor'}
              onToggleFullScreen={() => setFullscreenPanel(prev => prev === 'editor' ? 'none' : 'editor')}
              isAiStreaming={isStreaming}
              streamingStep={streamingStep}
            />
          </div>
        )}

        {isLg && fullscreenPanel === 'none' ? (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            className="w-2 hover:bg-ai/30 bg-text/5 dark:bg-white/5 cursor-col-resize h-full transition-all flex items-center justify-center group relative z-10 mx-2 rounded-xl shrink-0"
            title={t('editor.resizerTitle')}
          >
            <div className="w-[2px] h-6 bg-text/20 dark:bg-white/20 group-hover:bg-ai-action dark:group-hover:bg-ai-action rounded-full transition-colors" />
          </div>
        ) : fullscreenPanel === 'none' ? (
          <div className="h-6 shrink-0" />
        ) : null}

        {fullscreenPanel !== 'editor' && (
          <div 
            style={{ width: isLg && fullscreenPanel === 'none' ? `${100 - leftWidth}%` : '100%' }}
            className={`h-full min-h-[400px] lg:min-h-0 flex flex-col ${isResizing ? 'pointer-events-none' : ''}`}
          >
            <PdfViewer
              cvId={cv.id}
              version={`${contentEpoch}-${pdfVersion}`}
              isFullScreen={fullscreenPanel === 'pdf'}
              onToggleFullScreen={() => setFullscreenPanel(prev => prev === 'pdf' ? 'none' : 'pdf')}
              liveContent={cvContent}
              templateName={templateName}
              accentColor={accentColor}
              fontFamily={fontFamily}
              pageMargin={pageMargin}
              scale={scale}
              isAiStreaming={isStreaming}
              isGuest={isGuest}
            />
          </div>
        )}
      </div>

      {/* Cajón Lateral / Modal de Optimización por IA */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-2xl bg-surface border border-subtle rounded-2xl max-h-[90vh] p-6 md:p-8 flex flex-col justify-between shadow-dialog relative overflow-hidden">

            {/* Adornos visuales de fondo */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-text flex items-center gap-2 font-display">
                  <Sparkles className="w-5 h-5 text-ai animate-pulse stroke-[1.75]" />
                  {t('editor.aiModal.title')}
                </h3>
                <p className="text-xs text-text-muted mt-1 font-sans">
                  {t('editor.aiModal.subtitle')}
                </p>
              </div>
              <button
                onClick={() => !aiLoading && setIsAiOpen(false)}
                className="text-text-muted hover:text-text dark:hover:text-white p-1 rounded-[8px] hover:bg-canvas dark:hover:bg-canvas/45 transition-all disabled:opacity-50"
                disabled={aiLoading}
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {aiLoading ? (
              /* Loader Premium en Proceso */
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center px-4">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border border-ai/20 flex items-center justify-center bg-ai/5 shadow-sm">
                    <RefreshCw className="w-8 h-8 text-ai animate-spin stroke-[1.75]" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-ai animate-ping opacity-30" />
                </div>
                <h4 className="text-sm font-bold text-text mb-2 font-display">{t('editor.aiModal.building')}</h4>
                <p className="text-xs text-text-muted font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
                  {aiStep}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 relative z-10 space-y-4 py-2 scrollbar-custom">
                {aiError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-[8px] font-medium font-sans">
                    {aiError}
                  </div>
                )}

                {!isPremium && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500/90 text-xs rounded-[8px] flex items-start gap-3 font-sans">
                    <Crown className="w-5 h-5 shrink-0 mt-0.5 stroke-[1.75]" />
                    <div>
                      <span className="font-bold block mb-0.5 font-display">{t('editor.aiModal.freeWarning')}</span>
                      {t('editor.aiModal.freeDesc')}
                    </div>
                  </div>
                )}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                        {t('editor.aiModal.jobTitle')}
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.jobTitle}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder={t('editor.aiModal.jobTitlePlaceholder')}
                        className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                        <Building2 className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                        {t('editor.aiModal.company')}
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.company}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder={t('editor.aiModal.companyPlaceholder')}
                        className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                        <Link className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                        {t('editor.aiModal.link')}
                      </label>
                      <input
                        type="url"
                        value={aiFormData.url}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://..."
                        className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-muted dark:text-text font-display">{t('editor.aiModal.platform')}</label>
                      <select
                        value={aiFormData.platform}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer font-sans"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="infojobs">InfoJobs</option>
                        <option value="indeed">Indeed</option>
                        <option value="other">{t('editor.aiModal.platformOther')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-canvas/30 p-4 rounded-[8px] border border-subtle">
                    <input
                      type="checkbox"
                      id="addToApplications"
                      checked={aiFormData.addToApplications === 'true'}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, addToApplications: e.target.checked ? 'true' : 'false' }))}
                      className="rounded bg-canvas border-control dark:border-white/20 text-ai focus:ring-ai/20 w-4 h-4 cursor-pointer accent-ai"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="addToApplications" className="text-xs font-bold text-text-muted dark:text-text cursor-pointer select-none flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                        {t('editor.aiModal.applications')}
                      </label>
                      <span className="text-[10px] text-text-muted font-light mt-0.5 font-sans">
                        {t('editor.aiModal.applicationsDesc')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-ai animate-pulse stroke-[1.75]" />
                      {t('editor.aiModal.mode')}
                    </label>
                    {availablePrompts.length === 0 ? (
                      <div className="w-full bg-canvas/40 border border-subtle rounded-[8px] px-4 py-3 text-xs text-text-muted font-sans">
                        {t('editor.aiModal.defaultMode')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {availablePrompts.map((prompt) => {
                          const config = getPromptConfig(prompt);
                          const isSelected = aiFormData.promptId === prompt.id;
                          
                          return (
                            <div
                              key={prompt.id}
                              onClick={() => setAiFormData(prev => ({ ...prev, promptId: prompt.id }))}
                              className={`relative p-3.5 rounded-[8px] border bg-canvas/35 cursor-pointer transition-all duration-200 group flex flex-col justify-between select-none hover:-translate-y-0.5 ${
                                isSelected 
                                  ? 'shadow-lg border-transparent' 
                                  : 'border-subtle hover:border-control dark:hover:border-white/20'
                              }`}
                              style={isSelected ? {
                                borderColor: config.color,
                                boxShadow: `0 10px 15px -3px ${config.color}15, 0 4px 6px -4px ${config.color}15`,
                                outline: `2px solid ${config.color}25`,
                                outlineOffset: '-1px'
                              } : undefined}
                              title={config.desc}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span 
                                    className="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded transition-colors"
                                    style={{
                                      backgroundColor: `${config.color}1a`,
                                      color: config.color
                                    }}
                                  >
                                    {config.displayName.replace('Modo ', '').replace(' Mode', '')}
                                  </span>
                                  <div 
                                    className="w-2 h-2 rounded-full transition-transform group-hover:scale-125 shrink-0"
                                    style={{ backgroundColor: config.color }}
                                  />
                                </div>
                              </div>
                              <p className="text-[9.5px] text-text-muted leading-normal font-light font-sans">
                                {config.desc}
                              </p>
                              {isSelected && (
                                <div 
                                  className="absolute top-[-1px] right-[-1px] w-2.5 h-2.5 rounded-full blur-[2.5px] opacity-70"
                                  style={{ backgroundColor: config.color }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                      <FileText className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                      {t('editor.aiModal.descLabel')}
                    </label>
                    <textarea
                      required
                      rows={8}
                      value={aiFormData.jobDescription}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                      placeholder={t('editor.aiModal.descPlaceholder')}
                      className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all resize-none font-sans"
                    />
                  </div>
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-subtle shrink-0 relative z-10 font-display">
              <button
                type="button"
                onClick={() => setIsAiOpen(false)}
                className="px-4 py-2.5 text-sm font-semibold text-text-muted hover:text-text dark:hover:text-white transition-colors disabled:opacity-50"
                disabled={aiLoading}
              >
                {t('editor.aiModal.close')}
              </button>
              {!aiLoading && (
                <Button
                  type="submit"
                  variant="ai"
                  onClick={handleAiOptimize}
                  disabled={aiLoading}
                >
                  <Sparkles className="w-4 h-4 stroke-[1.75]" />
                  {t('editor.aiModal.start')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra de estado inferior fija */}
      <footer className="w-full h-9 bg-white/95 dark:bg-canvas/90 border-t border-subtle px-6 flex items-center justify-between shrink-0 relative z-30 text-[10px] text-text-muted font-medium transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-text-muted">{t('editor.footer.quickGuide')}</span>
          <span className="font-semibold text-ai dark:text-purple-400">{t('editor.footer.title2')}</span>
          <span className="text-text-muted dark:text-slate-700">|</span>
          <span className="font-semibold text-ai dark:text-purple-400">{t('editor.footer.title3')}</span>
          <span className="text-text-muted dark:text-slate-700">|</span>
          <span className="font-semibold text-text">{t('editor.footer.bold')}</span>
          <span className="text-text-muted dark:text-slate-700">|</span>
          <span className="italic text-text-muted dark:text-slate-300">{t('editor.footer.italic')}</span>
          <span className="text-text-muted dark:text-slate-700">|</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400">{t('editor.footer.lists')}</span>
        </div>

        {/* Estado del Guardado */}
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
              {t('editor.footer.saved')}
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-ai">
              <RefreshCw className="w-3.5 h-3.5 text-ai animate-spin stroke-[1.75]" />
              {t('editor.footer.saving')}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 stroke-[1.75]" />
              {t('editor.footer.error')}
            </span>
          )}
        </div>
      </footer>
      </div>
    </div>
  );
}
