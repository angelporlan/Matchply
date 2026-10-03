'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Zap, 
  AlertCircle 
} from 'lucide-react';
import { createCvPlaceholder, saveCvContent } from '@/app/dashboard/actions';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { resolveOfferIdentity } from '@/lib/offer-fields';
import { trialCvMarkdown } from '@/lib/try-entry';
import { trackUmamiConversion } from '@/components/analytics/UmamiTracker';

export default function TryEntry() {
  const { t } = useLanguage();
  const router = useRouter();

  // Wizard step state (1: CV, 2: Offer)
  const [step, setStep] = useState<1 | 2>(1);
  const [showRawText, setShowRawText] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields state
  const [cvText, setCvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileSizeKb = file ? Math.round(file.size / 1024) : 0;
  const hasCv = Boolean(file || cvText.trim());

  const handleFile = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type !== 'application/pdf') {
      setError(t('try.entry.errors.pdfType'));
      setFile(null);
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] || null;
    handleFile(next);
  };

  const handleFileDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const next = event.dataTransfer.files?.[0] || null;
    handleFile(next);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const handleNextStep = () => {
    if (!hasCv) {
      setError(t('try.entry.errors.cv'));
      return;
    }
    setError(null);
    setStep(2);
  };

  const handlePrevStep = () => {
    setError(null);
    setStep(1);
  };

  const handleQuickSample = () => {
    setJobDescription(
      'Buscamos Product Engineer con más de 3 años de experiencia en React, TypeScript y Next.js. Responsabilidades: liderar el desarrollo de interfaces de usuario de alto impacto, optimizar métricas Core Web Vitals y colaborar con producto y diseño para entregar una experiencia fluida y accesible.'
    );
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (loading) return;
    setError(null);

    const description = jobDescription.trim();
    if (!description) {
      setError(t('try.entry.errors.job'));
      return;
    }
    if (!file && !cvText.trim()) {
      setError(t('try.entry.errors.cv'));
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      let raw = cvText;
      if (file) {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/cv/parse-pdf', { method: 'POST', body });
        const parsed = await response.json().catch(() => null);
        if (!response.ok || !parsed?.success || !parsed.text?.trim()) {
          throw new Error(parsed?.error || t('try.entry.errors.pdf'));
        }
        raw = parsed.text;
      }

      const markdown = trialCvMarkdown(raw, t('try.entry.untitledSection'));
      if (!markdown) throw new Error(t('try.entry.errors.cv'));

      const identity = resolveOfferIdentity({ jobDescription: description });
      const base = await createCvPlaceholder({
        title: t('try.entry.baseTitle'),
        isBase: true,
        isPrincipal: true,
      });
      if ('needsConfirm' in base && base.needsConfirm) {
        throw new Error(t('try.entry.errors.limit'));
      }
      if (!base.success || !base.cvId) throw new Error(base.error || t('try.entry.errors.generic'));

      const saved = await saveCvContent(base.cvId, markdown);
      if (!saved.success) throw new Error(saved.error || t('try.entry.errors.generic'));

      const adapted = await createCvPlaceholder({
        title: `CV - ${identity.jobTitle}`,
        isBase: false,
        isPrincipal: false,
      });

      let targetCvId = base.cvId;
      let activationBase: string | undefined;
      if ('needsConfirm' in adapted && adapted.needsConfirm) {
        activationBase = markdown;
      } else if (!adapted.success || !adapted.cvId) {
        throw new Error(adapted.error || t('try.entry.errors.generic'));
      } else {
        targetCvId = adapted.cvId;
      }

      trackUmamiConversion('offer_pasted');
      sessionStorage.setItem('matchply_optimize_params', JSON.stringify({
        baseCvId: base.cvId,
        targetCvId,
        jobTitle: identity.jobTitle,
        company: identity.company,
        jobDescription: description,
        addToApplications: true,
        activationBase,
      }));
      router.push(`/editor/${targetCvId}?optimize=true`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('try.entry.errors.generic'));
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-canvas flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-xl mx-auto">
        {/* Cabecera superior y Progreso del Asistente */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <Logo iconSize="md" textSize="md" />
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text">
            {t('try.entry.title')}
          </h1>

          {/* Stepper Progress Indicator */}
          <div className="mt-4 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
                step === 1
                  ? 'bg-ai-action text-white shadow-xs'
                  : 'bg-success-surface text-success-text border border-action/40'
              }`}
            >
              {step === 2 && hasCv ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
              <span>1. Tu Currículum</span>
            </button>

            <div className="w-6 h-0.5 bg-subtle" />

            <button
              type="button"
              onClick={() => hasCv && setStep(2)}
              disabled={!hasCv}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
                step === 2
                  ? 'bg-ai-action text-white shadow-xs'
                  : 'bg-surface-muted text-text-muted cursor-not-allowed'
              }`}
            >
              <span>2. La Oferta</span>
            </button>
          </div>
        </div>

        {/* Paso 1: Selección del CV */}
        {step === 1 && (
          <div className="bg-surface border border-subtle rounded-2xl p-6 sm:p-8 shadow-dialog">
            <div className="mb-5">
              <h2 className="font-display text-lg font-bold text-text">
                Paso 1: Selecciona tu CV actual
              </h2>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Sube tu PDF para extraer automáticamente tus datos o pégalo directamente en texto.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={handleFileDrop}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all group ${
                  isDragging
                    ? 'border-ai-action bg-ai-surface/40 scale-[0.99]'
                    : 'border-ai-accent/40 hover:border-ai-action bg-ai-surface/20'
                }`}
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-surface shadow-xs flex items-center justify-center text-ai-action mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-text">
                  Haz clic o arrastra tu currículum en PDF
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Formato PDF estándar hasta 10 MB
                </p>
              </div>
            ) : (
              <div className="p-4 bg-success-surface border border-action/40 rounded-xl mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-action/20 text-on-action flex items-center justify-center font-bold text-xs shrink-0">
                    PDF
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-text truncate max-w-[200px] sm:max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-success-text flex items-center gap-1 font-medium mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      PDF verificado ({fileSizeKb} KB)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-danger-text hover:underline px-2.5 py-1 rounded"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Botón para continuar con el PDF seleccionado */}
            {file && (
              <Button
                type="button"
                variant="ai"
                onClick={handleNextStep}
                className="w-full mt-4"
              >
                <span>Continuar al Paso 2</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            {/* Alternativa: Pegar texto directo */}
            <div className="mt-5 pt-4 border-t border-subtle">
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="text-xs font-semibold text-text-muted hover:text-text flex items-center gap-1.5 mx-auto transition-colors"
              >
                <span>
                  {showRawText ? 'Ocultar editor de texto' : '¿No tienes PDF? Haz clic para pegar el texto'}
                </span>
              </button>

              {showRawText && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                    rows={5}
                    placeholder="Pega aquí la experiencia, educación y habilidades de tu currículum..."
                    className="w-full bg-canvas border border-border-control/50 rounded-xl p-3 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai-action resize-none"
                  />
                  {cvText.trim() && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleNextStep}
                      className="w-full text-xs"
                    >
                      <span>Continuar con este texto</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-danger-surface border border-danger-text/30 flex items-center gap-2 text-xs text-danger-text">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Paso 2: Descripción de la Oferta */}
        {step === 2 && (
          <form
            onSubmit={handleSubmit}
            className="bg-surface border border-subtle rounded-2xl p-6 sm:p-8 shadow-dialog"
          >
            {/* Chip resumen del CV activo */}
            <div className="mb-5 p-3 bg-success-surface border border-action/40 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-success-text font-bold">✓ CV preparado:</span>
                <span className="text-text font-medium truncate max-w-[200px] sm:max-w-xs">
                  {file ? file.name : `Texto pegado (${cvText.trim().split(/\s+/).length} palabras)`}
                </span>
              </div>
              <button
                type="button"
                onClick={handlePrevStep}
                className="text-[11px] text-text-muted underline hover:text-text shrink-0"
              >
                Cambiar
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-text">
                  Paso 2: ¿A qué oferta aspiras?
                </h2>
                <button
                  type="button"
                  onClick={handleQuickSample}
                  className="text-xs font-semibold text-ai-action hover:text-ai-hover hover:underline flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Pegar ejemplo
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Copia la descripción de LinkedIn, InfoJobs o el portal de la empresa.
              </p>
            </div>

            <div className="mb-5">
              <textarea
                id="wizard-job-desc"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                required
                rows={6}
                placeholder={t('try.entry.jobPlaceholder')}
                className="w-full bg-canvas border border-border-control/50 rounded-xl p-3.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai-action resize-none"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-danger-surface border border-danger-text/30 flex items-center gap-2 text-xs text-danger-text">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handlePrevStep}
                className="px-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Atrás</span>
              </Button>
              <Button
                type="submit"
                variant="ai"
                disabled={loading}
                loading={loading}
                className="flex-1"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loading ? t('try.entry.working') : t('try.entry.submit')}</span>
              </Button>
            </div>
          </form>
        )}

        {/* Enlace inferior de sesión */}
        <p className="text-center text-xs text-text-muted mt-6">
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Link href="/login" className="text-ai-action font-semibold hover:underline">
            {t('auth.register.logInHere')}
          </Link>
        </p>
      </div>
    </div>
  );
}
