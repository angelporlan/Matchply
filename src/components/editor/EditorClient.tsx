"use client";

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CV } from '@/db/schema';
import MarkdownEditor from './MarkdownEditor';
import PdfViewer from './PdfViewer';
import { updateCvStyling } from '@/app/dashboard/actions';
import {
  Sparkles, ArrowLeft, Settings, Type, Layout, Grid, Sliders, Palette,
  Crown, Briefcase, Building2, Link, FileText, CheckCircle2, ChevronRight, X, Play, RefreshCw,
  AlertCircle
} from 'lucide-react';
import LinkNext from 'next/link';
import AlertModal from '../ui/AlertModal';
import Sidebar from '@/app/dashboard/Sidebar';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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
}

export default function EditorClient({ cv, isPremium, availablePrompts, baseCvContent, user }: EditorClientProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [pdfVersion, setPdfVersion] = useState(0);

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
  const [templateName, setTemplateName] = useState(cv.templateName);
  const [accentColor, setAccentColor] = useState(cv.accentColor || '#1a5f7a');
  const [fontFamily, setFontFamily] = useState(cv.fontFamily || 'helvetica');
  const [pageMargin, setPageMargin] = useState(cv.pageMargin || 36);
  const [scale, setScale] = useState(cv.scale || 1.0);

  // Estado para el modal de alerta premium
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Estado del Cajón de Optimización por IA
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiFormData, setAiFormData] = useState({
    jobTitle: '',
    company: '',
    url: '',
    platform: 'linkedin',
    jobDescription: '',
    promptId: availablePrompts.find(p => p.isActive)?.id || '',
    addToKanban: 'true',
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

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    // Comprobar suscripción para plantillas premium
    if (!isPremium && val !== 'harvard') {
      setIsUpgradeModalOpen(true);
      return;
    }
    setTemplateName(val);
    saveStyling({ templateName: val });
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

  // Optimización IA con estados progresivos
  const handleAiOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError(null);
    if (!aiFormData.jobTitle || !aiFormData.company || !aiFormData.jobDescription) {
      setAiError(t('editor.aiModal.requiredError'));
      return;
    }

    setAiLoading(true);

    // Simular pasos fluidos de IA para dar un feedback ultra-premium
    const steps = [
      t('editor.aiModal.steps.keywords'),
      t('editor.aiModal.steps.analyze'),
      t('editor.aiModal.steps.align'),
      t('editor.aiModal.steps.generate'),
      t('editor.aiModal.steps.create')
    ];

    let currentStepIndex = 0;
    setAiStep(steps[currentStepIndex]);

    const stepInterval = setInterval(() => {
      if (currentStepIndex < steps.length - 1) {
        currentStepIndex++;
        setAiStep(steps[currentStepIndex]);
      }
    }, 2000);

    try {
      const response = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseCvId: cv.id,
          jobTitle: aiFormData.jobTitle,
          company: aiFormData.company,
          url: aiFormData.url,
          platform: aiFormData.platform,
          jobDescription: aiFormData.jobDescription,
          promptId: aiFormData.promptId,
          addToKanban: aiFormData.addToKanban === 'true',
        }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Error en la optimización.');
      }

      const result = await response.json();

      setAiStep(t('editor.aiModal.steps.success'));
      setTimeout(() => {
        setIsAiOpen(false);
        setAiLoading(false);
        router.refresh();
        router.push(`/editor/${result.cvId}`);
      }, 1000);

    } catch (err: any) {
      clearInterval(stepInterval);
      setAiError(err.message || t('dashboard.errors.unexpected'));
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0b0f19] flex flex-col md:flex-row transition-colors duration-300 text-[#1e1b4b] dark:text-[#f3f4f6] font-sans">
      <Sidebar user={user} isPremium={isPremium} />
      <div className="flex-1 h-screen flex flex-col relative z-10 overflow-hidden">
        {/* Background glow effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      {/* Cabecera del Editor */}
      <header className="bg-white/80 dark:bg-[#0b0f19]/80 backdrop-blur-md border-b border-[#1e1b4b]/10 dark:border-white/10 px-6 py-4 flex items-center justify-between shrink-0 relative z-30 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <LinkNext
            href="/dashboard"
            className="text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-xl hover:bg-[#1e1b4b]/5 dark:hover:bg-slate-900 transition-colors"
            title={t('editor.header.backToDashboard')}
          >
            <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          </LinkNext>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#1e1b4b] dark:text-white tracking-wide font-display">{cv.title}</h1>
              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                {cv.isBase ? t('editor.header.titleBase') : t('editor.header.titleOptimized')}
              </span>
            </div>
            <p className="text-[10px] text-[#1e1b4b]/60 dark:text-slate-400 font-light mt-0.5 font-sans">
              {t('editor.header.subtitle')}
            </p>
          </div>
        </div>

        {/* Botones de acción principal */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAiOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-[8px] bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all font-display hover:-translate-y-0.5"
          >
            <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
            {t('editor.header.optimizeBtn')}
          </button>
        </div>
      </header>

      {/* Toolbar Flotante de Estilos (Supercompacta) */}
      <div className="w-full bg-white/90 dark:bg-[#070b19]/90 backdrop-blur-md border-b border-[#1e1b4b]/10 dark:border-white/10 px-6 py-2 flex flex-wrap items-center justify-between gap-4 shrink-0 relative z-20 transition-colors duration-300">
        <div className="flex flex-wrap items-center">
          {/* Selector de Plantilla */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-[#1e1b4b]/10 dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-[#1e1b4b]/70 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Layout className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
              {t('editor.toolbar.design')}
            </span>
            <select
              value={templateName}
              onChange={handleTemplateChange}
              className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-2 py-1 text-xs text-[#1e1b4b] dark:text-slate-300 font-medium focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer h-7 shadow-sm"
            >
              <option value="harvard">{t('editor.toolbar.templates.harvard')}</option>
              <option value="modern" className={!isPremium ? 'text-slate-500' : ''}>{t('editor.toolbar.templates.modern')}</option>
              <option value="minimal" className={!isPremium ? 'text-slate-500' : ''}>{t('editor.toolbar.templates.minimal')}</option>
              <option value="creative" className={!isPremium ? 'text-slate-500' : ''}>{t('editor.toolbar.templates.creative')}</option>
              <option value="swiss" className={!isPremium ? 'text-slate-500' : ''}>{t('editor.toolbar.templates.swiss')}</option>
            </select>
          </div>

          {/* Selector de Fuente */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-[#1e1b4b]/10 dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-[#1e1b4b]/70 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Type className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
              {t('editor.toolbar.font')}
            </span>
            <select
              value={fontFamily}
              onChange={handleFontChange}
              className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-2 py-1 text-xs text-[#1e1b4b] dark:text-slate-300 font-medium focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer capitalize h-7 shadow-sm"
            >
              <option value="helvetica">{t('editor.toolbar.fonts.helvetica')}</option>
              <option value="times">{t('editor.toolbar.fonts.times')}</option>
              <option value="courier">{t('editor.toolbar.fonts.courier')}</option>
            </select>
          </div>

          {/* Selector de Margen */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-[#1e1b4b]/10 dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-[#1e1b4b]/70 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Sliders className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
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
                className="w-24 accent-[#8b5cf6] bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] h-1.5 cursor-pointer shadow-sm"
              />
            </div>
          </div>

          {/* Selector de Escala */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-[#1e1b4b]/10 dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-[#1e1b4b]/70 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Grid className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
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
                className="w-24 accent-[#8b5cf6] bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] h-1.5 cursor-pointer shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Selector de Color de Acento */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-[#1e1b4b]/70 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
            <Palette className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
            {t('editor.toolbar.accent')}
          </span>
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-2 py-0.5 rounded-[8px] h-7 shadow-sm">
            {colorPresets.map((preset) => (
              <button
                key={preset.hex}
                onClick={() => handleAccentChange(preset.hex)}
                className={`w-4 h-4 rounded-full border border-black/15 transition-transform hover:scale-125 shrink-0 ${accentColor === preset.hex ? 'ring-2 ring-[#8b5cf6] ring-offset-1 ring-offset-white dark:ring-offset-[#0b0f19]' : ''}`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
            <div className="relative w-4 h-4 rounded-full border border-[#1e1b4b]/20 dark:border-white/20 overflow-hidden cursor-pointer hover:scale-125 transition-all shrink-0">
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
              initialContent={cv.content}
              originalContent={baseCvContent || undefined}
              onSave={handleEditorSave}
              saveStatus={saveStatus}
              setSaveStatus={setSaveStatus}
              isFullScreen={fullscreenPanel === 'editor'}
              onToggleFullScreen={() => setFullscreenPanel(prev => prev === 'editor' ? 'none' : 'editor')}
            />
          </div>
        )}

        {isLg && fullscreenPanel === 'none' ? (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            className="w-2 hover:bg-[#8b5cf6]/30 bg-[#1e1b4b]/5 dark:bg-white/5 cursor-col-resize h-full transition-all flex items-center justify-center group relative z-10 mx-2 rounded-xl shrink-0"
            title={t('editor.resizerTitle')}
          >
            <div className="w-[2px] h-6 bg-[#1e1b4b]/20 dark:bg-white/20 group-hover:bg-[#8b5cf6] dark:group-hover:bg-[#8b5cf6] rounded-full transition-colors" />
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
              version={pdfVersion}
              isFullScreen={fullscreenPanel === 'pdf'}
              onToggleFullScreen={() => setFullscreenPanel(prev => prev === 'pdf' ? 'none' : 'pdf')}
            />
          </div>
        )}
      </div>

      {/* Cajón Lateral / Modal de Optimización por IA */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-2xl bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] max-h-[90vh] p-6 md:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">

            {/* Adornos visuales de fondo */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 font-display">
                  <Sparkles className="w-5 h-5 text-[#8b5cf6] dark:text-violet-400 animate-pulse stroke-[1.75]" />
                  {t('editor.aiModal.title')}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">
                  {t('editor.aiModal.subtitle')}
                </p>
              </div>
              <button
                onClick={() => !aiLoading && setIsAiOpen(false)}
                className="text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-1 rounded-[8px] hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/45 transition-all disabled:opacity-50"
                disabled={aiLoading}
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {aiLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center px-4">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border border-[#8b5cf6]/20 flex items-center justify-center bg-[#8b5cf6]/5 shadow-sm">
                    <RefreshCw className="w-8 h-8 text-[#8b5cf6] animate-spin stroke-[1.75]" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-[#8b5cf6] animate-ping opacity-30" />
                </div>
                <h4 className="text-sm font-bold text-[#1e1b4b] dark:text-white mb-2 font-display">{t('editor.aiModal.building')}</h4>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
                  {aiStep}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 relative z-10 space-y-4 py-2 scrollbar-custom">
                {aiError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-455 text-xs rounded-[8px] font-medium font-sans">
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
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        {t('editor.aiModal.jobTitle')}
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.jobTitle}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder={t('editor.aiModal.jobTitlePlaceholder')}
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        {t('editor.aiModal.company')}
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.company}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder={t('editor.aiModal.companyPlaceholder')}
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Link className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        {t('editor.aiModal.link')}
                      </label>
                      <input
                        type="url"
                        value={aiFormData.url}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://..."
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">{t('editor.aiModal.platform')}</label>
                      <select
                        value={aiFormData.platform}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="infojobs">InfoJobs</option>
                        <option value="indeed">Indeed</option>
                        <option value="other">{t('editor.aiModal.platformOther')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-[#fafafa] dark:bg-[#0b0f19]/30 p-4 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/5">
                    <input
                      type="checkbox"
                      id="addToKanban"
                      checked={aiFormData.addToKanban === 'true'}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, addToKanban: e.target.checked ? 'true' : 'false' }))}
                      className="rounded bg-white dark:bg-[#0b0f19] border-[#1e1b4b]/20 dark:border-white/20 text-[#8b5cf6] focus:ring-[#8b5cf6]/20 w-4 h-4 cursor-pointer accent-[#8b5cf6]"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="addToKanban" className="text-xs font-bold text-[#1e1b4b]/80 dark:text-slate-200 cursor-pointer select-none flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        {t('editor.aiModal.kanban')}
                      </label>
                      <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-400 font-light mt-0.5 font-sans">
                        {t('editor.aiModal.kanbanDesc')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 animate-pulse stroke-[1.75]" />
                      {t('editor.aiModal.mode')}
                    </label>
                    {availablePrompts.length === 0 ? (
                      <div className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[8px] px-4 py-3 text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
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
                              className={`relative p-3.5 rounded-[8px] border bg-[#fafafa] dark:bg-[#0b0f19]/35 cursor-pointer transition-all duration-200 group flex flex-col justify-between select-none hover:-translate-y-0.5 ${
                                isSelected 
                                  ? 'shadow-lg border-transparent' 
                                  : 'border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#1e1b4b]/20 dark:hover:border-white/20'
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
                              <p className="text-[9.5px] text-[#1e1b4b]/60 dark:text-slate-400 leading-normal font-light font-sans">
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
                    <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                      <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                      {t('editor.aiModal.descLabel')}
                    </label>
                    <textarea
                      required
                      rows={8}
                      value={aiFormData.jobDescription}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                      placeholder={t('editor.aiModal.descPlaceholder')}
                      className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all resize-none font-sans"
                    />
                  </div>
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5 shrink-0 relative z-10 font-display">
              <button
                type="button"
                onClick={() => setIsAiOpen(false)}
                className="px-4 py-2.5 text-sm font-semibold text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white transition-colors disabled:opacity-50"
                disabled={aiLoading}
              >
                {t('editor.aiModal.close')}
              </button>
              {!aiLoading && (
                <button
                  type="submit"
                  onClick={handleAiOptimize}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 rounded-[8px] shadow-sm transition-all"
                >
                  <Sparkles className="w-4 h-4 animate-pulse stroke-[1.75]" />
                  {t('editor.aiModal.start')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={t('editor.upgradeModal.title')}
        message={t('editor.upgradeModal.message')}
        type="warning"
        confirmLabel={t('editor.upgradeModal.confirm')}
        onConfirm={() => {
          setIsUpgradeModalOpen(false);
          window.location.href = '/api/stripe/checkout';
        }}
      />

      {/* Barra de estado inferior fija */}
      <footer className="w-full h-9 bg-white/95 dark:bg-[#090d16]/90 border-t border-[#1e1b4b]/10 dark:border-white/10 px-6 flex items-center justify-between shrink-0 relative z-30 text-[10px] text-[#1e1b4b]/70 dark:text-slate-400 font-medium transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#1e1b4b]/40 dark:text-slate-500">{t('editor.footer.quickGuide')}</span>
          <span className="font-semibold text-[#8b5cf6] dark:text-purple-400">{t('editor.footer.title2')}</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
          <span className="font-semibold text-[#8b5cf6] dark:text-purple-400">{t('editor.footer.title3')}</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
          <span className="font-semibold text-[#1e1b4b] dark:text-white">{t('editor.footer.bold')}</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
          <span className="italic text-[#1e1b4b]/80 dark:text-slate-300">{t('editor.footer.italic')}</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
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
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#8b5cf6] dark:text-violet-400">
              <RefreshCw className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 animate-spin stroke-[1.75]" />
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
