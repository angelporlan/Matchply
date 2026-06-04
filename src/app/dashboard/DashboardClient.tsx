"use client";

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CV } from '@/db/schema';
import {
  Sparkles, Plus, FileText, Trash2, ArrowRight, Star, X,
  Briefcase, Building2, Link as LinkIcon, RefreshCw, AlertCircle,
  Crown, Lock, Upload, Clipboard
} from 'lucide-react';
import { createBaseCv, deleteCv, setPrincipalCv, createCvPlaceholder } from './actions';
import AlertModal from '@/components/ui/AlertModal';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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
  },
  'MODO 1 — Honesto (cero invención)': {
    color: '#3b82f6', // Azul (blue-500)
    hoverBg: 'hover:bg-blue-500/5',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    activeBorder: 'border-blue-500 ring-2 ring-blue-500/20',
    desc: ''
  },
  'MODO 2 — Adaptado (con inferencias razonables)': {
    color: '#f97316', // Naranja (orange-500)
    hoverBg: 'hover:bg-orange-500/5',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    activeBorder: 'border-orange-500 ring-2 ring-orange-500/20',
    desc: ''
  },
  'MODO 3 — Agresivo (máximo match, mínima ética 😅)': {
    color: '#ef4444', // Rojo (red-500)
    hoverBg: 'hover:bg-red-500/5',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    activeBorder: 'border-red-500 ring-2 ring-red-500/20',
    desc: ''
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

interface DashboardClientProps {
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
}

export default function DashboardClient({
  initialCvs,
  isPremium,
  availablePrompts
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [userCvs, setUserCvs] = useState<CV[]>(initialCvs);
  const { t, language } = useLanguage();

  // Refresh dashboard data on mount to ensure it's always fresh and shows newly created CVs
  useEffect(() => {
    router.refresh();
  }, [router]);

  // Estados de control de modals
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [cvToDelete, setCvToDelete] = useState<string | null>(null);

  // Estados de IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiStreamContent, setAiStreamContent] = useState('');
  const [aiFormData, setAiFormData] = useState({
    jobTitle: '',
    company: '',
    url: '',
    platform: 'linkedin',
    jobDescription: '',
    promptId: availablePrompts.find(p => p.isActive)?.id || '',
    addToKanban: 'true',
  });

  // Estado para creación rápida de CV
  const [newCvTitle, setNewCvTitle] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Estados para Onboarding de importación de CV
  const [onboardingMode, setOnboardingMode] = useState<'select' | 'pdf' | 'text'>('select');
  const [dragActive, setDragActive] = useState(false);
  const [dragActiveDirect, setDragActiveDirect] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStep, setImportStep] = useState('');
  const [importStreamContent, setImportStreamContent] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDragDirect = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveDirect(true);
    } else if (e.type === "dragleave") {
      setDragActiveDirect(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setImportError(null);
      } else {
        setImportError(language === 'es' ? 'Solo se admiten archivos PDF.' : 'Only PDF files are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setImportError(null);
      } else {
        setImportError(language === 'es' ? 'Solo se admiten archivos PDF.' : 'Only PDF files are supported.');
      }
    }
  };

  // Manejar importación inteligente con IA (Crea el placeholder y redirige al editor para streaming en tiempo real)
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (importLoading) return;
    
    setImportError(null);
    setImportLoading(true);
    setImportStep(t('dashboard.cvs.import.stepExtract'));

    try {
      let cvText = '';
      let cvTitle = language === 'es' ? 'Mi Currículum Base' : 'My Base CV';

      if (onboardingMode === 'pdf') {
        if (!selectedFile) {
          throw new Error(language === 'es' ? 'Debe seleccionar un archivo PDF.' : 'Please select a PDF file.');
        }
        cvTitle = selectedFile.name.replace(/\.[^/.]+$/, "");
        
        // 1. Extraer texto del PDF
        const parseFormData = new FormData();
        parseFormData.append('file', selectedFile);
        
        const parseResponse = await fetch('/api/cv/parse-pdf', {
          method: 'POST',
          body: parseFormData
        });
        
        if (!parseResponse.ok) {
          throw new Error(language === 'es' ? 'Error al leer el archivo PDF.' : 'Error reading the PDF file.');
        }
        
        const parseData = await parseResponse.json();
        if (!parseData.success || !parseData.text) {
          throw new Error(parseData.error || (language === 'es' ? 'No se pudo extraer texto del PDF.' : 'Could not extract text from the PDF.'));
        }
        cvText = parseData.text;
      } else {
        cvText = pastedText.trim();
        if (!cvText) {
          throw new Error(language === 'es' ? 'Debe pegar el texto de su currículum.' : 'Please paste your resume text.');
        }
      }

      setImportStep(language === 'es' ? 'Creando espacio de trabajo...' : 'Creating workspace...');

      // 2. Crear el currículum placeholder en blanco
      const placeholderRes = await createCvPlaceholder({
        title: cvTitle,
        isBase: true,
        isPrincipal: true
      });

      if (!placeholderRes.success || !placeholderRes.cvId) {
        throw new Error(placeholderRes.error || 'Error al inicializar el currículum.');
      }

      // 3. Guardar el texto original en sessionStorage para que el editor inicie el streaming
      sessionStorage.setItem('matchply_import_raw_text', cvText);

      // 4. Redirigir al editor con el parámetro de streaming activado
      router.refresh();
      router.push(`/editor/${placeholderRes.cvId}?importing=true`);

    } catch (err: any) {
      setImportError(err.message || t('dashboard.errors.unexpected'));
      setImportLoading(false);
    }
  };

  // Buscar el CV principal actual
  const principalCv = userCvs.find(cv => cv.isPrincipal);

  // Sincronizar estado local con props de entrada cuando cambien
  if (JSON.stringify(initialCvs) !== JSON.stringify(userCvs)) {
    setUserCvs(initialCvs);
  }

  // Manejar creación rápida
  const handleCreateQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCvTitle.trim() || createLoading) return;

    setCreateLoading(true);
    try {
      const res = await createBaseCv(newCvTitle.trim());
      if (res.success && res.cvId) {
        router.push(`/editor/${res.cvId}`);
      } else {
        alert(res.error || t('dashboard.errors.createFail'));
      }
    } catch (err) {
      console.error(err);
      alert(t('dashboard.errors.unexpected'));
    } finally {
      setCreateLoading(false);
    }
  };

  // Manejar marcar principal
  const handleMarkAsPrincipal = (cvId: string) => {
    startTransition(async () => {
      // Optimistic update
      setUserCvs(prev => prev.map(cv => ({
        ...cv,
        isPrincipal: cv.id === cvId
      })));

      const res = await setPrincipalCv(cvId);
      if (res.error) {
        // Revertir si falla
        setUserCvs(initialCvs);
        alert(res.error);
      }
    });
  };

  // Confirmar eliminación de CV
  const triggerDelete = (cvId: string) => {
    setCvToDelete(cvId);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!cvToDelete) return;

    setIsDeleteOpen(false);
    const targetId = cvToDelete;
    setCvToDelete(null);

    startTransition(async () => {
      // Optimistic update
      setUserCvs(prev => prev.filter(cv => cv.id !== targetId));

      const res = await deleteCv(targetId);
      if (res.error) {
        setUserCvs(initialCvs);
        alert(res.error);
      }
    });
  };

  // Acción del botón Generar con IA
  const handleAiButtonClick = () => {
    if (!principalCv) {
      setIsAlertOpen(true);
    } else {
      setIsAiOpen(true);
    }
  };

  // Helper to translate prompt titles & descs
  const getPromptTranslation = (prompt: typeof availablePrompts[0]) => {
    const isEn = language === 'en';

    // Prioritize custom database configured translations
    const displayName = (isEn && prompt.nameEn) ? prompt.nameEn : prompt.name;
    const displayDesc = (isEn && prompt.descriptionEn) ? prompt.descriptionEn : prompt.description;

    if (displayDesc) {
      return {
        name: displayName,
        desc: displayDesc,
      };
    }

    if (prompt.name === 'Modo Fidelidad') {
      return {
        name: t('dashboard.modes.fidelity.name'),
        desc: t('dashboard.modes.fidelity.desc'),
      };
    }
    if (prompt.name === 'Modo Rendimiento') {
      return {
        name: t('dashboard.modes.performance.name'),
        desc: t('dashboard.modes.performance.desc'),
      };
    }
    if (prompt.name === 'Modo Extremo') {
      return {
        name: t('dashboard.modes.extreme.name'),
        desc: t('dashboard.modes.extreme.desc'),
      };
    }
    return {
      name: displayName,
      desc: t('dashboard.modes.default.desc'),
    };
  };

  // Optimización IA (Crea el placeholder y redirige al editor para streaming en tiempo real)
  const handleAiOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError(null);

    if (!principalCv) {
      setAiError(t('dashboard.errors.noPrimary'));
      return;
    }

    if (!aiFormData.jobTitle || !aiFormData.company || !aiFormData.jobDescription) {
      setAiError(t('dashboard.errors.required'));
      return;
    }

    setAiLoading(true);
    setAiStep(t('dashboard.steps.keywords'));

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
        baseCvId: principalCv.id,
        jobTitle: aiFormData.jobTitle,
        company: aiFormData.company,
        url: aiFormData.url,
        platform: aiFormData.platform,
        jobDescription: aiFormData.jobDescription,
        promptId: aiFormData.promptId,
        addToKanban: aiFormData.addToKanban === 'true',
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
    <div>
      {/* Cabecera Tus Currículums */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2 font-display">
            {t('dashboard.cvs.title')}
            {principalCv && (
              <span className="text-[10px] py-0.5 px-2 bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 border border-[#8b5cf6]/20 rounded-full font-medium tracking-wide flex items-center gap-1 font-sans">
                <Star className="w-2.5 h-2.5 fill-[#8b5cf6]" />
                {t('dashboard.cvs.primary', { title: principalCv.title })}
              </span>
            )}
          </h3>
          <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light font-sans">{t('dashboard.cvs.subtitle')}</p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Crear nuevo CV rápido */}
          <form onSubmit={handleCreateQuick} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              required
              value={newCvTitle}
              onChange={(e) => setNewCvTitle(e.target.value)}
              placeholder={t('dashboard.cvs.placeholder')}
              className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-4 py-2 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all w-full sm:w-44"
              disabled={createLoading}
            />
            <button
              type="submit"
              disabled={createLoading}
              className="bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0b0f19] font-bold px-4 py-2 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 font-display"
            >
              {createLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 stroke-[1.75]" />
              )}
              {t('dashboard.cvs.create')}
            </button>
          </form>

          {/* Separador */}
          <div className="hidden sm:block h-6 w-[1px] bg-[#1e1b4b]/10 dark:bg-white/10 mx-1" />

          {/* Botón premium de Generar con IA */}
          <button
            onClick={handleAiButtonClick}
            className={`font-bold px-4 py-2.5 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm font-display hover:-translate-y-0.5 ${principalCv
                ? 'bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white border border-[#8b5cf6]/20'
                : 'bg-white dark:bg-[#1f2937] text-[#1e1b4b]/40 dark:text-slate-500 border border-[#1e1b4b]/10 dark:border-white/5 cursor-not-allowed'
              }`}
          >
            {principalCv ? (
              <Sparkles className="w-4 h-4 text-purple-200 animate-pulse stroke-[1.75]" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75]" />
            )}
            <span>{t('dashboard.cvs.generateAi')}</span>
          </button>
        </div>
      </div>

      {userCvs.length === 0 ? (
        <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-6 md:p-8 shadow-sm max-w-4xl mx-auto relative overflow-hidden">
          {/* Glowing background decor */}
          <div className="absolute top-[-20%] right-[-20%] w-80 h-80 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/8 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-20%] w-80 h-80 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/8 rounded-full filter blur-3xl pointer-events-none" />

          {importLoading ? (
            /* Loader premium del onboarding de importación */
            <div className="py-12 flex flex-col items-center justify-center text-center relative z-10">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full border border-[#8b5cf6]/20 flex items-center justify-center bg-[#8b5cf6]/5 shadow-sm">
                  <RefreshCw className="w-8 h-8 text-[#8b5cf6] animate-spin stroke-[1.75]" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-[#8b5cf6] animate-ping opacity-30" />
              </div>
              <h4 className="text-base font-bold text-[#1e1b4b] dark:text-white mb-2 font-display">{t('dashboard.cvs.import.processing')}</h4>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
                {importStep}
              </p>
            </div>
          ) : (
            <div className="relative z-10">
              {/* Encabezado */}
              <div className="text-center max-w-2xl mx-auto mb-8">
                <div className="inline-flex p-3 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/20 rounded-xl text-[#8b5cf6] dark:text-violet-400 mb-3.5 shadow-sm">
                  <Sparkles className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white leading-tight">
                  {t('dashboard.cvs.import.title')}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-2 font-sans">
                  {t('dashboard.cvs.import.subtitle')}
                </p>
              </div>

              {importError && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-450 text-xs rounded-[8px] font-medium font-sans flex items-start gap-2.5 max-w-2xl mx-auto">
                  <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
                  <span>{importError}</span>
                </div>
              )}

              {onboardingMode === 'select' && (
                /* 1. Pantalla de Selección de Modo */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  {/* Tarjeta Subir PDF */}
                  <div className="relative">
                    <input
                      type="file"
                      id="pdf-upload-direct"
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          if (file.type === "application/pdf") {
                            setSelectedFile(file);
                            setImportError(null);
                            setOnboardingMode('pdf');
                          } else {
                            setImportError(language === 'es' ? 'Solo se admiten archivos PDF.' : 'Only PDF files are supported.');
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="pdf-upload-direct"
                      onDragEnter={handleDragDirect}
                      onDragOver={handleDragDirect}
                      onDragLeave={handleDragDirect}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragActiveDirect(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const file = e.dataTransfer.files[0];
                          if (file.type === "application/pdf") {
                            setSelectedFile(file);
                            setImportError(null);
                            setOnboardingMode('pdf');
                          } else {
                            setImportError(language === 'es' ? 'Solo se admiten archivos PDF.' : 'Only PDF files are supported.');
                          }
                        }
                      }}
                      className={`group border block border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8b5cf6]/40 dark:hover:border-[#8b5cf6]/45 bg-[#fafafa] dark:bg-[#0b0f19]/35 hover:bg-[#8b5cf6]/2 dark:hover:bg-[#8b5cf6]/2 p-6 rounded-[12px] cursor-pointer transition-all hover:-translate-y-1 text-center h-full flex flex-col justify-between ${
                        dragActiveDirect ? 'border-[#8b5cf6] bg-[#8b5cf6]/5 ring-2 ring-[#8b5cf6]/20' : ''
                      }`}
                    >
                      <div>
                        <div className="w-12 h-12 bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#8b5cf6] dark:text-violet-400 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-105 group-hover:bg-[#8b5cf6] group-hover:text-white transition-all duration-300">
                          <Upload className="w-5 h-5 stroke-[1.75]" />
                        </div>
                        <h4 className="font-bold text-[#1e1b4b] dark:text-white text-sm font-display mb-2">
                          {t('dashboard.cvs.import.pdfTitle')}
                        </h4>
                        <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-light font-sans leading-relaxed">
                          {dragActiveDirect ? (language === 'es' ? '¡Suelta tu PDF aquí!' : 'Drop your PDF here!') : t('dashboard.cvs.import.pdfDesc')}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-[#8b5cf6] dark:text-violet-400 mt-4 inline-flex items-center justify-center gap-1 font-display">
                        {t('dashboard.cvs.import.startCta')} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </span>
                    </label>
                  </div>

                  {/* Tarjeta Pegar Texto */}
                  <div
                    onClick={() => { setOnboardingMode('text'); setImportError(null); }}
                    className="group border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8b5cf6]/40 dark:hover:border-[#8b5cf6]/45 bg-[#fafafa] dark:bg-[#0b0f19]/35 hover:bg-[#8b5cf6]/2 dark:hover:bg-[#8b5cf6]/2 p-6 rounded-[12px] cursor-pointer transition-all hover:-translate-y-1 text-center flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#8b5cf6] dark:text-violet-400 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-105 group-hover:bg-[#8b5cf6] group-hover:text-white transition-all duration-300">
                        <Clipboard className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <h4 className="font-bold text-[#1e1b4b] dark:text-white text-sm font-display mb-2">
                        {t('dashboard.cvs.import.pasteTitle')}
                      </h4>
                      <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-light font-sans leading-relaxed">
                        {t('dashboard.cvs.import.pasteDesc')}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-[#8b5cf6] dark:text-violet-400 mt-4 inline-flex items-center justify-center gap-1 font-display">
                      {t('dashboard.cvs.import.startCta')} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              )}

              {onboardingMode === 'pdf' && (
                /* 2. Drag & Drop PDF Dropzone */
                <form onSubmit={handleImportSubmit} className="max-w-2xl mx-auto space-y-5">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-[12px] p-10 text-center transition-all ${
                      dragActive
                        ? 'border-[#8b5cf6] bg-[#8b5cf6]/5'
                        : selectedFile
                        ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                        : 'border-[#1e1b4b]/10 dark:border-white/10 bg-[#fafafa] dark:bg-[#0b0f19]/25 hover:border-[#8b5cf6]/30'
                    }`}
                  >
                    <input
                      type="file"
                      id="pdf-upload"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    
                    {selectedFile ? (
                      <div className="space-y-3">
                        <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                          <FileText className="w-6 h-6 stroke-[1.75]" />
                        </div>
                        <div>
                          <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 font-bold uppercase block">{t('dashboard.cvs.import.pdfSelected')}</span>
                          <span className="text-xs font-bold text-[#1e1b4b] dark:text-white block mt-0.5 max-w-sm mx-auto truncate font-mono">{selectedFile.name}</span>
                          <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 block mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="pdf-upload" className="cursor-pointer space-y-3 block">
                        <div className="w-12 h-12 bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#8b5cf6] dark:text-violet-400 rounded-xl flex items-center justify-center mx-auto shadow-sm hover:scale-105 transition-transform duration-300">
                          <Upload className="w-5 h-5 stroke-[1.75]" />
                        </div>
                        <p className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200">
                          {dragActive ? t('dashboard.cvs.import.pdfZoneActive') : t('dashboard.cvs.import.pdfDesc')}
                        </p>
                      </label>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#1e1b4b]/10 dark:border-white/5 pt-4">
                    <button
                      type="button"
                      onClick={() => { setOnboardingMode('select'); setSelectedFile(null); setImportError(null); }}
                      className="px-4 py-2.5 text-xs font-semibold text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white transition-colors"
                    >
                      {t('dashboard.cvs.import.cancelCta')}
                    </button>
                    {selectedFile && (
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-xs font-bold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 rounded-[8px] shadow-sm flex items-center gap-1.5 transition-all font-display hover:-translate-y-0.5"
                      >
                        <Sparkles className="w-4 h-4 animate-pulse stroke-[1.75]" />
                        {t('dashboard.cvs.import.submitCta')}
                      </button>
                    )}
                  </div>
                </form>
              )}

              {onboardingMode === 'text' && (
                /* 3. Textarea Input para pegar texto */
                <form onSubmit={handleImportSubmit} className="max-w-2xl mx-auto space-y-4">
                  <div className="space-y-1.5">
                    <textarea
                      required
                      rows={10}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder={t('dashboard.cvs.import.textareaPlaceholder')}
                      className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/15 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all resize-none font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-[#1e1b4b]/10 dark:border-white/5 pt-4">
                    <button
                      type="button"
                      onClick={() => { setOnboardingMode('select'); setPastedText(''); setImportError(null); }}
                      className="px-4 py-2.5 text-xs font-semibold text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white transition-colors"
                    >
                      {t('dashboard.cvs.import.cancelCta')}
                    </button>
                    <button
                      type="submit"
                      disabled={!pastedText.trim()}
                      className={`px-5 py-2.5 text-xs font-bold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 rounded-[8px] shadow-sm flex items-center gap-1.5 transition-all font-display hover:-translate-y-0.5 ${
                        !pastedText.trim() ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Sparkles className="w-4 h-4 animate-pulse stroke-[1.75]" />
                      {t('dashboard.cvs.import.submitCta')}
                    </button>
                  </div>
                </form>
              )}

              {onboardingMode === 'select' && (
                /* 4. Opción secundaria de creación rápida (Crear en Blanco) */
                <div className="mt-10 border-t border-[#1e1b4b]/10 dark:border-white/5 pt-8 text-center">
                  <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 font-bold uppercase tracking-wider block mb-4">
                    {t('dashboard.cvs.import.orBlank')}
                  </span>
                  <form onSubmit={handleCreateQuick} className="flex flex-col sm:flex-row gap-2 justify-center items-stretch sm:items-center max-w-md mx-auto">
                    <input
                      type="text"
                      required
                      value={newCvTitle}
                      onChange={(e) => setNewCvTitle(e.target.value)}
                      placeholder={t('dashboard.cvs.import.blankPlaceholder')}
                      className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-4 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all flex-1"
                      disabled={createLoading}
                    />
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0b0f19] font-bold px-5 py-2.5 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 font-display"
                    >
                      {createLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 stroke-[1.75]" />
                      )}
                      {t('dashboard.cvs.import.blankCta')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userCvs.map((cv) => (
            <div
              key={cv.id}
              className={`bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border transition-all relative overflow-hidden group flex flex-col justify-between shadow-sm hover:shadow-md ${cv.isPrincipal
                  ? 'border-[#8b5cf6]/30 dark:border-[#8b5cf6]/40 bg-[#8b5cf6]/2 dark:bg-[#8b5cf6]/2'
                  : 'border-[#1e1b4b]/10 dark:border-white/5 hover:border-[#1e1b4b]/20 dark:hover:border-white/10'
                }`}
            >
              {/* Decorative glowing accent */}
              <div
                className="absolute top-0 left-0 w-1.5 h-full"
                style={{ backgroundColor: cv.isPrincipal ? '#8B5CF6' : (cv.accentColor || '#1E1B4B') }}
              />

              <div>
                <div className="flex items-start justify-between mb-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase
                          ? 'bg-[#1e1b4b]/5 dark:bg-white/5 text-[#1e1b4b]/70 dark:text-slate-300 border-[#1e1b4b]/10 dark:border-white/10'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                        {cv.isBase ? t('dashboard.cvs.card.base') : t('dashboard.cvs.card.copy')}
                      </span>

                      {cv.isPrincipal && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#8b5cf6]/15 text-[#8b5cf6] dark:text-violet-400 border border-[#8b5cf6]/20 flex items-center gap-0.5 animate-pulse">
                          <Star className="w-2.5 h-2.5 fill-[#8b5cf6] stroke-[1.75]" />
                          {t('dashboard.cvs.card.primary')}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-[#1e1b4b] dark:text-white text-base leading-snug group-hover:text-[#8b5cf6] dark:group-hover:text-violet-400 transition-colors pt-0.5 font-display">
                      {cv.title}
                    </h4>
                  </div>

                  {/* Acciones de estrella principal */}
                  <button
                    onClick={() => !cv.isPrincipal && handleMarkAsPrincipal(cv.id)}
                    className={`p-1.5 rounded-lg border transition-all ${cv.isPrincipal
                        ? 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20 shadow-sm'
                        : 'bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b]/40 dark:text-slate-400 border-[#1e1b4b]/10 dark:border-white/10 hover:text-[#8b5cf6] dark:hover:text-violet-400 hover:border-[#8b5cf6]/20 opacity-0 group-hover:opacity-100 transition-opacity'
                      }`}
                    title={cv.isPrincipal ? t('dashboard.cvs.card.primary') : t('dashboard.cvs.card.setPrimary')}
                    disabled={cv.isPrincipal || isPending}
                  >
                    <Star className={`w-4 h-4 ${cv.isPrincipal ? 'fill-[#8b5cf6] text-[#8b5cf6] stroke-[1.75]' : 'stroke-[1.75]'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-2 text-[11px] font-light text-[#1e1b4b]/60 dark:text-slate-400 mb-6 font-sans">
                  <div className="bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/5 dark:border-white/5 px-2.5 py-1.5 rounded-[8px]">
                    <span className="block text-[9px] text-[#1e1b4b]/40 dark:text-slate-500 font-bold uppercase">{t('dashboard.cvs.card.template')}</span>
                    <span className="text-[#1e1b4b]/80 dark:text-slate-200 font-medium capitalize">{cv.templateName}</span>
                  </div>
                  <div className="bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/5 dark:border-white/5 px-2.5 py-1.5 rounded-[8px]">
                    <span className="block text-[9px] text-[#1e1b4b]/40 dark:text-slate-500 font-bold uppercase">{t('dashboard.cvs.card.created')}</span>
                    <span className="text-[#1e1b4b]/80 dark:text-slate-200 font-medium">
                      {new Date(cv.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1e1b4b]/10 dark:border-white/5 pt-4 pl-2">
                <Link
                  href={`/editor/${cv.id}`}
                  className="text-xs font-semibold text-[#8b5cf6] dark:text-violet-400 hover:text-[#8b5cf6]/85 dark:hover:text-violet-300 flex items-center gap-1.5 group/link"
                >
                  {t('dashboard.cvs.card.edit')}
                  <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform stroke-[1.75]" />
                </Link>

                <button
                  onClick={() => triggerDelete(cv.id)}
                  className="text-[#1e1b4b]/40 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl transition-all"
                  title={t('dashboard.cvs.card.delete')}
                  disabled={isPending}
                >
                  <Trash2 className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                  {t('dashboard.modal.ai.title')}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 font-sans">
                  {t('dashboard.modal.ai.desc')}<strong className="text-[#8b5cf6] dark:text-violet-400 font-semibold">{principalCv?.title}</strong>.
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
              /* Loader Premium en Proceso */
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center px-4">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border border-[#8b5cf6]/20 flex items-center justify-center bg-[#8b5cf6]/5 shadow-sm">
                    <RefreshCw className="w-8 h-8 text-[#8b5cf6] animate-spin stroke-[1.75]" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-[#8b5cf6] animate-ping opacity-30" />
                </div>
                <h4 className="text-sm font-bold text-[#1e1b4b] dark:text-white mb-2 font-display">{t('dashboard.modal.ai.building')}</h4>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
                  {aiStep}
                </p>
              </div>
            ) : (
              /* Formulario */
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
                      <span className="font-bold block mb-0.5 font-display">{t('dashboard.modal.ai.freeWarning')}</span>
                      {t('dashboard.modal.ai.freeDesc')}
                    </div>
                  </div>
                )}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        {t('dashboard.modal.ai.jobTitle')}
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.jobTitle}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder={t('dashboard.modal.ai.jobTitlePlaceholder')}
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        {t('dashboard.modal.ai.company')}
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.company}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder={t('dashboard.modal.ai.companyPlaceholder')}
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <LinkIcon className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                        {t('dashboard.modal.ai.link')}
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
                      <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 font-display">{t('dashboard.modal.ai.platform')}</label>
                      <select
                        value={aiFormData.platform}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="infojobs">InfoJobs</option>
                        <option value="indeed">Indeed</option>
                        <option value="other">{t('dashboard.modal.ai.platformOther')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 animate-pulse stroke-[1.75]" />
                      {t('dashboard.modal.ai.mode')}
                    </label>
                    {availablePrompts.length === 0 ? (
                      <div className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/40 border border-[#1e1b4b]/10 dark:border-white/5 rounded-[8px] px-4 py-3 text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                        {t('dashboard.modal.ai.defaultMode')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {availablePrompts.map((prompt) => {
                          const config = promptConfigs[prompt.name] || defaultPromptConfig;
                          const promptColor = prompt.color || config.color;
                          const isSelected = aiFormData.promptId === prompt.id;
                          const shadowClass = (prompt.name === 'Modo Fidelidad' || prompt.name.includes('Honesto'))
                            ? 'shadow-sky-500/5' 
                            : (prompt.name === 'Modo Rendimiento' || prompt.name.includes('Adaptado'))
                              ? 'shadow-yellow-500/5' 
                              : 'shadow-red-500/5';
                          
                          const promptInfo = getPromptTranslation(prompt);
                          
                          return (
                            <div
                              key={prompt.id}
                              onClick={() => setAiFormData(prev => ({ ...prev, promptId: prompt.id }))}
                              className={`relative p-3.5 rounded-[8px] border bg-[#fafafa] dark:bg-[#0b0f19]/35 cursor-pointer transition-all duration-200 group flex flex-col justify-between select-none hover:-translate-y-0.5 ${config.hoverBg} ${isSelected ? `border-[#8b5cf6] ring-2 ring-[#8b5cf6]/20 shadow-lg ${shadowClass}` : 'border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#1e1b4b]/20 dark:hover:border-white/20'}`}
                            >
                              <div>
                                {/* Header / Color dot */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                                    {promptInfo.name.replace('Modo ', '').replace(' Mode', '')}
                                  </span>
                                  <div 
                                    className="w-2 h-2 rounded-full transition-transform group-hover:scale-125 shrink-0"
                                    style={{ backgroundColor: promptColor }}
                                  />
                                </div>
                              </div>

                              {/* Description / Summary */}
                              <p className="text-[9.5px] text-[#1e1b4b]/60 dark:text-slate-400 leading-normal font-light font-sans">
                                {promptInfo.desc}
                              </p>

                              {/* Selected checkmark dot glow */}
                              {isSelected && (
                                <div 
                                  className="absolute top-[-1px] right-[-1px] w-2.5 h-2.5 rounded-full blur-[2.5px] opacity-70"
                                  style={{ backgroundColor: promptColor }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                        {t('dashboard.modal.ai.kanban')}
                      </label>
                      <span className="text-[10px] text-[#1e1b4b]/50 dark:text-slate-400 font-light mt-0.5 font-sans">
                        {t('dashboard.modal.ai.kanbanDesc')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                      <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                      {t('dashboard.modal.ai.descLabel')}
                    </label>
                    <textarea
                      required
                      rows={8}
                      value={aiFormData.jobDescription}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                      placeholder={t('dashboard.modal.ai.descPlaceholder')}
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
                {t('dashboard.modal.ai.close')}
              </button>
              {!aiLoading && (
                <button
                  type="submit"
                  onClick={handleAiOptimize}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 rounded-[8px] shadow-sm transition-all"
                >
                  <Sparkles className="w-4 h-4 animate-pulse stroke-[1.75]" />
                  {t('dashboard.modal.ai.start')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AlertModal para advertencia de falta de CV Principal */}
      <AlertModal
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        title={t('dashboard.alert.primary.title')}
        message={t('dashboard.alert.primary.msg')}
        type="warning"
        confirmLabel={t('common.understood')}
      />

      {/* AlertModal para confirmación de borrado */}
      <AlertModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setCvToDelete(null);
        }}
        title={t('dashboard.alert.delete.title')}
        message={t('dashboard.alert.delete.msg')}
        type="danger"
        confirmLabel={t('dashboard.alert.delete.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
