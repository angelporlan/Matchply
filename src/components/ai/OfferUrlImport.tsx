'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { resolveOfferIdentity } from '@/lib/offer-fields';
import { normalizeOfferUrl, offerPlatform, usableOfferDescription, type ImportedOffer, type OfferImportStage } from '@/lib/offer-import/types';

const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const done = () => { signal.removeEventListener('abort', abort); resolve(); };
  const timer = setTimeout(done, 1_500);
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
});

export default function OfferUrlImport({ value, onChange, disabled = false }: {
  value: ImportedOffer | null;
  onChange: (offer: ImportedOffer | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [url, setUrl] = useState(value?.url || '');
  const [stage, setStage] = useState<OfferImportStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualAvailable, setManualAvailable] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const active = useRef<AbortController | null>(null);
  const request = useRef<{ url: string; id: string } | null>(null);
  const observing = stage !== null;

  useEffect(() => () => { active.current?.abort(); }, []);

  const changeUrl = (next: string) => {
    active.current?.abort();
    active.current = null;
    request.current = null;
    setUrl(next); setStage(null); setError(null); setManualAvailable(false); setManual(false); setManualText('');
    onChange(null);
  };

  const start = async () => {
    if (disabled || observing) return;
    let normalized: string;
    try { normalized = normalizeOfferUrl(url); } catch { setError(t('offerImport.invalid')); return; }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const signal = controller.signal;
    if (!request.current || request.current.url !== normalized) request.current = { url: normalized, id: crypto.randomUUID() };
    setStage('reading'); setError(null); setManual(false); setManualAvailable(false); onChange(null);
    try {
      const response = await fetch('/api/ai/offers/import', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized, requestId: request.current.id }),
      });
      const created = await response.json();
      if (!response.ok) {
        if (response.status === 400) throw new Error('invalid');
        if (response.status === 429) throw new Error('rateLimited');
        throw new Error('failed');
      }
      const started = Date.now();
      while (!signal.aborted && Date.now() - started < 8 * 60_000) {
        const status = await fetch(`/api/ai/jobs/${created.jobId}`, { signal, cache: 'no-store' });
        if (!status.ok) throw new Error('failed');
        const job = await status.json();
        signal.throwIfAborted();
        if (job.status === 'failed') { request.current = null; throw new Error('failed'); }
        if (job.status === 'completed') {
          const offer = job.result as ImportedOffer;
          if (!usableOfferDescription(offer?.jobDescription)) throw new Error('failed');
          onChange(offer); setStage(null); return;
        }
        const nextStage = job.result?.stage;
        if (['reading', 'searching', 'structuring'].includes(nextStage)) setStage(nextStage);
        await wait(signal);
      }
      if (!signal.aborted) throw new Error('failed');
    } catch (failure) {
      if (signal.aborted) return;
      const code = failure instanceof Error && ['invalid', 'rateLimited'].includes(failure.message) ? failure.message : 'failed';
      setError(t(`offerImport.${code}`)); setManualAvailable(code !== 'invalid'); setStage(null);
    }
  };

  const changeManual = (description: string) => {
    setManualText(description);
    if (!usableOfferDescription(description)) { onChange(null); return; }
    setError(null);
    const identity = resolveOfferIdentity({ jobDescription: description });
    onChange({ ...identity, jobDescription: description.trim(), url: normalizeOfferUrl(url),
      platform: offerPlatform(url), sourceMethod: 'manual', sources: [] });
  };

  return <section className="space-y-4" aria-busy={observing}>
    <div className="space-y-2">
      <label htmlFor={`${id}-url`} className="flex items-center gap-2 text-sm font-semibold text-text">
        <LinkIcon className="h-4 w-4" aria-hidden="true" />{t('offerImport.label')}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input id={`${id}-url`} type="url" inputMode="url" value={url} onChange={event => changeUrl(event.target.value)}
          disabled={disabled} placeholder="https://…" autoComplete="off" aria-describedby={`${id}-help`}
          className="min-w-0 flex-1 rounded-lg border border-control bg-canvas px-3.5 py-2.5 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2" />
        <Button type="button" variant="secondary" onClick={() => void start()} disabled={disabled || observing || !url.trim()} loading={observing}>
          {t('offerImport.import')}
        </Button>
      </div>
      <p id={`${id}-help`} className="text-sm text-text-muted">{t('offerImport.help')}</p>
    </div>
    {stage && <p role="status" className="text-sm text-info-text">{t(`offerImport.${stage}`)}</p>}
    {error && <div role="alert" className="rounded-xl border border-danger-text bg-danger-surface p-3 text-sm text-danger-text">
      <span className="flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</span>
    </div>}
    {manualAvailable && !manual && <Button type="button" variant="ghost" onClick={() => setManual(true)} disabled={disabled}>
      {t('offerImport.manual')}
    </Button>}
    {manual && <div className="space-y-2">
      <label htmlFor={`${id}-manual`} className="text-sm font-semibold text-text">{t('offerImport.description')}</label>
      <textarea id={`${id}-manual`} rows={6} maxLength={120_000} value={manualText} disabled={disabled}
        onChange={event => changeManual(event.target.value)} placeholder={t('offerImport.manualHelp')}
        className="w-full rounded-lg border border-control bg-canvas p-3 text-base text-text focus:outline-none focus:ring-2 focus:ring-focus" />
      <p className="text-sm text-text-muted">{t('offerImport.manualHelp')}</p>
    </div>}
    {value && <div className="space-y-3 rounded-xl border border-subtle bg-surface-muted p-4">
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success-text">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t('offerImport.ready')}
      </p>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-text-muted">{t('offerImport.title')}</dt><dd className="font-semibold text-text">{value.jobTitle === 'Puesto no identificado' ? t('offerImport.unknownTitle') : value.jobTitle}</dd></div>
        <div><dt className="text-text-muted">{t('offerImport.company')}</dt><dd className="font-semibold text-text">{value.company === 'Empresa no identificada' ? t('offerImport.unknownCompany') : value.company}</dd></div>
        <div><dt className="text-text-muted">{t('offerImport.platform')}</dt><dd className="text-text">{{ linkedin: 'LinkedIn', infojobs: 'InfoJobs', indeed: 'Indeed', other: t('offerImport.other') }[value.platform]}</dd></div>
      </dl>
      {!manual && <details className="text-sm text-text"><summary className="min-h-11 cursor-pointer py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{t('offerImport.description')}</summary>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed">{value.jobDescription}</p>
      </details>}
      {value.sources.map(source => <a key={source} href={source} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm text-ai-text underline break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        {t('offerImport.source')}
      </a>)}
    </div>}
  </section>;
}
