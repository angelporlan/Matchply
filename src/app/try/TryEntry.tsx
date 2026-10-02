'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [cvText, setCvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] || null;
    if (next && next.type !== 'application/pdf') {
      setError(t('try.entry.errors.pdfType'));
      setFile(null);
      return;
    }
    setError(null);
    setFile(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const description = jobDescription.trim();
    if (!description) {
      setError(t('try.entry.errors.job'));
      return;
    }
    if (!file && !cvText.trim()) {
      setError(t('try.entry.errors.cv'));
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
        // The free plan keeps one CV. This row was just created for this adaptation.
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
    <div className="relative min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface border border-subtle rounded-xl shadow-dialog p-6 sm:p-8">
        <Link href="/" className="inline-block mb-6">
          <Logo />
        </Link>
        <h1 className="font-display text-2xl font-bold text-text">{t('try.entry.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">{t('try.entry.subtitle')}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="try-cv" className="block text-sm font-medium text-text mb-1.5">
              {t('try.entry.cvLabel')}
            </label>
            <textarea
              id="try-cv"
              value={cvText}
              onChange={(event) => setCvText(event.target.value)}
              rows={8}
              placeholder={t('try.entry.cvPlaceholder')}
              className="w-full bg-canvas border border-control rounded-lg px-3.5 py-3 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai focus:ring-1 focus:ring-ai"
            />
            <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-text-muted">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFile}
                className="text-xs text-text-muted file:mr-2 file:rounded-[8px] file:border file:border-subtle file:bg-canvas file:px-2 file:py-1 file:text-xs file:font-semibold file:text-text"
              />
              {file ? file.name : t('try.entry.cvFile')}
            </label>
          </div>

          <div>
            <label htmlFor="try-job" className="block text-sm font-medium text-text mb-1.5">
              {t('try.entry.jobLabel')}
            </label>
            <textarea
              id="try-job"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              required
              rows={6}
              placeholder={t('try.entry.jobPlaceholder')}
              className="w-full bg-canvas border border-control rounded-lg px-3.5 py-3 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai focus:ring-1 focus:ring-ai"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">{error}</p>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={loading} loading={loading}>
            {loading ? t('try.entry.working') : t('try.entry.submit')}
          </Button>
        </form>

        <p className="text-center text-xs text-text-muted mt-6">
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Link href="/login" className="text-ai font-semibold hover:underline">
            {t('auth.register.logInHere')}
          </Link>
        </p>
      </div>
    </div>
  );
}
