"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CV } from '@/db/schema';
import { createCvPlaceholder } from '@/app/dashboard/actions';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  Building2,
  Briefcase,
  Link as LinkIcon,
  ChevronRight,
  Loader2,
  FileText,
  HelpCircle
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface StarClientPageProps {
  initialCvs: CV[];
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
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}

interface Dimension {
  name: string;
  percentage: number;
}

interface RedFlag {
  title: string;
  description: string;
}

interface AnalysisResult {
  score?: number;
  scoreLabel?: string;
  scoreReason?: string;
  dimensions?: Dimension[];
  missingKeywords?: string[];
  presentKeywords?: string[];
  redFlags?: RedFlag[];
  verdict?: string;
}

// Helper robusto para parsear JSON parcial durante el streaming
function parsePartialJson(jsonStr: string): AnalysisResult | null {
  let cleanStr = jsonStr.trim();
  
  // Buscar dónde empieza el JSON por si la IA añade texto al principio
  const startIndex = cleanStr.indexOf('{');
  if (startIndex === -1) return null;
  cleanStr = cleanStr.slice(startIndex);

  // Limpiar posibles comas finales antes de añadir cierres
  cleanStr = cleanStr.replace(/,\s*$/, '');

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  let suffix = '';
  if (inString) {
    suffix += '"';
  }
  while (openBrackets > 0) {
    suffix += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    suffix += '}';
    openBraces--;
  }

  try {
    return JSON.parse(cleanStr + suffix) as AnalysisResult;
  } catch (e) {
    return null;
  }
}

export default function StarClientPage({ initialCvs, isPremium, availablePrompts, user }: StarClientPageProps) {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [selectedCvId, setSelectedCvId] = useState<string>(
    initialCvs.find(c => c.isPrincipal)?.id || initialCvs[0]?.id || ''
  );
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('linkedin');
  const [jobDescription, setJobDescription] = useState('');
  const [addToKanban, setAddToKanban] = useState(true);

  // Selector de prompts STAR
  const [selectedPromptId, setSelectedPromptId] = useState<string>(
    availablePrompts.find(p => p.isActive)?.id || availablePrompts[0]?.id || ''
  );

  useEffect(() => {
    if (availablePrompts.length > 0 && !selectedPromptId) {
      const activePrompt = availablePrompts.find(p => p.isActive);
      setSelectedPromptId(activePrompt?.id || availablePrompts[0].id);
    }
  }, [availablePrompts, selectedPromptId]);

  // Estados del flujo
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');

  // Datos parseados de la IA
  const [parsedData, setParsedData] = useState<AnalysisResult | null>(null);
  const [streamingComplete, setStreamingComplete] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Referencia para scroll automático al cargar los datos
  const resultsRef = useRef<HTMLDivElement>(null);

  // Buscar el CV seleccionado
  const selectedCv = initialCvs.find(c => c.id === selectedCvId);

  // Manejar el submit del análisis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCvId || !company || !jobTitle || !jobDescription) {
      setAnalysisError(language === 'es' ? 'Por favor completa todos los campos requeridos.' : 'Please complete all required fields.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setStreamText('');
    setParsedData(null);
    setStreamingComplete(false);

    try {
      const cvContent = selectedCv?.content || '';
      const response = await fetch('/api/ai/star/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvContent, jobDescription, company })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error analizando currículum.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No se pudo abrir el stream de respuesta.');

      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      // Scroll suave hacia los resultados cuando empieza el streaming
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: !done });
        
        if (chunk.includes('[ERROR:')) {
          const errorMsg = chunk.split('[ERROR:')[1].replace(']', '').trim();
          throw new Error(errorMsg);
        }

        accumulated += chunk;
        setStreamText(accumulated);

        const parsed = parsePartialJson(accumulated);
        if (parsed) {
          setParsedData(parsed);
        }
      }

      setStreamingComplete(true);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'Ocurrió un error inesperado al analizar el currículum.');
      setIsAnalyzing(false);
    }
  };

  // Manejar la optimización (Crear placeholder y redirigir al editor)
  const handleOptimize = async () => {
    if (!parsedData || !selectedCv) return;
    setOptimizing(true);

    try {
      // 1. Inicializar el currículum optimizado (placeholder)
      const placeholderRes = await createCvPlaceholder({
        title: `Optimizado STAR - ${jobTitle} (${company})`,
        isBase: false,
        isPrincipal: false
      });

      if (!placeholderRes.success || !placeholderRes.cvId) {
        throw new Error(placeholderRes.error || 'Error al crear la versión del currículum.');
      }

      // 2. Guardar parámetros en sessionStorage
      sessionStorage.setItem('matchply_star_optimize_params', JSON.stringify({
        baseCvId: selectedCv.id,
        jobTitle,
        company,
        url,
        platform,
        jobDescription,
        missingKeywords: parsedData.missingKeywords || [],
        redFlags: parsedData.redFlags || [],
        promptId: selectedPromptId,
        addToKanban,
        targetCvId: placeholderRes.cvId
      }));

      // 3. Redirigir al editor
      router.push(`/editor/${placeholderRes.cvId}?star=true`);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'Error al iniciar la optimización.');
      setOptimizing(false);
    }
  };

  // Obtener el color de la barra según el porcentaje de match
  const getDimensionColorClass = (percentage: number) => {
    if (percentage >= 70) return 'bg-[#2ecc71]'; // Éxito / Verde
    if (percentage >= 40) return 'bg-amber-500'; // Advertencia / Amber
    return 'bg-rose-500'; // Crítico / Rojo
  };

  return (
    <div className="space-y-10">
      {/* Cabecera de la página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e1b4b]/10 dark:border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#8b5cf6] animate-pulse" />
            {language === 'es' ? 'Método STAR' : 'STAR Method'}
          </h1>
          <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            {language === 'es' 
              ? 'Analiza tu CV contra ofertas de empleo específicas. Detecta brechas de experiencia, añade palabras clave críticas usando la fórmula XYZ de Google y elimina las Red Flags más comunes.'
              : 'Analyze your resume against specific job opportunities. Identify experience gaps, inject critical keywords using Google\'s XYZ formula, and eliminate common Red Flags.'}
          </p>
        </div>
      </div>

      {initialCvs.length === 0 ? (
        /* Estado de no tener currículums */
        <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 text-center shadow-sm max-w-xl mx-auto my-10">
          <FileText className="w-12 h-12 text-[#1e1b4b]/30 dark:text-slate-500 mx-auto mb-4 stroke-[1.5]" />
          <h3 className="text-base font-bold text-[#1e1b4b] dark:text-white mb-2">
            {language === 'es' ? 'No tienes currículums guardados' : 'No saved resumes found'}
          </h3>
          <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mb-6 leading-relaxed">
            {language === 'es' 
              ? 'Para utilizar el Método STAR, primero debes crear tu currículum base. Dirígete a la pestaña "Mis CVs" para subir o crear tu primer currículum.'
              : 'To use the STAR Method, you must first create a base resume. Head over to "My CVs" to upload or draft your first resume.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 text-white font-bold px-6 py-2.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 mx-auto"
          >
            {language === 'es' ? 'Crear Currículum Base' : 'Create Base Resume'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Formulario y Resultados */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Columna Izquierda: Formulario de Entrada */}
          <div className="lg:col-span-5 bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider font-display border-b border-[#1e1b4b]/5 dark:border-white/5 pb-2">
              {language === 'es' ? 'Detalles de la Oferta' : 'Job Offer Details'}
            </h2>

            {analysisError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-450 text-xs rounded-[8px] font-medium">
                {analysisError}
              </div>
            )}

            <form onSubmit={handleAnalyze} className="space-y-4">
              {/* Seleccionar CV */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                  <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                  {language === 'es' ? 'Selecciona un Currículum Base *' : 'Select a Base Resume *'}
                </label>
                <select
                  value={selectedCvId}
                  onChange={(e) => setSelectedCvId(e.target.value)}
                  disabled={isAnalyzing}
                  className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans disabled:opacity-50 h-10 shadow-xs"
                >
                  {initialCvs.map(cv => (
                    <option key={cv.id} value={cv.id}>
                      {cv.title} {cv.isPrincipal ? `(${language === 'es' ? 'Principal' : 'Primary'})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nombre de la Empresa */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                  <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                  {language === 'es' ? 'Empresa *' : 'Company *'}
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={isAnalyzing}
                  placeholder={language === 'es' ? 'Ej. Stripe' : 'e.g. Stripe'}
                  className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all disabled:opacity-50 shadow-xs"
                />
              </div>

              {/* Puesto */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                  <Briefcase className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                  {language === 'es' ? 'Puesto *' : 'Job Position *'}
                </label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  disabled={isAnalyzing}
                  placeholder={language === 'es' ? 'Ej. Backend Developer' : 'e.g. Backend Developer'}
                  className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all disabled:opacity-50 shadow-xs"
                />
              </div>

              {/* Enlace de la Oferta */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                  <LinkIcon className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                  {language === 'es' ? 'Enlace de la Oferta (Opcional)' : 'Link of the Offer (Optional)'}
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isAnalyzing}
                  placeholder="https://..."
                  className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all disabled:opacity-50 shadow-xs"
                />
              </div>

              {/* Registro automático Kanban */}
              <div className="flex items-center gap-3 bg-[#fafafa] dark:bg-[#0b0f19]/30 p-3 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/5">
                <input
                  type="checkbox"
                  id="starAddToKanban"
                  checked={addToKanban}
                  onChange={(e) => setAddToKanban(e.target.checked)}
                  disabled={isAnalyzing}
                  className="rounded bg-white dark:bg-[#0b0f19] border-[#1e1b4b]/20 dark:border-white/20 text-[#8b5cf6] focus:ring-[#8b5cf6]/20 w-4 h-4 cursor-pointer accent-[#8b5cf6] disabled:opacity-50"
                />
                <div>
                  <label htmlFor="starAddToKanban" className="text-xs font-bold text-[#1e1b4b] dark:text-white cursor-pointer select-none font-display">
                    {language === 'es' ? 'Registrar en el Kanban' : 'Register in Kanban'}
                  </label>
                  <p className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-400 mt-0.5 leading-relaxed font-sans">
                    {language === 'es' 
                      ? 'Crea una tarjeta de seguimiento en tu embudo de candidaturas al optimizar.' 
                      : 'Creates a tracking card in your job application funnel upon optimization.'}
                  </p>
                </div>
              </div>

              {/* Descripción de la Oferta */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">
                  {language === 'es' ? 'Descripción / Requisitos de la Oferta *' : 'Description / Requirements *'}
                </label>
                <textarea
                  required
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  disabled={isAnalyzing}
                  rows={8}
                  placeholder={language === 'es' 
                    ? 'Pega la descripción completa del puesto aquí...' 
                    : 'Paste the complete job description here...'}
                  className="w-full bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all disabled:opacity-50 shadow-xs resize-none font-sans"
                />
              </div>

              {/* Botón de Analizar */}
              <button
                type="submit"
                disabled={isAnalyzing}
                className="w-full bg-[#1e1b4b] hover:bg-[#1e1b4b]/95 text-white font-bold py-3 px-4 rounded-[8px] text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer font-display hover:-translate-y-0.5"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    {language === 'es' ? 'Analizando Currículum...' : 'Analyzing Resume...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    {language === 'es' ? 'Continuar con el Análisis' : 'Continue with Analysis'}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Columna Derecha: Visualizador del Reporte */}
          <div ref={resultsRef} className="lg:col-span-7 space-y-6">
            
            {/* Visualización inicial (vacío o cargando) */}
            {!isAnalyzing && !parsedData && (
              <div className="bg-white dark:bg-[#1f2937] border border-dashed border-[#1e1b4b]/20 dark:border-white/10 rounded-[12px] p-12 text-center text-[#1e1b4b]/50 dark:text-slate-500 shadow-xs flex flex-col items-center justify-center min-h-[450px]">
                <HelpCircle className="w-12 h-12 text-[#1e1b4b]/30 dark:text-slate-600 mb-4 stroke-[1.5]" />
                <h3 className="text-sm font-bold text-[#1e1b4b] dark:text-white mb-2">
                  {language === 'es' ? 'Listo para el análisis' : 'Ready for Analysis'}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {language === 'es'
                    ? 'Introduce el nombre de la empresa, el puesto y los requisitos para que la IA comience la auditoría semántica de tu perfil.'
                    : 'Fill in the company name, job title, and description to start the semantic audit of your resume.'}
                </p>
              </div>
            )}

            {/* Spinner inicial antes de que empiece a responder */}
            {isAnalyzing && !parsedData && (
              <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[450px]">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border border-[#8b5cf6]/20 flex items-center justify-center bg-[#8b5cf6]/5 shadow-sm">
                    <Loader2 className="w-6 h-6 text-[#8b5cf6] animate-spin" />
                  </div>
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-t border-[#8b5cf6] animate-ping opacity-35" />
                </div>
                <h3 className="text-sm font-bold text-[#1e1b4b] dark:text-white mb-2">
                  {language === 'es' ? 'Auditoría de IA en curso...' : 'AI Audit in progress...'}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 max-w-xs leading-relaxed">
                  {language === 'es'
                    ? 'Evaluando tu experiencia y buscando brechas frente a los requisitos del puesto.'
                    : 'Evaluating your experience and identifying gap areas against the position requirements.'}
                </p>
              </div>
            )}

            {/* Dashboard interactivo con datos cargados/streaming */}
            {parsedData && (
              <div className="space-y-6">
                
                {/* Texto fijo arriba */}
                <p className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-300 italic tracking-wide font-sans pl-1">
                  {language === 'es' 
                    ? `Aquí va mi análisis como reclutador senior de ${company || 'esta empresa'}:` 
                    : `Here is my analysis as a senior recruiter from ${company || 'this company'}:`}
                </p>

                {/* Card de Score */}
                <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-6 shadow-sm">
                  <span className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-widest block mb-4 font-display">
                    {language === 'es' ? 'Puntuación de Match' : 'Match Score'}
                  </span>
                  
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    {/* Gran círculo de puntuación */}
                    <div className="relative flex items-center justify-center shrink-0 w-28 h-28 rounded-full border-4 border-slate-100 dark:border-slate-800 bg-[#fafafa] dark:bg-[#0b0f19] shadow-xs">
                      <div className="text-center font-display">
                        <span className="text-4xl font-extrabold text-amber-500 tracking-tight">
                          {parsedData.score !== undefined ? parsedData.score : '0'}
                        </span>
                        <span className="text-xs text-[#1e1b4b]/50 dark:text-slate-400 font-bold block -mt-1">
                          /100
                        </span>
                      </div>
                    </div>

                    {/* Razón y etiqueta */}
                    <div className="flex-1 space-y-2 text-center md:text-left">
                      <h3 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                        {parsedData.scoreLabel || (language === 'es' ? 'Evaluando...' : 'Evaluating...')}
                      </h3>
                      <p className="text-xs text-[#1e1b4b]/75 dark:text-slate-300 font-light leading-relaxed font-sans">
                        {parsedData.scoreReason || (language === 'es' ? 'Generando análisis detallado...' : 'Generating detailed analysis...')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Desglose por Dimensión */}
                {parsedData.dimensions && parsedData.dimensions.length > 0 && (
                  <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-6 shadow-sm space-y-4">
                    <span className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-widest block font-display">
                      {language === 'es' ? 'Desglose por dimensión' : 'Breakdown by dimension'}
                    </span>

                    <div className="space-y-3">
                      {parsedData.dimensions.map((dim, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-[#1e1b4b]/85 dark:text-slate-200">{dim.name}</span>
                            <span className="text-[#1e1b4b]/60 dark:text-slate-400">{dim.percentage}%</span>
                          </div>
                          {/* Barra de progreso */}
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${dim.percentage}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full ${getDimensionColorClass(dim.percentage)}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Palabras Clave */}
                {((parsedData.missingKeywords && parsedData.missingKeywords.length > 0) || 
                  (parsedData.presentKeywords && parsedData.presentKeywords.length > 0)) && (
                  <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-6 shadow-sm space-y-4">
                    <span className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-widest block font-display">
                      {language === 'es' ? 'Palabras clave que te faltan' : 'Missing keywords'}
                    </span>

                    {/* Pills de palabras clave faltantes */}
                    {parsedData.missingKeywords && parsedData.missingKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {parsedData.missingKeywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15 text-xs font-medium px-3.5 py-1.5 rounded-full shadow-2xs tracking-wide font-sans"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Palabras clave presentes */}
                    {parsedData.presentKeywords && parsedData.presentKeywords.length > 0 && (
                      <div className="pt-2 border-t border-[#1e1b4b]/5 dark:border-white/5">
                        <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans leading-relaxed">
                          <strong className="font-semibold text-[#1e1b4b]/80 dark:text-slate-350">
                            {language === 'es' ? 'Keywords presentes en el CV que sí cuentan: ' : 'Keywords present in the CV that count: '}
                          </strong>
                          {parsedData.presentKeywords.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Red Flags */}
                {parsedData.redFlags && parsedData.redFlags.length > 0 && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-widest block pl-1 font-display">
                      {language === 'es' 
                        ? `${parsedData.redFlags.length} Red Flags — lo que un reclutador ve en 10 segundos` 
                        : `${parsedData.redFlags.length} Red Flags — what a recruiter spots in 10 seconds`}
                    </span>

                    <div className="grid grid-cols-1 gap-4">
                      {parsedData.redFlags.map((flag, idx) => (
                        <div
                          key={idx}
                          className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-5 shadow-xs space-y-1.5 hover:border-[#8b5cf6]/20 dark:hover:border-[#8b5cf6]/20 transition-colors duration-300"
                        >
                          <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 font-display">
                            <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
                            {flag.title}
                          </h4>
                          <p className="text-[11px] text-[#1e1b4b]/70 dark:text-slate-300 leading-relaxed font-sans">
                            {flag.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Veredicto */}
                {parsedData.verdict && (
                  <div className="bg-[#1e1b4b]/5 dark:bg-[#1e1b4b]/20 border border-[#1e1b4b]/10 dark:border-[#8b5cf6]/10 rounded-[12px] p-6 shadow-2xs space-y-2 relative overflow-hidden">
                    {/* Decorative glow behind verdict */}
                    <div className="absolute top-[-30%] left-[-30%] w-48 h-48 bg-[#8b5cf6]/5 rounded-full filter blur-xl pointer-events-none" />
                    
                    <span className="text-[10px] font-bold text-[#8b5cf6] dark:text-violet-400 uppercase tracking-widest block font-display">
                      {language === 'es' ? 'Veredicto' : 'Verdict'}
                    </span>
                    <p className="text-xs text-[#1e1b4b] dark:text-slate-200 font-bold leading-relaxed font-sans">
                      {parsedData.verdict}
                    </p>
                  </div>
                )}

                {/* Panel de Selección de Modo de Optimización */}
                {streamingComplete && availablePrompts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#1f2937] p-5 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] shadow-sm space-y-4"
                  >
                    <div className="flex items-center gap-2 border-b border-[#1e1b4b]/5 dark:border-white/5 pb-2">
                      <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
                      <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white font-display">
                        {language === 'es' ? 'Elige el Modo de Optimización STAR' : 'Choose STAR Optimization Mode'}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {availablePrompts.map((p) => {
                        const isSelected = selectedPromptId === p.id;
                        const displayName = language === 'en' && p.nameEn ? p.nameEn : p.name;
                        const desc = language === 'en' && p.descriptionEn ? p.descriptionEn : p.description;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPromptId(p.id)}
                            className={`p-4 rounded-[8px] border text-left transition-all relative cursor-pointer ${
                              isSelected
                                ? 'border-[#8b5cf6] bg-[#8b5cf6]/5 shadow-2xs'
                                : 'border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-[#1e1b4b] dark:text-white font-display">
                                {displayName}
                              </span>
                              {isSelected && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] animate-pulse" />
                              )}
                            </div>
                            <p className="text-[10px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans leading-relaxed">
                              {desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Panel de Acción: Botón Optimizar CV */}
                {streamingComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-[#1f2937] p-5 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] shadow-sm justify-between"
                  >
                    <div className="text-center sm:text-left space-y-1 shrink-0">
                      <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white flex items-center justify-center sm:justify-start gap-1 font-display">
                        <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
                        {language === 'es' ? 'Optimización de CV recomendada' : 'Resume Optimization Recommended'}
                      </h4>
                      <p className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-400 font-sans">
                        {language === 'es'
                          ? 'Corrige las Red Flags e inyecta las palabras clave usando la fórmula XYZ de Google.'
                          : 'Fix Red Flags and inject missing keywords using Google\'s XYZ formula.'}
                      </p>
                    </div>

                    <button
                      onClick={handleOptimize}
                      disabled={optimizing}
                      className="w-full sm:w-auto bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6d28d9] text-white font-bold px-6 py-3 rounded-[8px] text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer font-display hover:-translate-y-0.5"
                    >
                      {optimizing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          {language === 'es' ? 'Generando CV...' : 'Generating Resume...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-white" />
                          {language === 'es' ? 'Optimizar CV con Método STAR' : 'Optimize CV with STAR Method'}
                          <ArrowRight className="w-4 h-4 text-white ml-0.5" />
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
