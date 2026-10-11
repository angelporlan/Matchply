"use client";

import { shouldResetAiOperation } from '@/lib/ai-operation-retry';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CV } from '@/db/schema';
import MarkdownEditor from './MarkdownEditor';
import PdfViewer, { PdfDownloadLink, type PdfZoom } from './PdfViewer';
import ResumeSheet from './ResumeSheet';
import EditorFormatBar from './EditorFormatBar';
import EditorReviewRail, { type AdaptDraft, type LinkedOffer } from './EditorReviewRail';
import EditorCvMenu, { type EditorCvChoice } from './EditorCvMenu';
import { updateCvStyling, saveCvContent, selectCvVariant } from '@/app/dashboard/actions';
import { consumeCvOptimization } from '@/lib/cv-optimization/client';
import { isOptimizeModeId, type OptimizeModeId } from '@/lib/optimize-modes';
import type { CvOptimizationView, OptimizeProgress } from '@/lib/cv-optimization/types';
import { EditorPersistenceContext, useEditorPersistence } from './EditorPersistence';
import { CvVariantConfirm } from './CvVariantConfirm';
import { useCvGenerationAnimation } from './useCvGenerationAnimation';
import { resolveOfferIdentity } from '@/lib/offer-fields';
import { ApplicationSentPrompt } from '@/components/cv/ApplicationSentPrompt';
import { markApplicationSent } from '@/app/dashboard/applications/actions';
import {
  claimWaitedDownload,
  noteDownloadForSentPrompt,
  sentDownloadCvKey,
  sentPromptKey,
  shouldOpenSentPrompt,
} from '@/lib/application-sent';
import { Button } from '@/components/ui/Button';
import { ModalScrim } from '@/components/ui/ModalScrim';
import {
  Sparkles, ArrowLeft,
  Crown, Briefcase, Building2, Link, FileText, CheckCircle2, X, RefreshCw,
  AlertCircle
} from 'lucide-react';
import LinkNext from 'next/link';
import Sidebar from '@/app/dashboard/Sidebar';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { parsePdfBreakHeader } from '@/lib/pdf-page-breaks';
import { useAiPromptDebug } from '@/components/ai/AiPromptDebugContext';
import { trackUmamiConversion } from '@/components/analytics/UmamiTracker';
import { PlanUsageProvider, usePlanUsage } from '@/components/subscription/PlanUsageProvider';
import { PlanFeedback, UpgradePaywall } from '@/components/subscription/UpgradePaywall';
import { UsagePanel } from '@/components/subscription/UsagePanel';
import { CvReplacementDialog } from '@/components/subscription/CvReplacementDialog';
import { reportPlanRestriction, refreshPlanUsage } from '@/lib/plan-presentation';
import { consumeCvAiStream } from '@/lib/cv-ai-stream';

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
  guestCanDownloadPdf?: boolean;
  cvChoices?: EditorCvChoice[];
  linkedOffer?: LinkedOffer | null;
  optimization?: CvOptimizationView | null;
  pendingOptimizationJobId?: string;
  pendingOptimizationIsRetry?: boolean;
  pendingOptimizationMode?: OptimizeModeId;
}

const loadingTips = [
  "Extrayendo palabras clave y requisitos de la oferta...",
  "Analizando tu experiencia y habilidades del CV Base...",
  "Alineando tu perfil con los requisitos clave...",
  "Tip: El formato Harvard destaca tus logros usando verbos de acción.",
  "Tip: Puedes editar cualquier texto directamente después de la optimización.",
  "Tip: Recuerda que puedes descargar el PDF en cualquier momento.",
  "Tip: El motor de IA PRO ofrece una mayor precisión semántica."
];

const loadingTipsEn = [
  "Extracting keywords and job description requirements...",
  "Analyzing your experience and skills from the Base CV...",
  "Aligning your profile with key job requirements...",
  "Tip: The Harvard format highlights achievements using action verbs.",
  "Tip: You can edit any text directly after optimization is complete.",
  "Tip: Remember you can download the PDF at any time.",
  "Tip: The PRO AI engine offers greater semantic precision."
];

export default function EditorClient(props: EditorClientProps) {
  return <PlanUsageProvider><EditorPersistenceContext.Provider value={true}><EditorContent key={props.cv.id} {...props} /></EditorPersistenceContext.Provider><PlanFeedback /></PlanUsageProvider>;
}

function EditorContent({ cv, isPremium, availablePrompts, baseCvContent, user, isGuest = false, guestCanDownloadPdf = false, cvChoices = [], linkedOffer = null, optimization: initialOptimization = null, pendingOptimizationJobId, pendingOptimizationIsRetry, pendingOptimizationMode }: EditorClientProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { data: planUsage } = usePlanUsage();
  const readOnly = !planUsage || planUsage.cv.readOnlyIds.includes(cv.id);
  const [replacement, setReplacement] = useState<{ choices: Array<{ id: string; title: string }>; retry: (cvId: string) => void } | null>(null);

  // Shared Save Status State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [guestCanDownload, setGuestCanDownload] = useState(guestCanDownloadPdf);

  const [fullscreenPanel, setFullscreenPanel] = useState<'none' | 'editor'>('none');

  // Estados de Estilo
  const templateName = cv.templateName || 'harvard';
  const [accentColor, setAccentColor] = useState(cv.accentColor || '#1a5f7a');
  const [fontFamily, setFontFamily] = useState(cv.fontFamily || 'helvetica');
  const [pageMargin, setPageMargin] = useState(cv.pageMargin || 36);
  const [scale, setScale] = useState(cv.scale || 1.0);
  const [cvTitle, setCvTitle] = useState(cv.title);
  const [surface, setSurface] = useState<'document' | 'source' | 'diff'>('document');
  const [contentVersion, setContentVersion] = useState(0);

  const [sessionBase, setSessionBase] = useState<string | null>(null);
  const [sentPromptOpen, setSentPromptOpen] = useState(false);
  const [optimization, setOptimization] = useState(initialOptimization);
  const [activeMode, setActiveMode] = useState<OptimizeModeId>(isOptimizeModeId(cv.activeOptimizeMode || '') ? cv.activeOptimizeMode as OptimizeModeId : 'optimize_adapted');
  const [variantBusy, setVariantBusy] = useState(false);
  const variantSwitchLock = useRef(false);
  const [optimizeProgress, setOptimizeProgress] = useState<OptimizeProgress | null>(null);
  const [confirmVariant, setConfirmVariant] = useState<OptimizeModeId | null>(null);
  const {preview:liveGeneration,update:setLiveGeneration,finish:finishPreview}=useCvGenerationAnimation();
  const retryRequest = useRef<{ mode: OptimizeModeId; id: string } | null>(null);
  const diffBase = optimization?.sourceMarkdown || baseCvContent || sessionBase;
  const [mobilePane, setMobilePane] = useState<'document' | 'review'>('document');
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviewContent, setReviewContent] = useState(cv.content);
  const [zoom, setZoom] = useState<PdfZoom>('fit');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageBreaks, setPageBreaks] = useState<number[] | null>(null);
  const [focusAdapt, setFocusAdapt] = useState(false);
  const styleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styleRef = useRef({ accentColor: cv.accentColor || '#1a5f7a', fontFamily: cv.fontFamily || 'helvetica', pageMargin: cv.pageMargin || 36, scale: cv.scale || 1.0 });
  const adaptTitleRef = useRef<HTMLInputElement>(null);
  const diffViewedRef = useRef(false);
  const noteDiffViewed = () => {
    if (diffViewedRef.current) return;
    diffViewedRef.current = true;
    trackUmamiConversion('diff_viewed');
  };

  // Estado del Cajón de Optimización por IA
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiStreamContent, setAiStreamContent] = useState('');
  const [cvContent, setCvContent] = useState(cv.content);
  const pendingCvRequest = useRef<{ signature: string; id: string } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStep, setStreamingStep] = useState('');
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const { inspectOrExecutePrompt } = useAiPromptDebug();
  const currentVariant = optimization?.variants.find(v => v.modeId === activeMode);
  const persistence = useEditorPersistence(cv.id, cv.content, optimization && currentVariant ? { optimizationId: optimization.id, modeId: activeMode, revision: currentVariant.revision } : undefined, setSaveStatus, setStreamingError);
  const onEditorContent = (content: string) => { setReviewContent(content); setCvContent(content); persistence.changed(content); };
  const displayContent = liveGeneration?.content ?? reviewContent;
  const receiveProgress = (progress: OptimizeProgress) => {
    setOptimizeProgress(progress); setStreamingStep(t(`variants.stages.${progress.stage}`));
    if (progress.preview) setLiveGeneration({modeId:progress.preview.modeId,content:progress.preview.content});
    else if (progress.stage !== 'completed') setLiveGeneration(current => current && progress.variants.find(v=>v.modeId===current.modeId)?.status !== 'ready' ? {...current,content:''} : current);
  };
  const switchVariant = async (mode: OptimizeModeId) => {
    if (!optimization || mode === activeMode || variantSwitchLock.current) return;
    variantSwitchLock.current = true; setVariantBusy(true); setStreamingError(null);
    try {
      if (!await persistence.flush()) return;
      const selected = await selectCvVariant(cv.id, optimization.id, mode);
      if (!selected.success || selected.content === undefined || selected.revision === undefined) throw new Error(selected.error || t('variants.saveError'));
      setActiveMode(mode); setReviewContent(selected.content); setCvContent(selected.content);
      persistence.reset(selected.content, { optimizationId: optimization.id, modeId: mode, revision: selected.revision });
      setPageCount(null); setPageBreaks(null); setContentVersion(v => v+1);
      setSaveStatus('saved');
    } catch (error) { setStreamingError(error instanceof Error ? error.message : t('variants.saveError')); }
    finally { variantSwitchLock.current = false; setVariantBusy(false); }
  };
  const generateVariant = async (mode: OptimizeModeId, retry = false) => {
    if (!optimization || variantSwitchLock.current) return;
    variantSwitchLock.current = true; setVariantBusy(true); setStreamingError(null);
    try {
      if (!await persistence.flush()) return;
      setIsStreaming(true); setLiveGeneration({modeId:mode,content:''});
      setStreamingStep(t('variants.stages.queued'));
      if (retryRequest.current?.mode !== mode) retryRequest.current = { mode, id: crypto.randomUUID() };
      const response = await fetch(`/api/ai/optimize/${optimization.id}/${retry ? 'retry' : 'generate'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(retry ? {modes:[mode]} : {mode}), requestId: retryRequest.current.id }) });
      if (!response.ok) { const problem = await response.json(); if (shouldResetAiOperation(problem)) retryRequest.current = null; throw new Error(problem.error || t('variants.retryError')); }
      await consumeCvOptimization(response, receiveProgress);
      const refreshed = await fetch(`/api/cv/${cv.id}/optimization`, { cache: 'no-store' });
      const result = await refreshed.json();
      if (!refreshed.ok || !result.optimization) throw new Error(t('variants.retryError'));
      const view = result.optimization as CvOptimizationView; setOptimization(view);
      const variant = view.variants.find(v=>v.modeId===mode);
      if (variant?.status !== 'ready') throw new Error(t('variants.retryError'));
      await finishPreview({modeId:mode,content:variant.content});
      const selected = await selectCvVariant(cv.id,view.id,mode);
      if (!selected.success || selected.content === undefined || selected.revision === undefined) throw new Error(selected.error || t('variants.saveError'));
      setActiveMode(mode); setCvContent(selected.content); setReviewContent(selected.content);
      persistence.reset(selected.content,{optimizationId:view.id,modeId:mode,revision:selected.revision});
      setPageCount(null); setPageBreaks(null); setContentVersion(v=>v+1); setSaveStatus('saved');
      retryRequest.current = null; setOptimizeProgress(null);
    } catch (error) {
      // A failed job can still have changed the variant status. Keep the saved
      // document visible and expose its retry action without requiring a reload.
      const refreshed = await fetch(`/api/cv/${cv.id}/optimization`, { cache: 'no-store' }).then(async response => response.ok ? response.json() : null).catch(() => null);
      if (refreshed?.optimization?.id === optimization.id) {
        const view = refreshed.optimization as CvOptimizationView;
        setOptimization(view);
        if (view.variants.find(v=>v.modeId===mode)?.status === 'error') retryRequest.current = null;
      }
      setStreamingError(error instanceof Error ? error.message : t('variants.retryError'));
    }
    finally { variantSwitchLock.current = false; setVariantBusy(false); setIsStreaming(false); setLiveGeneration(null); setOptimizeProgress(null); }
  };
  
  useEffect(() => {
    if (saveStatus !== 'saved') return;
    setCvContent(cv.content);
    setReviewContent(cv.content);
    if (initialOptimization) { setOptimization(initialOptimization); setActiveMode(cv.activeOptimizeMode as OptimizeModeId); }
    persistence.reset(cv.content, initialOptimization && isOptimizeModeId(cv.activeOptimizeMode || '') ? { optimizationId: initialOptimization.id, modeId: cv.activeOptimizeMode as OptimizeModeId, revision: initialOptimization.variants.find(v => v.modeId === cv.activeOptimizeMode)?.revision || 0 } : undefined);
  }, [cv.content, initialOptimization?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const isContentEmpty = !reviewContent || reviewContent.trim().length === 0;
    if (isStreaming && isContentEmpty) {
      interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % (language === 'es' ? loadingTips.length : loadingTipsEn.length));
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming, reviewContent, language]);
  const [aiFormData, setAiFormData] = useState({
    jobTitle: '',
    company: '',
    url: '',
    platform: 'linkedin',
    jobDescription: '',
    promptId: availablePrompts.find(p => p.isActive)?.id || '',
    addToApplications: 'true',
  });

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

    if (searchParams.get('diff') === '1' && baseCvContent) {
      noteDiffViewed();
      setSurface('diff');
      setMobilePane('document');
      if (!shouldOptimize && !shouldImport) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    if (pendingOptimizationJobId) {
      void runOptimizeStream({ jobId: pendingOptimizationJobId, resultCvId: cv.id, baseCvId: cv.id, resumeMode:pendingOptimizationMode || (pendingOptimizationIsRetry ? cv.activeOptimizeMode : undefined) });
    } else if (shouldOptimize || (!shouldImport && (() => { try { const saved = JSON.parse(sessionStorage.getItem('matchply_optimize_params') || '{}'); return saved.baseCvId === cv.id || saved.resultCvId === cv.id; } catch { return false; } })())) {
      window.history.replaceState(null, '', window.location.pathname);
      const paramsStr = sessionStorage.getItem('matchply_optimize_params');
      if (paramsStr) {

        try {
          const params = JSON.parse(paramsStr);
          if (typeof params.activationBase === 'string' && params.activationBase.trim()) {
            setSessionBase(params.activationBase);
          }
          runOptimizeStream(params);
        } catch (e) {
          console.error("Error parsing optimize params from session:", e);
        }
      }
    } else if (shouldImport) {
      window.history.replaceState(null, '', window.location.pathname);
      const rawText = sessionStorage.getItem('matchply_import_raw_text');
      if (rawText) {

        runImportStream(rawText);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Recover once per CV mount; changes must not re-admit a job.

  const runOptimizeStream = async (params: any) => {
    params = { ...params, requestId: typeof params.requestId === 'string' ? params.requestId : crypto.randomUUID() };
    sessionStorage.setItem('matchply_optimize_params', JSON.stringify(params));
    const proceed = params.jobId ? true : await inspectOrExecutePrompt({
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
    setLiveGeneration({modeId:isOptimizeModeId(params.resumeMode || '') ? params.resumeMode : 'optimize_adapted',content:''});
    setStreamingError(null);
    setSaveStatus('saving');
    setStreamingStep(t('editor.aiModal.steps.keywords'));

    try {
      const response = params.jobId ? new Response(JSON.stringify({ jobId: params.jobId, cvId: params.resultCvId || params.targetCvId || cv.id }), { status: 202 }) : await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const text = await response.text();
        let problem: unknown = text;
        try { problem = JSON.parse(text); } catch { /* Legacy errors may be plain text. */ }
        if (shouldResetAiOperation(problem)) {
          pendingCvRequest.current = null;
          delete params.requestId;
          sessionStorage.setItem('matchply_optimize_params', JSON.stringify(params));
        }
        reportPlanRestriction(problem, 'editor-ai');
        throw new Error(text || 'Error en la optimización.');
      }

      const admission = await response.clone().json();
      params.jobId = admission.jobId; params.resultCvId = admission.cvId;
      sessionStorage.setItem('matchply_optimize_params', JSON.stringify(params));
      const result = await consumeCvOptimization(response, receiveProgress);
      const refreshed = await fetch(`/api/cv/${result.cvId}/optimization`, { cache: 'no-store' });
      const view = (await refreshed.json()).optimization as CvOptimizationView;
      if (!refreshed.ok || !view) throw new Error(t('variants.retryError'));
      const selected = [params.resumeMode, 'optimize_adapted', 'optimize_honest', 'optimize_aggressive'].map(mode => view.variants.find(v => v.modeId === mode && v.status === 'ready')).find(Boolean)!;
      await finishPreview({modeId:selected.modeId,content:selected.content});
      if (result.cvId !== cv.id) router.push(`/editor/${result.cvId}`);
      else {
        setOptimization(view); setActiveMode(selected.modeId); setCvContent(selected.content); setReviewContent(selected.content);
        persistence.reset(selected.content, { optimizationId: view.id, modeId: selected.modeId, revision: selected.revision });
        setPageCount(null); setPageBreaks(null); setContentVersion(v=>v+1);
      }
      setLiveGeneration(null);
      setOptimizeProgress(null);
      setStreamingStep(t('editor.aiModal.steps.success'));
      setSaveStatus('saved');
      trackUmamiConversion('cv_optimized');
      sessionStorage.removeItem('matchply_optimize_params');
      pendingCvRequest.current = null;
      // La API ya revalidó /dashboard en servidor; purgar la caché del router del cliente una sola vez.
      refreshPlanUsage();
      router.refresh();
      setTimeout(() => {
        setIsStreaming(false);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setStreamingError(err.message || 'Ocurrió un error al optimizar el currículum.');
      if (params.jobId) { const status = await fetch(`/api/ai/jobs/${params.jobId}`).then(r => r.json()).catch(() => null); if (status?.status === 'failed') { delete params.jobId; delete params.resultCvId; delete params.requestId; sessionStorage.setItem('matchply_optimize_params', JSON.stringify(params)); } }
      setSaveStatus('error');
      setIsStreaming(false);
      setLiveGeneration(null);
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
      const importRequest = JSON.parse(sessionStorage.getItem('matchply_import_request') || '{}');
      if (!importRequest.requestId) { importRequest.requestId = crypto.randomUUID(); sessionStorage.setItem('matchply_import_request', JSON.stringify(importRequest)); }
      formData.append('requestId', importRequest.requestId);
      if (importRequest.confirmOverwrite) formData.append('confirmOverwrite', 'true');

      const response = await fetch(`/api/cv/import?lang=${language}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const text = await response.text();
        let problem: unknown = text;
        try { problem = JSON.parse(text); } catch { /* Legacy errors may be plain text. */ }
        if (shouldResetAiOperation(problem)) {
          delete importRequest.requestId;
          sessionStorage.setItem('matchply_import_request', JSON.stringify(importRequest));
        }
        reportPlanRestriction(problem, 'editor-ai');
        throw new Error(text || 'Error al importar.');
      }

      const result = await consumeCvAiStream(response, content => {
        setCvContent(content); setReviewContent(content);
        setStreamingStep(language === 'es' ? 'Transcribiendo contenido a Markdown Harvard...' : 'Transcribing content to Harvard Markdown...');
      });
      setCvContent(result.content); setReviewContent(result.content);
      setStreamingStep(language === 'es' ? 'Currículum importado con éxito!' : 'Resume imported successfully!');
      setSaveStatus('saved');
      trackUmamiConversion('cv_imported');
      sessionStorage.removeItem('matchply_import_raw_text');
      sessionStorage.removeItem('matchply_import_request');
      refreshPlanUsage();
      router.refresh();
      setTimeout(() => {
        setIsStreaming(false);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setStreamingError(err.message || 'Ocurrió un error al importar el currículum.');
      setCvContent(cv.content); setReviewContent(cv.content);
      setSaveStatus('error');
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (!linkedOffer?.id || !linkedOffer.status) return;
    const offerKey = sentPromptKey(linkedOffer.id);
    const cvKey = sentDownloadCvKey(cv.id);
    const claimed = claimWaitedDownload({
      cvMark: sessionStorage.getItem(cvKey),
      offerId: linkedOffer.id,
      offerStatus: linkedOffer.status,
      offerMark: sessionStorage.getItem(offerKey),
    });
    if (claimed) {
      if (claimed.writeOffer) sessionStorage.setItem(claimed.offerKey, claimed.offerMark);
      sessionStorage.removeItem(cvKey);
    }
    const mark = sessionStorage.getItem(offerKey);
    const requested = new URLSearchParams(window.location.search).get('sent') === '1';
    if (shouldOpenSentPrompt({ status: linkedOffer.status, mark, requested })) {
      setSentPromptOpen(true);
    }
  }, [linkedOffer?.id, linkedOffer?.status, cv.id]);

  const notePdfDownloaded = () => {
    const decision = noteDownloadForSentPrompt({
      cvId: cv.id,
      offerId: linkedOffer?.id ?? null,
      offerStatus: linkedOffer?.status ?? null,
      offerMark: linkedOffer?.id ? sessionStorage.getItem(sentPromptKey(linkedOffer.id)) : null,
    });
    if (decision.scope === 'none') return;
    sessionStorage.setItem(decision.key, decision.mark);
    if (decision.open) setSentPromptOpen(true);
  };

  const closeSentPrompt = (answer: 'yes' | 'no' | 'later') => {
    if (linkedOffer?.id) sessionStorage.setItem(sentPromptKey(linkedOffer.id), 'done');
    setSentPromptOpen(false);
    if (answer === 'yes') void markApplicationSent(linkedOffer!.id);
  };

  const revertToBase = async () => {
    if (!diffBase) return;
    onEditorContent(diffBase);
    setContentVersion((version) => version + 1);
    setSaveStatus('saving');
    await persistence.flush();
  };

  const scheduleStyleSave = () => {
    if (styleTimerRef.current) clearTimeout(styleTimerRef.current);
    styleTimerRef.current = setTimeout(async () => {
      const style = styleRef.current;
      setSaveStatus('saving');
      const result = await updateCvStyling(cv.id, style);
      if (!result.success) {
        setSaveStatus('error');
        return;
      }
      setSaveStatus((current) => (current === 'saving' ? 'saved' : current));
    }, 400);
  };

  const applyStyle = (partial: Partial<{ accentColor: string; fontFamily: string; pageMargin: number; scale: number }>) => {
    if (readOnly) { reportPlanRestriction({ code: 'CV_READ_ONLY' }, 'editor-style'); return; }
    const next = { ...styleRef.current, ...partial };
    styleRef.current = next;
    if (partial.fontFamily !== undefined) setFontFamily(partial.fontFamily);
    if (partial.pageMargin !== undefined) setPageMargin(partial.pageMargin);
    if (partial.scale !== undefined) setScale(partial.scale);
    if (partial.accentColor !== undefined) setAccentColor(partial.accentColor);
    scheduleStyleSave();
  };

  useEffect(() => {
    return () => {
      if (styleTimerRef.current) clearTimeout(styleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || surface === 'document') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [role="dialog"], [role="menu"], [contenteditable="true"]')) return;
      if (menuOpen || isAiOpen) return;
      setSurface('document');
      setMobilePane('document');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [surface, menuOpen, isAiOpen]);

  useEffect(() => {
    if (!focusAdapt) return;
    adaptTitleRef.current?.focus();
    setFocusAdapt(false);
  }, [focusAdapt, mobilePane, surface]);

  // La API reserva y crea el destino antes de generar la nueva versión.
  const handleAiOptimize = async (e?: React.FormEvent, confirmed = false, replacementCvId?: string) => {
    e?.preventDefault();
    setAiError(null);
    if (!aiFormData.jobDescription.trim()) {
      setAiError(t('editor.aiModal.requiredError'));
      return;
    }
    const identity = resolveOfferIdentity({
      jobTitle: aiFormData.jobTitle,
      company: aiFormData.company,
      jobDescription: aiFormData.jobDescription,
    });

    if (readOnly) { reportPlanRestriction({ code: 'CV_READ_ONLY' }, 'editor-adapt'); return; }
    if (!await persistence.flush()) return;
    if (planUsage?.usage.general.remaining === 0) { reportPlanRestriction({ code: 'QUOTA_EXCEEDED', bucket: 'general' }, 'editor-adapt'); return; }
    const allCvs = planUsage?.cv.cvs || cvChoices;
    const adaptedCount = allCvs.filter(item => !item.isBase).length;
    if (!replacementCvId && planUsage && ((planUsage.limits.maxAdaptedCvs !== null && adaptedCount >= planUsage.limits.maxAdaptedCvs) || (planUsage.limits.maxCvs !== null && planUsage.cv.total >= planUsage.limits.maxCvs))) {
      const choices = allCvs.filter(item => !item.isBase && planUsage.cv.activeIds.includes(item.id));
      if (choices.length) setReplacement({ choices, retry: id => { void handleAiOptimize(undefined, true, id); } });
      else reportPlanRestriction({ code: 'CV_LIMIT' }, 'editor-adapt');
      return;
    }
    setAiLoading(true);
    setAiStep(t('editor.aiModal.steps.keywords'));

    try {
      const input = {
        baseCvId: cv.id,
        jobTitle: identity.jobTitle,
        company: identity.company,
        url: aiFormData.url,
        platform: aiFormData.platform,
        jobDescription: aiFormData.jobDescription,
        promptId: aiFormData.promptId,
        addToApplications: aiFormData.addToApplications === 'true',
        ...(replacementCvId ? { targetCvId: replacementCvId } : {}),
        confirmOverwrite: confirmed,
      };
      const signature = JSON.stringify(input);
      if (pendingCvRequest.current?.signature !== signature) pendingCvRequest.current = { signature, id: crypto.randomUUID() };
      const params = { ...input, requestId: pendingCvRequest.current.id };
      trackUmamiConversion('offer_pasted');
      sessionStorage.setItem('matchply_optimize_params', JSON.stringify(params));
      setIsAiOpen(false);
      await runOptimizeStream(params);
      setAiLoading(false);

    } catch (err: any) {
      setAiError(err.message || t('dashboard.errors.unexpected'));
      setAiLoading(false);
    }
  };

  const showDocument = (isLg || mobilePane === 'document') && surface === 'document';
  const showSource = (isLg || mobilePane === 'document') && (surface === 'source' || surface === 'diff');
  const showReview = isLg || mobilePane === 'review';

  useEffect(() => {
    if (!scrollTarget || surface !== 'document') return;
    const id = scrollTarget;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'center' });
      setScrollTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollTarget, surface]);

  useEffect(() => {
    const text = reviewContent;
    if (isStreaming || !text.trim()) {
      if (!text.trim()) {
        setPageCount(null);
        setPageBreaks(null);
      }
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const style = styleRef.current;
        const response = await fetch('/api/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: text,
            template: templateName,
            accentColor: style.accentColor || null,
            fontFamily: style.fontFamily || 'helvetica',
            pageMargin: style.pageMargin || 36,
            scale: style.scale || 1,
          }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const pages = Number(response.headers.get('X-Pdf-Pages'));
        const breaks = parsePdfBreakHeader(response.headers.get('X-Pdf-Breaks'));
        await response.body?.cancel();
        if (Number.isFinite(pages) && pages >= 1) {
          setPageCount(pages);
          setPageBreaks(breaks);
        }
      } catch {
        // Aborted renders and failed counts leave the previous page total in place.
      }
    }, 700);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [reviewContent, accentColor, fontFamily, pageMargin, scale, templateName, isStreaming]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={user} isPremium={isPremium} isGuest={isGuest} />
      <div className="flex-1 h-[calc(100dvh-4rem)] md:h-screen flex flex-col relative overflow-hidden">
      <header className="bg-surface border-b border-subtle px-4 sm:px-6 py-3 shrink-0 relative z-30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <LinkNext
              href="/dashboard"
              className="text-text-muted hover:text-text min-h-11 min-w-11 inline-flex items-center justify-center rounded-[8px] hover:bg-surface-muted"
              aria-label={t('editor.header.backToDashboard')}
            >
              <ArrowLeft className="w-4 h-4 stroke-[1.75]" aria-hidden />
            </LinkNext>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!readOnly ? <EditorCvMenu
                  cvId={cv.id}
                  title={cvTitle}
                  choices={cvChoices.length > 0 ? cvChoices : [{ id: cv.id, title: cvTitle, isBase: cv.isBase, isPrincipal: cv.isPrincipal }]}
                  onTitleChange={setCvTitle}
                  onOpenChange={setMenuOpen}
                /> : <span className="font-semibold text-sm">{cvTitle}</span>}
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase ? 'bg-surface-muted text-text-muted border-subtle' : 'bg-warning-surface text-warning-text border-warning-text/20'}`}>
                  {cv.isBase ? t('editor.header.titleBase') : t('editor.header.titleOptimized')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <PdfDownloadLink
              cvId={cv.id}
              isGuest={isGuest}
              guestCanDownload={guestCanDownload}
              onGuestDownloadConsumed={() => setGuestCanDownload(false)}
              onDownloaded={notePdfDownloaded}
              className="btn-raised"
              disabled={isStreaming || variantBusy}
              beforeDownload={persistence.flush}
              variantQuery={optimization ? `&optimizationId=${optimization.id}&modeId=${activeMode}` : ''}
            />
          </div>
        </div>
      </header>

      {!readOnly && <EditorFormatBar
        fontFamily={fontFamily}
        pageMargin={pageMargin}
        scale={scale}
        accentColor={accentColor}
        onFontChange={(value) => applyStyle({ fontFamily: value })}
        onMarginChange={(value) => applyStyle({ pageMargin: value })}
        onScaleChange={(value) => applyStyle({ scale: value })}
        onAccentChange={(value) => applyStyle({ accentColor: value })}
        zoom={zoom}
        onZoomChange={setZoom}
        surface={surface}
        onToggleMarkdown={() => {
          setSurface((current) => (current === 'source' ? 'document' : 'source'));
          setMobilePane('document');
        }}
        hasDiff={Boolean(diffBase)}
        onToggleDiff={() => {
          if (surface !== 'diff') noteDiffViewed();
          setSurface((current) => (current === 'diff' ? 'document' : 'diff'));
          setMobilePane('document');
        }}
        saveLabel={
          saveStatus === 'saving'
            ? t('editor.footer.saving')
            : saveStatus === 'error'
              ? t('editor.footer.error')
              : (isGuest ? t('editor.footer.savedGuest') : t('editor.footer.saved'))
        }
        variants={optimizeProgress?.variants || optimization?.variants}
        activeMode={activeMode}
        onSelectVariant={mode => { if (optimization?.variants.find(v=>v.modeId===mode)?.status === 'idle') setConfirmVariant(mode); else void switchVariant(mode); }}
        onRetryVariant={mode => { void generateVariant(mode,true); }}
        variantBusy={variantBusy || isStreaming}
      />}

      {!isStreaming && planUsage?.firstValueAt && planUsage.plan !== 'pro' && <div className="m-4"><UpgradePaywall source="first-value" dismissible accountId={cv.userId} /></div>}
      {readOnly && <p role="status" className="m-4 rounded-[8px] bg-warning-surface p-3 text-sm text-warning-text">{t('plans.readOnlyBody')} <LinkNext href="/dashboard" className="underline">{t('plans.chooseActive')}</LinkNext></p>}

      {isStreaming && (
        <div role="status" className="relative mx-4 sm:mx-6 mt-4 overflow-hidden p-3 bg-ai-surface border border-ai-action/20 text-ai-action text-xs rounded-[8px] flex flex-wrap gap-2 items-center justify-between z-15">
          <span aria-hidden className="cv-generation-sweep absolute bottom-0 left-0 h-0.5 w-1/3 bg-ai-action" />
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ai-action" aria-hidden />
            <span className="font-bold uppercase tracking-wider font-display text-[10px]">Asistente de IA Matchply</span>
            <span className="text-slate-400">|</span>
            <span className="font-medium text-text">{liveGeneration ? `${t(`variants.names.${liveGeneration.modeId}`)} · ` : ''}{streamingStep}</span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 bg-ai/10 rounded border border-ai/20 font-bold">
            {displayContent.split(/\s+/).filter(Boolean).length} {t('variants.words')}
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

      {!readOnly && !isLg && (
        <div role="tablist" aria-label={cvTitle} className="flex shrink-0 border-b border-subtle bg-surface">
          {(['document', 'review'] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              role="tab"
              aria-selected={mobilePane === pane}
              className={`min-h-11 flex-1 text-sm font-semibold ${mobilePane === pane ? 'text-text border-b-2 border-text' : 'text-text-muted'}`}
              onClick={() => setMobilePane(pane)}
            >
              {t(`editor.tabs.${pane}`)}
            </button>
          ))}
        </div>
      )}

      <div className={`flex-1 min-h-0 flex overflow-hidden ${isLg ? 'flex-row' : 'flex-col'}`}>
        {readOnly && <PdfViewer cvId={cv.id} version={String(cv.updatedAt)} zoom={zoom} variant="sheet" />}
        {!readOnly && (showDocument || showSource) && (
          <div data-cv-generating={liveGeneration ? 'true' : undefined} aria-busy={isStreaming} className={`h-full min-h-0 min-w-0 flex flex-col flex-1 relative ${showSource ? 'p-4 sm:p-6' : ''}`}>
            {showDocument && (
              <div className="contents" ref={node=>{ if (node) node.inert=Boolean(liveGeneration); }}>
              <ResumeSheet
                cvId={cv.id}
                content={displayContent}
                fontFamily={fontFamily}
                pageMargin={pageMargin}
                scale={scale}
                accentColor={accentColor}
                zoom={zoom}
                pageBreaks={liveGeneration ? null : pageBreaks}
                onContentChange={liveGeneration ? () => {} : onEditorContent}
                setSaveStatus={setSaveStatus}
              />
              </div>
            )}
            {showSource && (
              <MarkdownEditor
                key={`${surface}-${contentVersion}`}
                cvId={cv.id}
                initialContent={displayContent}
                originalContent={diffBase || undefined}
                forcedMode={surface === 'diff' ? 'diff' : 'markdown'}
                onContentChange={liveGeneration ? () => {} : onEditorContent}
                saveStatus={saveStatus}
                setSaveStatus={setSaveStatus}
                isFullScreen={fullscreenPanel === 'editor'}
                onToggleFullScreen={() => setFullscreenPanel((prev) => (prev === 'editor' ? 'none' : 'editor'))}
                isAiStreaming={isStreaming}
                streamingStep={streamingStep}
                onRevert={diffBase ? () => { void revertToBase(); } : undefined}
              />
            )}
            {isStreaming && !displayContent.trim() && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white/90 dark:bg-canvas/95 backdrop-blur-md select-none z-50 transition-all duration-300">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border border-purple-500/20 flex items-center justify-center bg-purple-500/5 shadow-inner">
                    <RefreshCw className="w-6 h-6 text-ai animate-spin stroke-[1.75]" />
                  </div>
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-t-2 border-ai animate-pulse" />
                </div>
                
                <h4 className="text-sm font-bold text-text mb-2 font-display uppercase tracking-wider">
                  {language === 'es' ? 'Optimizando con IA Matchply' : 'Optimizing with Matchply AI'}
                </h4>
                
                <p className="text-xs text-ai dark:text-purple-300 font-semibold tracking-wide h-6 flex items-center justify-center animate-pulse mb-3 font-display">
                  {streamingStep || (language === 'es' ? 'Preparando el motor de Inteligencia Artificial...' : 'Preparing AI engine...')}
                </p>
                
                <p className="text-[11px] text-slate-500 dark:text-text-muted font-light max-w-sm h-10 flex items-center justify-center leading-relaxed font-sans px-4 py-2 bg-control/5 dark:bg-white/5 rounded-xl border border-slate-500/10 dark:border-white/5 shadow-sm">
                  {language === 'es' ? loadingTips[tipIndex] : loadingTipsEn[tipIndex]}
                </p>
              </div>
            )}
          </div>
        )}

        {!readOnly && showReview && (
          <div ref={node=>{ if (node) node.inert=Boolean(liveGeneration); }} className={`h-full min-h-0 overflow-hidden ${isLg ? 'w-[320px] xl:w-[360px] shrink-0' : 'flex-1'}`}>
            <EditorReviewRail
              cvId={cv.id}
              content={reviewContent}
              onContentChange={onEditorContent}
              setSaveStatus={setSaveStatus}
              isBase={cv.isBase}
              linkedOffer={linkedOffer}
              pageCount={pageCount}
              form={aiFormData}
              onFormChange={setAiFormData}
              promptOptions={availablePrompts.map((prompt) => ({
                id: prompt.id,
                label: language === 'en' && prompt.nameEn ? prompt.nameEn : prompt.name,
              }))}
              aiError={aiError}
              aiLoading={aiLoading}
              onSubmit={() => { void handleAiOptimize(); }}
              titleInputRef={adaptTitleRef}
              analysis={optimization?.analysis || null}
              activeMode={activeMode}
            />
          </div>
        )}
      </div>

      {/* Cajón Lateral / Modal de Optimización por IA */}
      <CvVariantConfirm mode={confirmVariant} onClose={()=>setConfirmVariant(null)} onConfirm={()=>{ const mode=confirmVariant; setConfirmVariant(null); if (mode) void generateVariant(mode); }} />
      <ApplicationSentPrompt
        open={sentPromptOpen}
        onYes={() => closeSentPrompt('yes')}
        onNo={() => closeSentPrompt('no')}
        onDismiss={() => closeSentPrompt('later')}
      />
      {replacement && <CvReplacementDialog choices={replacement.choices} onClose={() => setReplacement(null)} onReplace={cvId => { const retry = replacement.retry; setReplacement(null); retry(cvId); }} />}

      {isAiOpen && (
        <ModalScrim>
          <div role="dialog" aria-modal="true" aria-labelledby="ai-optimize-title" className="w-full max-w-2xl bg-surface border border-subtle rounded-2xl max-h-[90vh] p-6 md:p-8 flex flex-col justify-between shadow-dialog relative overflow-hidden">

            {/* Adornos visuales de fondo */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
              <div>
                <h3 id="ai-optimize-title" className="text-lg font-bold text-text flex items-center gap-2 font-display">
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

                <UsagePanel compact />
                {!isPremium && <UpgradePaywall source="editor-adapt-dialog" compact />}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                        {t('editor.aiModal.jobTitle')}
                      </label>
                      <input
                        type="text"
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

                  <p className="text-sm text-text-muted">{t('variants.generationHelp')}</p>

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
        </ModalScrim>
      )}

      {(surface === 'source' || surface === 'diff') && (
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
              {t(isGuest ? 'editor.footer.savedGuest' : 'editor.footer.saved')}
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
      )}
      </div>
    </div>
  );
}
