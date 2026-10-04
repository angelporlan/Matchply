"use client";

import { shouldResetAiOperation } from '@/lib/ai-operation-retry';

import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CvListItem, CvTargetSummary } from '@/lib/job-offer-queries';
import {
  Sparkles, Plus, FileText, ArrowRight, Star, X,
  Briefcase, RefreshCw, AlertCircle,
  Crown, Lock, Upload, Clipboard, Search
} from 'lucide-react';
import { createBaseCv, deleteCv, setPrincipalCv, renameCv, duplicateCv } from './actions';
import OfferUrlImport from '@/components/ai/OfferUrlImport';
import type { ImportedOffer } from '@/lib/offer-import/types';
import AlertModal from '@/components/ui/AlertModal';
import { Button } from '@/components/ui/Button';
import { ModalScrim } from '@/components/ui/ModalScrim';
import CvCard from '@/components/dashboard/CvCard';
import { UsagePanel } from '@/components/subscription/UsagePanel';
import { ActiveCvSelector } from '@/components/subscription/ActiveCvSelector';
import { usePlanUsage } from '@/components/subscription/PlanUsageProvider';
import { UpgradePaywall } from '@/components/subscription/UpgradePaywall';
import { CvReplacementDialog } from '@/components/subscription/CvReplacementDialog';
import { reportPlanRestriction, refreshPlanUsage } from '@/lib/plan-presentation';
import { consumeCvAiStream } from '@/lib/cv-ai-stream';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { trackUmamiConversion } from '@/components/analytics/UmamiTracker';

const CvQuickPreviewModal = dynamic(() => import('@/components/dashboard/CvQuickPreviewModal'), { ssr: false });

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
  'Modo Honesto': {
    color: '#3b82f6', // Azul (blue-500)
    hoverBg: 'hover:bg-blue-500/5',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    activeBorder: 'border-blue-500 ring-2 ring-blue-500/20',
    desc: ''
  },
  'Modo Adaptado': {
    color: '#f97316', // Naranja (orange-500)
    hoverBg: 'hover:bg-orange-500/5',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    activeBorder: 'border-orange-500 ring-2 ring-orange-500/20',
    desc: ''
  },
  'Modo Agresivo': {
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
  initialCvs: CvListItem[];
  cvTargets: CvTargetSummary[];
  isPremium: boolean;
  isGuest?: boolean;
  guestCanDownloadPdf?: boolean;
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
  cvTargets,
  isPremium,
  isGuest = false,
  guestCanDownloadPdf = false,
  availablePrompts
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [userCvs, setUserCvs] = useState<CvListItem[]>(initialCvs);
  const [guestCanDownload, setGuestCanDownload] = useState(guestCanDownloadPdf);

  const { t, language } = useLanguage();
  const { data: planUsage } = usePlanUsage();
  const [replacement, setReplacement] = useState<{ choices: Array<{ id: string; title: string }>; retry: (cvId: string) => void } | null>(null);

  const targetByCvId = useMemo(() => {
    const map = new Map<string, CvTargetSummary>();
    for (const target of cvTargets) {
      if (target.cvId) map.set(target.cvId, target);
    }
    return map;
  }, [cvTargets]);

  // Sincronizar el estado local cuando el servidor envíe una lista nueva (tras revalidatePath / router.refresh).
  useEffect(() => {
    setUserCvs(initialCvs);
  }, [initialCvs]);

  // Estados de control de modals
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewCv, setPreviewCv] = useState<CvListItem | null>(null);
  const [cvToDelete, setCvToDelete] = useState<string | null>(null);

  // Búsqueda y filtros del listado de CVs
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'base' | 'optimized'>('all');

  // Estados de IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiStreamContent, setAiStreamContent] = useState('');
  const [importedOffer, setImportedOffer] = useState<ImportedOffer | null>(null);
  const aiDialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isAiOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => aiDialogRef.current?.querySelector<HTMLInputElement>('input[type="url"]')?.focus(), 0);
    return () => { clearTimeout(timer); previousFocus?.focus(); };
  }, [isAiOpen]);
  const [aiFormData, setAiFormData] = useState({
    promptId: availablePrompts.find(p => p.isActive)?.id || '',
    addToApplications: 'true',
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

  // Importar reservando el destino y la cuota en el servidor.
  const cvRequest = useRef<{ signature: string; id: string } | null>(null);
  const requestForCv = (input: unknown) => {
    const signature = JSON.stringify(input);
    if (cvRequest.current?.signature !== signature) cvRequest.current = { signature, id: crypto.randomUUID() };
    return cvRequest.current.id;
  };
  const handleImportSubmit = async (e?: React.FormEvent, confirmed = false, replacementCvId?: string) => {
    e?.preventDefault();
    if (importLoading) return;

    setImportError(null);
    if (planUsage?.usage.general.remaining === 0) { reportPlanRestriction({ code: 'QUOTA_EXCEEDED', bucket: 'general' }, 'cv-import'); return; }
    const baseCount = userCvs.filter(item => item.isBase).length;
    if (!replacementCvId && planUsage && ((planUsage.limits.maxBaseCvs !== null && baseCount >= planUsage.limits.maxBaseCvs) || (planUsage.limits.maxCvs !== null && userCvs.length >= planUsage.limits.maxCvs))) {
      const choices = userCvs.filter(item => item.isBase && planUsage.cv.activeIds.includes(item.id));
      if (choices.length) setReplacement({ choices, retry: id => { void handleImportSubmit(undefined, true, id); } });
      else reportPlanRestriction({ code: 'CV_LIMIT' }, 'cv-import');
      return;
    }
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

      const form = new FormData();
      form.append('text', cvText);
      if (replacementCvId) form.append('targetCvId', replacementCvId);
      if (confirmed) form.append('confirmOverwrite', 'true');
      form.append('requestId', requestForCv({ action: 'import', cvText, replacementCvId, confirmed }));
      setImportStep(t('dashboard.cvs.import.stepExtract'));
      const response = await fetch(`/api/cv/import?lang=${language}`, { method: 'POST', body: form });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        if (shouldResetAiOperation(problem)) cvRequest.current = null;
        reportPlanRestriction(problem, 'cv-import');
        throw new Error(problem.error || t('dashboard.errors.unexpected'));
      }
      const result = await consumeCvAiStream(response);
      cvRequest.current = null;
      refreshPlanUsage();
      trackUmamiConversion('cv_imported');
      router.refresh();
      router.push(`/editor/${result.cvId}`);

    } catch (err: any) {
      setImportError(err.message || t('dashboard.errors.unexpected'));
      setImportLoading(false);
    }
  };

  // Buscar el CV principal actual
  const principalCv = userCvs.find(cv => cv.id === planUsage?.cv.baseCvId) || userCvs.find(cv => cv.isPrincipal && !planUsage?.cv.readOnlyIds.includes(cv.id));

  // Manejar creación rápida
  const handleCreateQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCvTitle.trim() || createLoading) return;

    setCreateLoading(true);
    try {
      const res = await createBaseCv(newCvTitle.trim());
      if (res.success && res.cvId) {
        setIsCreateOpen(false);
        router.push(`/editor/${res.cvId}`);
      } else {
        if (!reportPlanRestriction(res, 'cv-create')) alert(res.error || t('dashboard.errors.createFail'));
      }
    } catch (err) {
      console.error(err);
      alert(t('dashboard.errors.unexpected'));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRename = (cvId: string, title: string) => {
    startTransition(async () => {
      const previousTitle = userCvs.find(cv => cv.id === cvId)?.title;
      setUserCvs(prev => prev.map(cv => (cv.id === cvId ? { ...cv, title } : cv)));

      const res = await renameCv(cvId, title);
      if (res.error) {
        setUserCvs(prev => prev.map(cv => (cv.id === cvId && previousTitle ? { ...cv, title: previousTitle } : cv)));
        if (!reportPlanRestriction(res, 'cv-rename')) alert(res.error);
      }
    });
  };

  const handleDuplicate = (cvId: string) => {
    startTransition(async () => {
      const res = await duplicateCv(cvId);
      if (res.error) {
        if (!reportPlanRestriction(res, 'cv-duplicate')) alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  const filteredCvs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return userCvs.filter((cv) => {
      if (activeFilter === 'base' && !cv.isBase) return false;
      if (activeFilter === 'optimized' && cv.isBase) return false;

      if (!query) return true;
      const target = targetByCvId.get(cv.id);
      return [
        cv.title,
        target?.title,
        target?.company,
      ].some(value => value && value.toLowerCase().includes(query));
    });
  }, [userCvs, searchQuery, activeFilter, targetByCvId]);

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

  // Adaptar y abrir el CV confirmado por el servidor.
  const handleAiOptimize = async (e?: React.FormEvent, confirmed = false, replacementCvId?: string) => {
    e?.preventDefault();
    setAiError(null);

    if (!principalCv) {
      setAiError(t('dashboard.errors.noPrimary'));
      return;
    }

    if (!importedOffer?.jobDescription.trim()) {
      setAiError(t('dashboard.errors.required'));
      return;
    }
    const identity = importedOffer;

    if (planUsage?.usage.general.remaining === 0) { reportPlanRestriction({ code: 'QUOTA_EXCEEDED', bucket: 'general' }, 'cv-adapt'); return; }
    const adaptedCount = userCvs.filter(item => !item.isBase).length;
    if (!replacementCvId && planUsage && ((planUsage.limits.maxAdaptedCvs !== null && adaptedCount >= planUsage.limits.maxAdaptedCvs) || (planUsage.limits.maxCvs !== null && userCvs.length >= planUsage.limits.maxCvs))) {
      const choices = userCvs.filter(item => !item.isBase && planUsage.cv.activeIds.includes(item.id));
      if (choices.length) setReplacement({ choices, retry: id => { void handleAiOptimize(undefined, true, id); } });
      else reportPlanRestriction({ code: 'CV_LIMIT' }, 'cv-adapt');
      return;
    }
    setAiLoading(true);
    setAiStep(t('dashboard.steps.keywords'));

    try {
      const params = {
        baseCvId: principalCv.id,
        jobTitle: identity.jobTitle,
        company: identity.company,
        url: identity.url,
        platform: identity.platform,
        jobDescription: identity.jobDescription,
        promptId: aiFormData.promptId,
        addToApplications: aiFormData.addToApplications === 'true',
        ...(replacementCvId ? { targetCvId: replacementCvId } : {}),
        confirmOverwrite: confirmed,
      };
      trackUmamiConversion('offer_pasted');
      const response = await fetch('/api/ai/optimize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, requestId: requestForCv(params) }),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        if (shouldResetAiOperation(problem)) cvRequest.current = null;
        reportPlanRestriction(problem, 'cv-adapt');
        throw new Error(problem.error || t('dashboard.errors.unexpected'));
      }
      const result = await consumeCvAiStream(response, content => { if (content.length > 50) setAiStep(t('dashboard.steps.keywords')); });
      cvRequest.current = null;
      refreshPlanUsage();
      trackUmamiConversion('cv_optimized');
      setIsAiOpen(false);
      setAiLoading(false);
      router.refresh();
      router.push(`/editor/${result.cvId}`);

    } catch (err: any) {
      setAiError(err.message || t('dashboard.errors.unexpected'));
      setAiLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-5"><UsagePanel compact /></div>
      <ActiveCvSelector cvs={userCvs} />
      {replacement && <CvReplacementDialog choices={replacement.choices} onClose={() => setReplacement(null)} onReplace={cvId => { const retry = replacement.retry; setReplacement(null); retry(cvId); }} />}

      {/* Cabecera Tus Currículums */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-text flex items-center gap-2 font-display">
            {t('dashboard.cvs.title')}
            {principalCv && (
              <span className="text-[10px] py-0.5 px-2 bg-ai-surface text-ai-text border border-ai/20 rounded-full font-medium tracking-wide flex items-center gap-1 font-sans">
                <Star className="w-2.5 h-2.5 fill-ai" />
                {t('dashboard.cvs.primary', { title: principalCv.title })}
              </span>
            )}
          </h3>
          <p className="text-text-muted text-xs font-light font-sans">{t('dashboard.cvs.subtitle')}</p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsCreateOpen(true)}
            className="shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[1.75]" />
            {t('dashboard.cvs.create')}
          </Button>

          {/* Botón premium de Generar con IA */}
          <Button
            onClick={handleAiButtonClick}
            variant={principalCv ? 'ai' : 'secondary'}
            disabled={!principalCv}
            className="shrink-0"
          >
            {principalCv ? (
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            ) : (
              <Lock className="w-3.5 h-3.5 stroke-[1.75]" />
            )}
            <span>{t('dashboard.cvs.generateAi')}</span>
          </Button>
        </div>
      </div>

      {/* Búsqueda y filtros */}
      {userCvs.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted stroke-[1.75]" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('dashboard.cvs.search')}
              className="w-full bg-canvas border border-control rounded-[8px] pl-9 pr-3 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label={t('dashboard.cvs.filters.label')}>
            {([
              { key: 'all', label: t('dashboard.cvs.filters.all') },
              { key: 'base', label: t('dashboard.cvs.filters.base') },
              { key: 'optimized', label: t('dashboard.cvs.filters.optimized') },
            ] as const).map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                aria-pressed={activeFilter === filter.key}
                className="pill-tab"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {userCvs.length === 0 ? (
        <div className="bg-surface border border-subtle rounded-[12px] p-6 md:p-8 shadow-sm max-w-4xl mx-auto relative overflow-hidden">
          {/* Glowing background decor */}
          <div className="absolute top-[-20%] right-[-20%] w-80 h-80 bg-ai/5 dark:bg-ai/8 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-20%] w-80 h-80 bg-ai/5 dark:bg-ai/8 rounded-full filter blur-3xl pointer-events-none" />

          {importLoading ? (
            /* Loader premium del onboarding de importación */
            <div className="py-12 flex flex-col items-center justify-center text-center relative z-10">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full border border-ai/20 flex items-center justify-center bg-ai/5 shadow-sm">
                  <RefreshCw className="w-8 h-8 text-ai animate-spin stroke-[1.75]" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-ai animate-ping opacity-30" />
              </div>
              <h4 className="text-base font-bold text-text mb-2 font-display">{t('dashboard.cvs.import.processing')}</h4>
              <p className="text-xs text-text-muted font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
                {importStep}
              </p>
            </div>
          ) : (
            <div className="relative z-10">
              {/* Encabezado */}
              <div className="text-center max-w-2xl mx-auto mb-8">
                <div className="inline-flex p-3 bg-ai/10 dark:bg-ai/20 rounded-xl text-ai mb-3.5 shadow-sm">
                  <Sparkles className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h3 className="text-xl font-bold font-display text-text leading-tight">
                  {t('dashboard.cvs.import.title')}
                </h3>
                <p className="text-xs text-text-muted mt-2 font-sans">
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
                      className={`group border block border-subtle hover:border-ai/40 dark:hover:border-ai/45 bg-canvas/35 hover:bg-ai/2 dark:hover:bg-ai/2 p-6 rounded-[12px] cursor-pointer transition-all hover:-translate-y-1 text-center h-full flex flex-col justify-between ${dragActiveDirect ? 'border-ai bg-ai/5 ring-2 ring-ai/20' : ''
                        }`}
                    >
                      <div>
                        <div className="w-12 h-12 bg-surface border border-subtle text-ai rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-105 group-hover:bg-ai-action group-hover:text-on-ai-action transition-all duration-300">
                          <Upload className="w-5 h-5 stroke-[1.75]" />
                        </div>
                        <h4 className="font-bold text-text text-sm font-display mb-2">
                          {t('dashboard.cvs.import.pdfTitle')}
                        </h4>
                        <p className="text-[11px] text-text-muted font-light font-sans leading-relaxed">
                          {dragActiveDirect ? (language === 'es' ? '¡Suelta tu PDF aquí!' : 'Drop your PDF here!') : t('dashboard.cvs.import.pdfDesc')}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-ai mt-4 inline-flex items-center justify-center gap-1 font-display">
                        {t('dashboard.cvs.import.startCta')} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </span>
                    </label>
                  </div>

                  {/* Tarjeta Pegar Texto */}
                  <div
                    onClick={() => { setOnboardingMode('text'); setImportError(null); }}
                    className="group border border-subtle hover:border-ai/40 dark:hover:border-ai/45 bg-canvas/35 hover:bg-ai/2 dark:hover:bg-ai/2 p-6 rounded-[12px] cursor-pointer transition-all hover:-translate-y-1 text-center flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 bg-surface border border-subtle text-ai rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-105 group-hover:bg-ai-action group-hover:text-on-ai-action transition-all duration-300">
                        <Clipboard className="w-5 h-5 stroke-[1.75]" />
                      </div>
                      <h4 className="font-bold text-text text-sm font-display mb-2">
                        {t('dashboard.cvs.import.pasteTitle')}
                      </h4>
                      <p className="text-[11px] text-text-muted font-light font-sans leading-relaxed">
                        {t('dashboard.cvs.import.pasteDesc')}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-ai mt-4 inline-flex items-center justify-center gap-1 font-display">
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
                    className={`border-2 border-dashed rounded-[12px] p-10 text-center transition-all ${dragActive
                        ? 'border-ai bg-ai/5'
                        : selectedFile
                          ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                          : 'border-subtle bg-canvas/25 hover:border-ai/30'
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
                          <span className="text-[10px] text-text-muted font-bold uppercase block">{t('dashboard.cvs.import.pdfSelected')}</span>
                          <span className="text-xs font-bold text-text block mt-0.5 max-w-sm mx-auto truncate font-mono">{selectedFile.name}</span>
                          <span className="text-[10px] text-text-muted block mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="pdf-upload" className="cursor-pointer space-y-3 block">
                        <div className="w-12 h-12 bg-surface border border-subtle text-ai rounded-xl flex items-center justify-center mx-auto shadow-sm hover:scale-105 transition-transform duration-300">
                          <Upload className="w-5 h-5 stroke-[1.75]" />
                        </div>
                        <p className="text-xs font-semibold text-text-muted dark:text-text">
                          {dragActive ? t('dashboard.cvs.import.pdfZoneActive') : t('dashboard.cvs.import.pdfDesc')}
                        </p>
                      </label>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-subtle pt-4">
                    <button
                      type="button"
                      onClick={() => { setOnboardingMode('select'); setSelectedFile(null); setImportError(null); }}
                      className="px-4 py-2.5 text-xs font-semibold text-text-muted hover:text-text dark:hover:text-white transition-colors"
                    >
                      {t('dashboard.cvs.import.cancelCta')}
                    </button>
                    {selectedFile && (
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-xs font-bold text-on-ai-action bg-ai-action hover:bg-ai-hover rounded-[8px] shadow-sm flex items-center gap-1.5 transition-all font-display hover:-translate-y-0.5"
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
                      className="w-full bg-canvas border border-control dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all resize-none font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-subtle pt-4">
                    <button
                      type="button"
                      onClick={() => { setOnboardingMode('select'); setPastedText(''); setImportError(null); }}
                      className="px-4 py-2.5 text-xs font-semibold text-text-muted hover:text-text dark:hover:text-white transition-colors"
                    >
                      {t('dashboard.cvs.import.cancelCta')}
                    </button>
                    <Button
                      type="submit"
                      variant="ai"
                      size="sm"
                      disabled={!pastedText.trim()}
                    >
                      <Sparkles className="w-4 h-4 stroke-[1.75]" />
                      {t('dashboard.cvs.import.submitCta')}
                    </Button>
                  </div>
                </form>
              )}

              {onboardingMode === 'select' && (
                /* 4. Opción secundaria de creación rápida (Crear en Blanco) */
                <div className="mt-10 border-t border-subtle pt-8 text-center">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block mb-4">
                    {t('dashboard.cvs.import.orBlank')}
                  </span>
                  <form onSubmit={handleCreateQuick} className="flex flex-col sm:flex-row gap-2 justify-center items-stretch sm:items-center max-w-md mx-auto">
                    <input
                      type="text"
                      required
                      value={newCvTitle}
                      onChange={(e) => setNewCvTitle(e.target.value)}
                      placeholder={t('dashboard.cvs.import.blankPlaceholder')}
                      className="bg-canvas border border-control rounded-[8px] px-4 py-2.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all flex-1"
                      disabled={createLoading}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={createLoading}
                      loading={createLoading}
                      className="shrink-0"
                    >
                      {!createLoading && <Plus className="w-4 h-4 stroke-[1.75]" />}
                      {t('dashboard.cvs.import.blankCta')}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      ) : filteredCvs.length === 0 ? (
        <div className="bg-surface border border-subtle rounded-[12px] p-10 text-center shadow-card">
          <p className="text-sm text-text-muted font-sans">{t('dashboard.cvs.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCvs.map((cv) => (
            <CvCard
              key={cv.id}
              cv={cv}
              target={targetByCvId.get(cv.id)}
              isGuest={isGuest}
              guestCanDownload={guestCanDownload}
              onGuestDownloadConsumed={() => setGuestCanDownload(false)}
              isPending={isPending}
              onPreview={setPreviewCv}
              onSetPrincipal={handleMarkAsPrincipal}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onDelete={triggerDelete}
            />
          ))}
        </div>
      )}

      {/* Cajón Lateral / Modal de Optimización por IA */}
      {isAiOpen && (
        <ModalScrim>
          <div ref={aiDialogRef} role="dialog" aria-modal="true" aria-labelledby="ai-offer-dialog-title"
            onKeyDown={event => {
              if (event.key === 'Escape' && !aiLoading) { event.preventDefault(); setIsAiOpen(false); }
              if (event.key !== 'Tab') return;
              const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),summary'))
                .filter(element => element.getBoundingClientRect().height > 0);
              const first = controls[0]; const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }}
            className="w-full max-w-2xl bg-surface border border-subtle rounded-2xl max-h-[90vh] p-6 md:p-8 flex flex-col justify-between shadow-dialog relative overflow-hidden">

            {/* Adornos visuales de fondo */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
              <div>
                <h3 id="ai-offer-dialog-title" className="text-lg font-bold text-text flex items-center gap-2 font-display">
                  <Sparkles className="w-5 h-5 text-ai animate-pulse stroke-[1.75]" />
                  {t('dashboard.modal.ai.title')}
                </h3>
                <p className="text-xs text-text-muted mt-1 font-sans">
                  {t('dashboard.modal.ai.desc')}<strong className="text-ai font-semibold">{principalCv?.title}</strong>.
                </p>
              </div>
              <button
                type="button"
                aria-label={t('dashboard.modal.ai.close')}
                onClick={() => !aiLoading && setIsAiOpen(false)}
                className="min-h-11 min-w-11 text-text-muted hover:text-text dark:hover:text-white p-1 rounded-[8px] hover:bg-canvas dark:hover:bg-canvas/45 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
                <h4 className="text-sm font-bold text-text mb-2 font-display">{t('dashboard.modal.ai.building')}</h4>
                <p className="text-xs text-text-muted font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
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

                <UsagePanel compact />
                {!isPremium && <UpgradePaywall source="adapt-dialog" compact />}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <OfferUrlImport value={importedOffer} onChange={setImportedOffer} disabled={aiLoading} />

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-ai animate-pulse stroke-[1.75]" />
                      {t('dashboard.modal.ai.mode')}
                    </label>
                    {availablePrompts.length === 0 ? (
                      <div className="w-full bg-canvas/40 border border-subtle rounded-[8px] px-4 py-3 text-xs text-text-muted font-sans">
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
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              key={prompt.id}
                              onClick={() => setAiFormData(prev => ({ ...prev, promptId: prompt.id }))}
                              className={`relative p-3.5 rounded-[8px] border bg-canvas/35 text-left cursor-pointer transition-all duration-200 group flex flex-col justify-between select-none hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${config.hoverBg} ${isSelected ? `border-ai ring-2 ring-ai/20 shadow-lg ${shadowClass}` : 'border-subtle hover:border-control dark:hover:border-white/20'}`}
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
                              <p className="text-[9.5px] text-text-muted leading-normal font-light font-sans">
                                {promptInfo.desc}
                              </p>

                              {/* Selected checkmark dot glow */}
                              {isSelected && (
                                <div
                                  className="absolute top-[-1px] right-[-1px] w-2.5 h-2.5 rounded-full blur-[2.5px] opacity-70"
                                  style={{ backgroundColor: promptColor }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                        {t('dashboard.modal.ai.applications')}
                      </label>
                      <span className="text-[10px] text-text-muted font-light mt-0.5 font-sans">
                        {t('dashboard.modal.ai.applicationsDesc')}
                      </span>
                    </div>
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
                {t('dashboard.modal.ai.close')}
              </button>
              {!aiLoading && (
                <Button type="submit" variant="ai" onClick={handleAiOptimize} disabled={!importedOffer}>
                  <Sparkles className="w-4 h-4 stroke-[1.75]" />
                  {t('dashboard.modal.ai.start')}
                </Button>
              )}
            </div>
          </div>
        </ModalScrim>
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

      {/* Modal para crear un CV en blanco */}
      {isCreateOpen && (
        <ModalScrim
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.cvs.create')}
          onClick={(event) => {
            if (event.target === event.currentTarget && !createLoading) setIsCreateOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-surface border border-subtle rounded-2xl shadow-dialog p-6 relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-56 h-56 bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-text font-display">
                    {t('dashboard.cvs.create')}
                  </h3>
                  <p className="text-xs text-text-muted mt-1 font-sans">
                    {t('dashboard.cvs.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createLoading}
                  aria-label={t('common.close')}
                  className="p-1.5 rounded-[8px] border border-subtle bg-canvas text-text-muted hover:text-text transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>

              <form onSubmit={handleCreateQuick} className="space-y-4">
                <input
                  autoFocus
                  type="text"
                  required
                  maxLength={120}
                  value={newCvTitle}
                  onChange={(e) => setNewCvTitle(e.target.value)}
                  placeholder={t('dashboard.cvs.placeholder')}
                  className="w-full bg-canvas border border-control rounded-[8px] px-4 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-colors"
                  disabled={createLoading}
                />
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={createLoading}
                    className="px-4 py-2.5 text-sm font-semibold text-text-muted hover:text-text transition-colors disabled:opacity-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <Button
                    type="submit"
                    disabled={createLoading || !newCvTitle.trim()}
                    loading={createLoading}
                  >
                    {!createLoading && <Plus className="w-4 h-4 stroke-[1.75]" />}
                    {t('dashboard.cvs.create')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalScrim>
      )}

      {previewCv && <CvQuickPreviewModal cv={previewCv} onClose={() => setPreviewCv(null)} />}
    </div>
  );
}
