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

const promptConfigs: Record<
  string,
  {
    color: string;
    hoverBg: string;
    text: string;
    bg: string;
    activeBorder: string;
    desc: string;
  }
> = {
  'Modo Fidelidad': {
    color: '#38bdf8', // Azulito (sky-400)
    hoverBg: 'hover:bg-sky-500/5',
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
    desc: 'Fidelidad absoluta a tu trayectoria real. No inventa habilidades ni herramientas; optimiza tu redacción e integra palabras clave para pasar filtros ATS.'
  },
  'Modo Rendimiento': {
    color: '#eab308', // Amarillo (yellow-500)
    hoverBg: 'hover:bg-yellow-500/5',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    activeBorder: 'border-yellow-500 ring-2 ring-yellow-500/20',
    desc: 'Amplía y potencia tu experiencia de forma realista. Si dominas tecnologías equivalentes, las integra estratégicamente y optimiza la densidad ATS.'
  },
  'Modo Extremo': {
    color: '#ea580c', // Naranjado casi rojo (orange-600)
    hoverBg: 'hover:bg-orange-500/5',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    activeBorder: 'border-orange-500 ring-2 ring-orange-500/20',
    desc: 'Foco absoluto en superar el filtro ATS. Adapta tu CV e inyecta cualquier tecnología o requisito crítico exigido por la oferta para un match del 100%.'
  }
};

const defaultPromptConfig = {
  color: '#38bdf8',
  hoverBg: 'hover:bg-sky-500/5',
  text: 'text-sky-400',
  bg: 'bg-sky-500/10',
  activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
  desc: 'Optimiza tu currículum de acuerdo a la oferta elegida.'
};

interface EditorClientProps {
  cv: CV;
  isPremium: boolean;
  availablePrompts: { id: string; name: string; isActive: boolean }[];
  baseCvContent?: string | null;
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}

export default function EditorClient({ cv, isPremium, availablePrompts, baseCvContent, user }: EditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pdfVersion, setPdfVersion] = useState(0);

  // Shared Save Status State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

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
      setAiError('El puesto, empresa y descripción de la oferta son requeridos.');
      return;
    }

    setAiLoading(true);

    // Simular pasos fluidos de IA para dar un feedback ultra-premium
    const steps = [
      'Extrayendo palabras clave de la oferta...',
      'Analizando tu experiencia y habilidades del CV Base...',
      'Alineando tu perfil con los requisitos clave...',
      'Generando copia optimizada sin perder la verdad del contenido...',
      'Creando CV y registrando candidatura en el Kanban...'
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

      setAiStep('¡Completado con éxito! Redirigiendo...');
      setTimeout(() => {
        setIsAiOpen(false);
        setAiLoading(false);
        router.push(`/editor/${result.cvId}`);
      }, 1000);

    } catch (err: any) {
      clearInterval(stepInterval);
      setAiError(err.message || 'Ocurrió un error inesperado.');
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0b0f19] flex flex-col md:flex-row transition-colors duration-300 text-[#1e1b4b] dark:text-[#f3f4f6] font-sans">
      <Sidebar user={user} isPremium={isPremium} />
      <div className="flex-1 h-screen flex flex-col relative overflow-hidden">
        {/* Background glow effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      {/* Cabecera del Editor */}
      <header className="bg-white/80 dark:bg-[#0b0f19]/80 backdrop-blur-md border-b border-[#1e1b4b]/10 dark:border-white/10 px-6 py-4 flex items-center justify-between shrink-0 relative z-30 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <LinkNext
            href="/dashboard"
            className="text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-xl hover:bg-[#1e1b4b]/5 dark:hover:bg-slate-900 transition-colors"
            title="Volver al Panel"
          >
            <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          </LinkNext>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#1e1b4b] dark:text-white tracking-wide font-display">{cv.title}</h1>
              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                {cv.isBase ? 'CV Base' : 'CV Optimizado'}
              </span>
            </div>
            <p className="text-[10px] text-[#1e1b4b]/60 dark:text-slate-400 font-light mt-0.5 font-sans">
              Edita tu contenido Markdown y ajusta la tipografía e interlineado en tiempo real
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
            Optimizar con IA
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
              Diseño
            </span>
            <select
              value={templateName}
              onChange={handleTemplateChange}
              className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-2 py-1 text-xs text-[#1e1b4b] dark:text-slate-300 font-medium focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer h-7 shadow-sm"
            >
              <option value="harvard">Harvard (Básico)</option>
              <option value="modern" className={!isPremium ? 'text-slate-500' : ''}>Modern (Pro)</option>
              <option value="minimal" className={!isPremium ? 'text-slate-500' : ''}>Minimal (Pro)</option>
              <option value="creative" className={!isPremium ? 'text-slate-500' : ''}>Creative (Pro)</option>
              <option value="swiss" className={!isPremium ? 'text-slate-500' : ''}>Swiss (Pro)</option>
            </select>
          </div>

          {/* Selector de Fuente */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-[#1e1b4b]/10 dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-[#1e1b4b]/70 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Type className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
              Fuente
            </span>
            <select
              value={fontFamily}
              onChange={handleFontChange}
              className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-2 py-1 text-xs text-[#1e1b4b] dark:text-slate-300 font-medium focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer capitalize h-7 shadow-sm"
            >
              <option value="helvetica">Helvetica (Sans)</option>
              <option value="times">Times (Serif)</option>
              <option value="courier">Courier (Mono)</option>
            </select>
          </div>

          {/* Selector de Margen */}
          <div className="flex flex-col gap-1 pr-5 mr-5 border-r border-[#1e1b4b]/10 dark:border-slate-800/85">
            <span className="text-[9px] font-bold text-[#1e1b4b]/70 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Sliders className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
              Margen ({pageMargin}pt)
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
              Escala ({scale.toFixed(1)}x)
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
            Acento
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
                title="Color personalizado"
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
        <div 
          style={{ width: isLg ? `${leftWidth}%` : '100%' }}
          className="h-full min-h-[350px] lg:min-h-0 flex flex-col"
        >
          <MarkdownEditor
            cvId={cv.id}
            initialContent={cv.content}
            originalContent={baseCvContent || undefined}
            onSave={handleEditorSave}
            saveStatus={saveStatus}
            setSaveStatus={setSaveStatus}
          />
        </div>

        {isLg ? (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            className="w-2 hover:bg-[#8b5cf6]/30 bg-[#1e1b4b]/5 dark:bg-white/5 cursor-col-resize h-full transition-all flex items-center justify-center group relative z-10 mx-2 rounded-xl shrink-0"
            title="Arrastra para ajustar el tamaño, doble clic para centrar"
          >
            <div className="w-[2px] h-6 bg-[#1e1b4b]/20 dark:bg-white/20 group-hover:bg-[#8b5cf6] dark:group-hover:bg-[#8b5cf6] rounded-full transition-colors" />
          </div>
        ) : (
          <div className="h-6 shrink-0" />
        )}

        <div 
          style={{ width: isLg ? `${100 - leftWidth}%` : '100%' }}
          className={`h-full min-h-[400px] lg:min-h-0 flex flex-col ${isResizing ? 'pointer-events-none' : ''}`}
        >
          <PdfViewer
            cvId={cv.id}
            version={pdfVersion}
          />
        </div>
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
                  Optimización Inteligente por IA
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">
                  Adaptaremos una copia de este currículum para que coincida con los requisitos exactos de la oferta.
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
                <h4 className="text-sm font-bold text-[#1e1b4b] dark:text-white mb-2 font-display">Construyendo tu currículum adaptado</h4>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
                  {aiStep}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 relative z-10 space-y-4 py-2 scrollbar-custom">
                {aiError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-450 text-xs rounded-[8px] font-medium font-sans">
                    {aiError}
                  </div>
                )}

                {!isPremium && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500/90 text-xs rounded-[8px] flex items-start gap-3 font-sans">
                    <Crown className="w-5 h-5 shrink-0 mt-0.5 stroke-[1.75]" />
                    <div>
                      <span className="font-bold block mb-0.5 font-display">Atención: Plan Gratuito Activo</span>
                      El motor gratuito utiliza análisis estándar. Los socios PRO disfrutan de la máxima precisión semántica y velocidad de redacción con modelos de IA más avanzados.
                    </div>
                  </div>
                )}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        Nombre del Puesto *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.jobTitle}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Ej. Frontend React Engineer"
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.company}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="Ej. Stripe"
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Link className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        Enlace a la Oferta
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
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">Plataforma</label>
                      <select
                        value={aiFormData.platform}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="infojobs">InfoJobs</option>
                        <option value="indeed">Indeed</option>
                        <option value="other">Otra</option>
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
                        Registrar automáticamente en el Kanban
                      </label>
                      <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-400 font-light mt-0.5 font-sans">
                        Si está activado, creará una nueva candidatura vinculada a esta oferta en tu tablero Kanban.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 animate-pulse stroke-[1.75]" />
                      Modo de Optimización Inteligente
                    </label>
                    {availablePrompts.length === 0 ? (
                      <div className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[8px] px-4 py-3 text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                        Por defecto (Estilo Harvard)
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {availablePrompts.map((prompt) => {
                          const config = promptConfigs[prompt.name] || defaultPromptConfig;
                          const isSelected = aiFormData.promptId === prompt.id;
                          const shadowClass = prompt.name === 'Modo Fidelidad' 
                            ? 'shadow-sky-500/5' 
                            : prompt.name === 'Modo Rendimiento' 
                              ? 'shadow-yellow-500/5' 
                              : 'shadow-orange-500/5';
                          
                          return (
                            <div
                              key={prompt.id}
                              onClick={() => setAiFormData(prev => ({ ...prev, promptId: prompt.id }))}
                              className={`relative p-3.5 rounded-[8px] border bg-[#fafafa] dark:bg-[#0b0f19]/35 cursor-pointer transition-all duration-200 group flex flex-col justify-between select-none hover:-translate-y-0.5 ${config.hoverBg} ${isSelected ? `border-[#8b5cf6] ring-2 ring-[#8b5cf6]/20 shadow-lg ${shadowClass}` : 'border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#1e1b4b]/20 dark:hover:border-white/20'}`}
                              title={config.desc}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                                    {prompt.name.replace('Modo ', '')}
                                  </span>
                                  <div 
                                    className="w-2 h-2 rounded-full transition-transform group-hover:scale-125 shrink-0"
                                    style={{ backgroundColor: config.color }}
                                  />
                                </div>
                                <h4 className="text-[11px] font-bold text-[#1e1b4b] dark:text-white mb-1 group-hover:text-[#8b5cf6] dark:group-hover:text-violet-400 transition-colors font-display">
                                  {prompt.name}
                                </h4>
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
                      Descripción / Requisitos de la Oferta *
                    </label>
                    <textarea
                      required
                      rows={8}
                      value={aiFormData.jobDescription}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                      placeholder="Pega aquí la descripción detallada de la oferta, incluyendo las responsabilidades y habilidades requeridas."
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
                Cerrar
              </button>
              {!aiLoading && (
                <button
                  type="submit"
                  onClick={handleAiOptimize}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 rounded-[8px] shadow-sm transition-all"
                >
                  <Sparkles className="w-4 h-4 animate-pulse stroke-[1.75]" />
                  Iniciar Optimización por IA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Plantilla Premium"
        message={`Las plantillas Modern, Minimal, Creative y Swiss son exclusivas para socios PRO.

¡Actualiza tu cuenta en el Dashboard para utilizarlas y potenciar tu impacto profesional!`}
        type="warning"
        confirmLabel="Ir al Dashboard"
        onConfirm={() => {
          setIsUpgradeModalOpen(false);
          router.push('/dashboard');
        }}
      />

      {/* Barra de estado inferior fija */}
      <footer className="w-full h-9 bg-white/95 dark:bg-[#090d16]/90 border-t border-[#1e1b4b]/10 dark:border-white/10 px-6 flex items-center justify-between shrink-0 relative z-30 text-[10px] text-[#1e1b4b]/70 dark:text-slate-400 font-medium transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#1e1b4b]/40 dark:text-slate-500">Guía rápida:</span>
          <span className="font-semibold text-[#8b5cf6] dark:text-purple-400">## Título 2</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
          <span className="font-semibold text-[#8b5cf6] dark:text-purple-400">### Título 3</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
          <span className="font-semibold text-[#1e1b4b] dark:text-white">**Negrita**</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
          <span className="italic text-[#1e1b4b]/80 dark:text-slate-300">*Cursiva*</span>
          <span className="text-[#1e1b4b]/20 dark:text-slate-700">|</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400">- Listas</span>
        </div>

        {/* Estado del Guardado */}
        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
              Guardado en la nube
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#8b5cf6] dark:text-violet-400">
              <RefreshCw className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 animate-spin stroke-[1.75]" />
              Guardando cambios...
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 stroke-[1.75]" />
              Error de conexión
            </span>
          )}
        </div>
      </footer>
      </div>
    </div>
  );
}
