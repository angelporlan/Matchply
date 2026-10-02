"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CV } from '@/db/schema';
import MarkdownEditor from './MarkdownEditor';
import { PdfDownloadLink, type PdfZoom } from './PdfViewer';
import ResumeSheet from './ResumeSheet';
import EditorFormatBar from './EditorFormatBar';
import EditorReviewRail, { type AdaptDraft, type LinkedOffer } from './EditorReviewRail';
import EditorCvMenu, { type EditorCvChoice } from './EditorCvMenu';
import { updateCvStyling, createCvPlaceholder, saveCvContent } from '@/app/dashboard/actions';
import { resolveOfferIdentity } from '@/lib/offer-fields';
import { OverwriteGuardDialog } from '@/components/cv/OverwriteGuardDialog';
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
}

export default function EditorClient({ cv, isPremium, availablePrompts, baseCvContent, user, isGuest = false, guestCanDownloadPdf = false, cvChoices = [], linkedOffer = null }: EditorClientProps) {
  const router = useRouter();
  const { t, language } = useLanguage();

  // Shared Save Status State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [guestCanDownload, setGuestCanDownload] = useState(guestCanDownloadPdf);

  // Dynamic Prompt Configs Mapper
  const getPromptConfig = (prompt: typeof availablePrompts[0]) => {
    const isEn = language === 'en';
    return {
      color: prompt.color || '#8b5cf6',
      desc: (isEn && prompt.descriptionEn) ? prompt.descriptionEn : (prompt.description || ''),
      displayName: (isEn && prompt.nameEn) ? prompt.nameEn : prompt.name,
    };
  };

  const [fullscreenPanel, setFullscreenPanel] = useState<'none' | 'editor'>('none');

  // Estados de Estilo
  const templateName = cv.templateName || 'harvard';
  const [accentColor, setAccentColor] = useState(cv.accentColor || '#1a5f7a');
  const [fontFamily, setFontFamily] = useState(cv.fontFamily || 'helvetica');
  const [pageMargin, setPageMargin] = useState(cv.pageMargin || 36);
  const [scale, setScale] = useState(cv.scale || 1.0);
  const [cvTitle, setCvTitle] = useState(cv.title);
  const [surface, setSurface] = useState<'document' | 'source' | 'diff'>('document');
  const [diffLayout, setDiffLayout] = useState<'unified' | 'split'>('split');
  const [contentVersion, setContentVersion] = useState(0);
  const [overwriteGuard, setOverwriteGuard] = useState<{ replacesBase: boolean } | null>(null);
  const [sessionBase, setSessionBase] = useState<string | null>(null);
  const [sentPromptOpen, setSentPromptOpen] = useState(false);
  const diffBase = baseCvContent || sessionBase;
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStep, setStreamingStep] = useState('');
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const { inspectOrExecutePrompt } = useAiPromptDebug();
  
  useEffect(() => {
    setCvContent(cv.content);
    setReviewContent(cv.content);
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
      setDiffLayout(window.innerWidth >= 1024 ? 'split' : 'unified');
      noteDiffViewed();
      setSurface('diff');
      setMobilePane('document');
      if (!shouldOptimize && !shouldImport) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    if (shouldOptimize) {
      window.history.replaceState(null, '', window.location.pathname);
      const paramsStr = sessionStorage.getItem('matchply_optimize_params');
      if (paramsStr) {
        sessionStorage.removeItem('matchply_optimize_params');
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
        setReviewContent(accumulatedText);
        if (accumulatedText.length > 50) {
          setStreamingStep(t('editor.aiModal.steps.generate'));
        }
      }

      setStreamingStep(t('editor.aiModal.steps.success'));
      setSaveStatus('saved');
      trackUmamiConversion('cv_optimized');
      const canDiff = Boolean(baseCvContent)
        || (typeof params.activationBase === 'string' && params.activationBase.trim().length > 0);
      if (canDiff) {
        setDiffLayout(window.innerWidth >= 1024 ? 'split' : 'unified');
        noteDiffViewed();
        setSurface('diff');
        setMobilePane('document');
      }
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
        setReviewContent(accumulatedText);
        setStreamingStep(language === 'es' ? 'Transcribiendo contenido a Markdown Harvard...' : 'Transcribing content to Harvard Markdown...');
      }

      setStreamingStep(language === 'es' ? 'Currículum importado con éxito!' : 'Resume imported successfully!');
      setSaveStatus('saved');
      trackUmamiConversion('cv_imported');
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
    setCvContent(diffBase);
    setReviewContent(diffBase);
    setContentVersion((version) => version + 1);
    setSaveStatus('saving');
    const result = await saveCvContent(cv.id, diffBase);
    setSaveStatus(result.success ? 'saved' : 'error');
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

  // Optimización IA (Crea el placeholder y redirige al editor para streaming en tiempo real)
  const handleAiOptimize = async (e?: React.FormEvent, confirmed = false) => {
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

    setAiLoading(true);
    setAiStep(t('editor.aiModal.steps.keywords'));

    try {
      // 1. Crear el currículum placeholder para la optimización
      const placeholderRes = await createCvPlaceholder({
        title: `Optimizado - ${identity.jobTitle} (${identity.company})`,
        isBase: false,
        isPrincipal: false,
        confirmOverwrite: confirmed,
      });

      if ('needsConfirm' in placeholderRes && placeholderRes.needsConfirm) {
        setOverwriteGuard({ replacesBase: Boolean(placeholderRes.replacesBase) });
        setAiLoading(false);
        return;
      }

      if (!placeholderRes.success || !placeholderRes.cvId) {
        throw new Error(placeholderRes.error || 'Error al inicializar el currículum.');
      }

      // 2. Guardar los parámetros de optimización en sessionStorage
      trackUmamiConversion('offer_pasted');
      sessionStorage.setItem('matchply_optimize_params', JSON.stringify({
        baseCvId: cv.id,
        jobTitle: identity.jobTitle,
        company: identity.company,
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
                <EditorCvMenu
                  cvId={cv.id}
                  title={cvTitle}
                  choices={cvChoices.length > 0 ? cvChoices : [{ id: cv.id, title: cvTitle, isBase: cv.isBase, isPrincipal: cv.isPrincipal }]}
                  onTitleChange={setCvTitle}
                  onOpenChange={setMenuOpen}
                />
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase ? 'bg-surface-muted text-text-muted border-subtle' : 'bg-warning-surface text-warning-text border-warning-text/20'}`}>
                  {cv.isBase ? t('editor.header.titleBase') : t('editor.header.titleOptimized')}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">{t('editor.header.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {surface === 'diff' && (
              <PdfDownloadLink
                cvId={cv.id}
                isGuest={isGuest}
                guestCanDownload={guestCanDownload}
                onGuestDownloadConsumed={() => setGuestCanDownload(false)}
                onDownloaded={notePdfDownloaded}
                className="btn-raised"
              />
            )}
            {surface === 'diff' ? (
              <Button type="button" variant="secondary" onClick={() => { setSurface('document'); setMobilePane('document'); }}>
                {t('editor.header.edit')}
              </Button>
            ) : surface !== 'document' ? (
              <Button type="button" variant="secondary" onClick={() => { setSurface('document'); setMobilePane('document'); }}>
                {t('editor.header.document')}
              </Button>
            ) : null}
            {surface === 'diff' && diffBase ? (
              <Button type="button" variant="ghost" onClick={() => { void revertToBase(); }}>
                {t('editor.header.revert')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant={surface === 'source' ? 'secondary' : 'ghost'}
              aria-pressed={surface === 'source'}
              onClick={() => {
                setSurface((current) => (current === 'source' ? 'document' : 'source'));
                setMobilePane('document');
              }}
            >
              {t('editor.header.markdown')}
            </Button>
            {diffBase ? (
              <Button
                type="button"
                variant={surface === 'diff' ? 'secondary' : 'ghost'}
                aria-pressed={surface === 'diff'}
                onClick={() => {
                  setDiffLayout(window.innerWidth >= 1024 ? 'split' : 'unified');
                  if (surface !== 'diff') noteDiffViewed();
                  setSurface((current) => (current === 'diff' ? 'document' : 'diff'));
                  setMobilePane('document');
                }}
              >
                {t('editor.header.changes')}
              </Button>
            ) : null}
            {surface !== 'diff' && (
              <PdfDownloadLink
                cvId={cv.id}
                isGuest={isGuest}
                guestCanDownload={guestCanDownload}
                onGuestDownloadConsumed={() => setGuestCanDownload(false)}
                onDownloaded={notePdfDownloaded}
                className="btn-raised"
              />
            )}
            <Button type="button" variant="ai" onClick={() => {
              setMobilePane('review');
              setFocusAdapt(true);
            }}>
              <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden />
              {t('editor.header.adapt')}
            </Button>
          </div>
        </div>
      </header>

      <EditorFormatBar
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
        saveLabel={
          saveStatus === 'saving'
            ? t('editor.footer.saving')
            : saveStatus === 'error'
              ? t('editor.footer.error')
              : (isGuest ? t('editor.footer.savedGuest') : t('editor.footer.saved'))
        }
      />

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

      {!isLg && (
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
        {(showDocument || showSource) && (
          <div className={`h-full min-h-0 min-w-0 flex flex-col flex-1 ${showSource ? 'p-4 sm:p-6' : ''}`}>
            {showDocument && (
              <ResumeSheet
                cvId={cv.id}
                content={reviewContent}
                fontFamily={fontFamily}
                pageMargin={pageMargin}
                scale={scale}
                accentColor={accentColor}
                zoom={zoom}
                pageBreaks={pageBreaks}
                onContentChange={setReviewContent}
                setSaveStatus={setSaveStatus}
              />
            )}
            {showSource && (
              <MarkdownEditor
                key={`${surface}-${contentVersion}`}
                cvId={cv.id}
                initialContent={reviewContent}
                originalContent={diffBase || undefined}
                forcedMode={surface === 'diff' ? 'diff' : 'markdown'}
                initialDiffView={diffLayout}
                onContentChange={setReviewContent}
                saveStatus={saveStatus}
                setSaveStatus={setSaveStatus}
                isFullScreen={fullscreenPanel === 'editor'}
                onToggleFullScreen={() => setFullscreenPanel((prev) => (prev === 'editor' ? 'none' : 'editor'))}
                isAiStreaming={isStreaming}
                streamingStep={streamingStep}
              />
            )}
          </div>
        )}

        {showReview && (
          <div className={`h-full min-h-0 overflow-hidden ${isLg ? 'w-[320px] xl:w-[360px] shrink-0' : 'flex-1'}`}>
            <EditorReviewRail
              cvId={cv.id}
              content={reviewContent}
              onContentChange={setReviewContent}
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
            />
          </div>
        )}
      </div>

      {/* Cajón Lateral / Modal de Optimización por IA */}
      <ApplicationSentPrompt
        open={sentPromptOpen}
        onYes={() => closeSentPrompt('yes')}
        onNo={() => closeSentPrompt('no')}
        onDismiss={() => closeSentPrompt('later')}
      />
      <OverwriteGuardDialog
        open={Boolean(overwriteGuard)}
        replacesBase={Boolean(overwriteGuard?.replacesBase)}
        intent="adapt"
        onReplace={() => {
          setOverwriteGuard(null);
          void handleAiOptimize(undefined, true);
        }}
        onClose={() => setOverwriteGuard(null)}
      />
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
