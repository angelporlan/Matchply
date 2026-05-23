"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CV } from '@/db/schema';
import MarkdownEditor from './MarkdownEditor';
import PdfViewer from './PdfViewer';
import { updateCvStyling } from '@/app/dashboard/actions';
import { 
  Sparkles, ArrowLeft, Settings, Type, Layout, Grid, Sliders, Palette, 
  Crown, Briefcase, Building2, Link, FileText, CheckCircle2, ChevronRight, X, Play, RefreshCw 
} from 'lucide-react';
import LinkNext from 'next/link';
import AlertModal from '../ui/AlertModal';

interface EditorClientProps {
  cv: CV;
  isPremium: boolean;
  availablePrompts: { id: string; name: string; isActive: boolean }[];
}

export default function EditorClient({ cv, isPremium, availablePrompts }: EditorClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pdfVersion, setPdfVersion] = useState(0);

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
  });

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
    <div className="min-h-screen bg-[#030712] flex flex-col relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-sky-950/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-950/15 blur-[120px] pointer-events-none" />

      {/* Cabecera del Editor */}
      <header className="glass-nav border-b border-slate-900 px-6 py-4 flex items-center justify-between shrink-0 relative z-30">
        <div className="flex items-center gap-3">
          <LinkNext
            href="/dashboard"
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-900 transition-colors"
            title="Volver al Panel"
          >
            <ArrowLeft className="w-4 h-4" />
          </LinkNext>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">{cv.title}</h1>
              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                {cv.isBase ? 'CV Base' : 'CV Optimizado'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-light mt-0.5">
              Edita tu contenido Markdown y ajusta la tipografía e interlineado en tiempo real
            </p>
          </div>
        </div>

        {/* Botones de acción principal */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAiOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 transition-all transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Optimizar con IA
          </button>
        </div>
      </header>

      {/* Toolbar Flotante de Estilos */}
      <div className="w-full bg-[#070b19]/60 backdrop-blur-md border-b border-slate-900 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 relative z-20">
        <div className="flex flex-wrap items-center gap-6">
          {/* Selector de Plantilla */}
          <div className="flex items-center gap-2.5">
            <Layout className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diseño</span>
            <select
              value={templateName}
              onChange={handleTemplateChange}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-medium focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="harvard">Harvard (Básico)</option>
              <option value="modern" className={!isPremium ? 'text-slate-500' : ''}>Modern (Pro) 👑</option>
              <option value="minimal" className={!isPremium ? 'text-slate-500' : ''}>Minimal (Pro) 👑</option>
              <option value="creative" className={!isPremium ? 'text-slate-500' : ''}>Creative (Pro) 👑</option>
              <option value="swiss" className={!isPremium ? 'text-slate-500' : ''}>Swiss (Pro) 👑</option>
            </select>
          </div>

          {/* Selector de Fuente */}
          <div className="flex items-center gap-2.5">
            <Type className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fuente</span>
            <select
              value={fontFamily}
              onChange={handleFontChange}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-medium focus:outline-none focus:border-sky-500 transition-all cursor-pointer capitalize"
            >
              <option value="helvetica">Helvetica (Sans)</option>
              <option value="times">Times (Serif)</option>
              <option value="courier">Courier (Mono)</option>
            </select>
          </div>

          {/* Selector de Margen */}
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Margen ({pageMargin}pt)</span>
            <input
              type="range"
              min="18"
              max="72"
              step="6"
              value={pageMargin}
              onChange={handleMarginChange}
              className="w-24 accent-sky-500 bg-slate-950 border border-slate-850 rounded-lg h-2"
            />
          </div>

          {/* Selector de Escala */}
          <div className="flex items-center gap-2.5">
            <Grid className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Escala ({scale.toFixed(1)}x)</span>
            <input
              type="range"
              min="0.6"
              max="1.4"
              step="0.1"
              value={scale}
              onChange={handleScaleChange}
              className="w-24 accent-sky-500 bg-slate-950 border border-slate-850 rounded-lg h-2"
            />
          </div>
        </div>

        {/* Selector de Color de Acento */}
        <div className="flex items-center gap-2.5">
          <Palette className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Acento</span>
          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-850 px-2 py-1.5 rounded-xl">
            {colorPresets.map((preset) => (
              <button
                key={preset.hex}
                onClick={() => handleAccentChange(preset.hex)}
                className={`w-4 h-4 rounded-full border border-black/30 transition-transform hover:scale-125 ${accentColor === preset.hex ? 'ring-2 ring-sky-500' : ''}`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
            {/* Selector de color manual personalizado */}
            <input
              type="color"
              value={accentColor}
              onChange={(e) => handleAccentChange(e.target.value)}
              className="w-5 h-5 rounded-md border border-slate-800 bg-transparent cursor-pointer"
              title="Color personalizado"
            />
          </div>
        </div>
      </div>

      {/* Panel del Editor y Visor en Split Screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-hidden h-[calc(100vh-125px)]">
        <div className="h-full min-h-[350px] lg:min-h-0">
          <MarkdownEditor
            cvId={cv.id}
            initialContent={cv.content}
            onSave={handleEditorSave}
          />
        </div>
        <div className="h-full min-h-[400px] lg:min-h-0">
          <PdfViewer
            cvId={cv.id}
            version={pdfVersion}
          />
        </div>
      </div>

      {/* Cajón Lateral / Modal de Optimización por IA */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex justify-end p-0 bg-black/75 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-xl bg-[#070b17] border-l border-slate-800 h-full p-6 md:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            
            {/* Adornos visuales de fondo */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-sky-500/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sky-400 animate-pulse" />
                  Optimización Inteligente por IA
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adaptaremos una copia de este currículum para que coincida con los requisitos exactos de la oferta.
                </p>
              </div>
              <button
                onClick={() => !aiLoading && setIsAiOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-all disabled:opacity-50"
                disabled={aiLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiLoading ? (
              /* Loader Premium en Proceso con micro-animación fluida */
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center px-4">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border border-sky-500/20 flex items-center justify-center bg-sky-500/5 shadow-2xl shadow-sky-500/10">
                    <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-indigo-500 animate-ping opacity-30" />
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Construyendo tu currículum adaptado</h4>
                <p className="text-xs text-slate-400 font-light max-w-sm h-12 flex items-center justify-center animate-pulse">
                  {aiStep}
                </p>
              </div>
            ) : (
              /* Formulario */
              <div className="flex-1 overflow-y-auto pr-1 relative z-10 space-y-4 py-2 scrollbar-custom">
                {aiError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium">
                    {aiError}
                  </div>
                )}

                {!isPremium && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-2xl flex items-start gap-3">
                    <Crown className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Atención: Plan Gratuito Activo</span>
                      El motor gratuito utiliza **OpenRouter** para el análisis. Los socios PRO disfrutan de la máxima precisión semántica y velocidad de redacción con los modelos oficiales avanzados (DeepSeek / Gemini Pro).
                    </div>
                  </div>
                )}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        Nombre del Puesto *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.jobTitle}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Ej. Frontend React Engineer"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.company}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="Ej. Stripe"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5 text-slate-400" />
                        Enlace a la Oferta
                      </label>
                      <input
                        type="url"
                        value={aiFormData.url}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Plataforma</label>
                      <select
                        value={aiFormData.platform}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="infojobs">InfoJobs</option>
                        <option value="indeed">Indeed</option>
                        <option value="other">Otra</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      Modo de Optimización (Prompt)
                    </label>
                    <select
                      value={aiFormData.promptId}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, promptId: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                    >
                      {availablePrompts.length === 0 ? (
                        <option value="">Por defecto (Estilo Harvard)</option>
                      ) : (
                        availablePrompts.map((prompt) => (
                          <option key={prompt.id} value={prompt.id}>
                            {prompt.name} {prompt.isActive ? '(Predeterminado)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Descripción / Requisitos de la Oferta *
                    </label>
                    <textarea
                      required
                      rows={8}
                      value={aiFormData.jobDescription}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                      placeholder="Pega aquí la descripción detallada de la oferta, incluyendo las responsabilidades y habilidades requeridas."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none font-sans"
                    />
                  </div>
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-900 shrink-0 relative z-10">
              <button
                type="button"
                onClick={() => setIsAiOpen(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-450 hover:text-white transition-colors disabled:opacity-50"
                disabled={aiLoading}
              >
                Cerrar
              </button>
              {!aiLoading && (
                <button
                  type="submit"
                  onClick={handleAiOptimize}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 rounded-xl hover:shadow-lg hover:shadow-sky-500/10 transition-all"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
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
        title="Plantilla Premium 👑"
        message={`Las plantillas Modern, Minimal, Creative y Swiss son exclusivas para socios PRO.

¡Actualiza tu cuenta en el Dashboard para utilizarlas y potenciar tu impacto profesional!`}
        type="warning"
        confirmLabel="Ir al Dashboard"
        onConfirm={() => {
          setIsUpgradeModalOpen(false);
          router.push('/dashboard');
        }}
      />
    </div>
  );
}
