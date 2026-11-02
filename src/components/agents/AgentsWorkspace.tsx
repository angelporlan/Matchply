'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Search, Sparkles, FileText } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { AI_PUBLIC_ERROR } from '@/lib/ai-provider-errors';
import { reportPlanRestriction } from '@/lib/plan-presentation';
import { initialDiscoveryProgress, type DiscoveryProgress } from '@/lib/offer-discovery/types';
import type { AiProvider } from '@/lib/models';
import type { PublicLlmCredential } from '@/lib/user-llm-credential';
import { deleteLlmCredentialAction, saveLlmCredentialAction, startAgentCvAction } from '@/app/dashboard/agents/actions';

export type AgentOfferOption = { id: string; title: string; company: string };
export type AgentJobSnapshot = {
  id: string;
  status: string;
  lastError: string | null;
  result?: unknown;
  jobOfferId?: string;
  createdAt?: string;
  completedAt?: string | null;
};

export type AgentsWorkspaceProps = {
  credential: PublicLlmCredential;
  isGuest: boolean;
  impersonation: boolean;
  canResearch: boolean;
  baseCv: { id: string; title: string } | null;
  offers: AgentOfferOption[];
  scout: AgentJobSnapshot | null;
  research: AgentJobSnapshot | null;
  cvJob: AgentJobSnapshot | null;
  jobProviders: { scout: AiProvider; research: AiProvider; cv: AiProvider };
};

const PROVIDERS: AiProvider[] = ['openai', 'openrouter', 'deepseek', 'gemini'];
const POLL_MS = 2500;

function isBusy(status?: string | null) {
  return status === 'queued' || status === 'running';
}

function badgeTone(status?: string | null): 'idle' | 'running' | 'done' | 'error' {
  if (!status) return 'idle';
  if (status === 'queued' || status === 'running') return 'running';
  if (status === 'completed' || status === 'partial') return 'done';
  if (status === 'failed') return 'error';
  return 'idle';
}

function badgeClass(tone: ReturnType<typeof badgeTone>) {
  if (tone === 'running') return 'bg-info-surface text-info-text';
  if (tone === 'done') return 'bg-success-surface text-success-text';
  if (tone === 'error') return 'bg-danger-surface text-danger-text';
  return 'bg-surface text-text-muted border border-subtle';
}

function cvIdFromResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const cvId = (result as { cvId?: unknown }).cvId;
  return typeof cvId === 'string' ? cvId : null;
}

function discoveryResult(result: unknown): DiscoveryProgress {
  if (!result || typeof result !== 'object') return initialDiscoveryProgress();
  const value = result as Partial<DiscoveryProgress>;
  return {
    ...initialDiscoveryProgress(),
    ...value,
    added: Array.isArray(value.added) ? value.added : [],
  };
}

export default function AgentsWorkspace(props: AgentsWorkspaceProps) {
  const { t } = useLanguage();
  const [credential, setCredential] = useState(props.credential);
  const [provider, setProvider] = useState<AiProvider>(props.credential.provider ?? 'openai');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [credentialOk, setCredentialOk] = useState(false);

  const [scout, setScout] = useState(props.scout);
  const [research, setResearch] = useState(props.research);
  const [cvJob, setCvJob] = useState(props.cvJob);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [researchOfferId, setResearchOfferId] = useState(props.research?.jobOfferId || props.offers[0]?.id || '');
  const [cvOfferId, setCvOfferId] = useState(props.offers[0]?.id || '');
  const [startingScout, setStartingScout] = useState(false);
  const [startingResearch, setStartingResearch] = useState(false);
  const [startingCv, setStartingCv] = useState(false);
  const scoutRequestId = useRef<string | null>(null);

  const readOnly = props.impersonation;
  const keyLocked = props.isGuest || readOnly;
  const mismatch = Boolean(credential.connected && credential.provider && (
    credential.provider !== props.jobProviders.scout
    || credential.provider !== props.jobProviders.research
    || credential.provider !== props.jobProviders.cv
  ));

  const credentialErrorText = (code: string) => {
    const key = `agents.provider.errors.${code}`;
    const message = t(key);
    return message === key ? t('agents.provider.errors.generic') : message;
  };

  const saveKey = async () => {
    if (keyLocked || saving) return;
    setSaving(true);
    setCredentialError(null);
    setCredentialOk(false);
    const result = await saveLlmCredentialAction({ provider, apiKey });
    setSaving(false);
    if ('error' in result && result.error) {
      setCredentialError(credentialErrorText(result.error));
      return;
    }
    if ('credential' in result) {
      setCredential(result.credential);
      setApiKey('');
      setCredentialOk(true);
    }
  };

  const removeKey = async () => {
    if (keyLocked || deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setCredentialError(null);
    const result = await deleteLlmCredentialAction();
    setDeleting(false);
    setConfirmDelete(false);
    if ('error' in result && result.error) {
      setCredentialError(credentialErrorText(result.error));
      return;
    }
    if ('credential' in result) {
      setCredential(result.credential);
      setCredentialOk(false);
    }
  };

  const startScout = async () => {
    if (readOnly || startingScout || isBusy(scout?.status)) return;
    setStartingScout(true);
    setScoutError(null);
    scoutRequestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch('/api/ai/offers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: scoutRequestId.current }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) {
        scoutRequestId.current = null;
        reportPlanRestriction(data, 'discover_offers');
        throw new Error(data.code || 'DISCOVERY_UNAVAILABLE');
      }
      setScout({ id: data.jobId, status: 'queued', lastError: null, result: initialDiscoveryProgress() });
      scoutRequestId.current = null;
    } catch (error) {
      setScoutError(error instanceof Error ? error.message : 'DISCOVERY_UNAVAILABLE');
    } finally {
      setStartingScout(false);
    }
  };

  const startResearch = async () => {
    if (readOnly || !props.canResearch || startingResearch || isBusy(research?.status) || !researchOfferId) return;
    setStartingResearch(true);
    setResearchError(null);
    try {
      const retry = research?.jobOfferId === researchOfferId && research.status === 'failed';
      const response = await fetch(`/api/research/${researchOfferId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retry ? { retry: true } : {}),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) {
        reportPlanRestriction(data, 'research');
        throw new Error(data.code || 'AI_UNAVAILABLE');
      }
      setResearch({
        id: data.runId || data.research?.run?.id || researchOfferId,
        status: data.status || data.research?.status || 'queued',
        lastError: null,
        jobOfferId: researchOfferId,
      });
    } catch (error) {
      setResearchError(error instanceof Error ? error.message : 'AI_UNAVAILABLE');
    } finally {
      setStartingResearch(false);
    }
  };

  const startCv = async () => {
    if (readOnly || startingCv || isBusy(cvJob?.status) || !cvOfferId || !props.baseCv) return;
    setStartingCv(true);
    setCvError(null);
    const result = await startAgentCvAction(cvOfferId);
    setStartingCv(false);
    if ('error' in result && result.error) {
      setCvError(result.error);
      return;
    }
    if ('jobId' in result) {
      setCvJob({
        id: result.jobId,
        status: 'queued',
        lastError: null,
        result: { cvId: result.cvId, optimizationId: result.optimizationId },
      });
    }
  };

  useEffect(() => {
    if (!scout?.id || !isBusy(scout.status)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/ai/jobs/${scout.id}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!response.ok) throw new Error('poll');
        const current = await response.json();
        if (controller.signal.aborted) return;
        setScout({ id: current.id, status: current.status, lastError: current.lastError, result: current.result });
        if (current.status === 'queued' || current.status === 'running') timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!controller.signal.aborted) timer = setTimeout(poll, POLL_MS);
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [scout?.id, scout?.status]);

  useEffect(() => {
    const offerId = research?.jobOfferId;
    if (!offerId || !isBusy(research?.status)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/research/${offerId}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!response.ok) throw new Error('poll');
        const data = await response.json();
        if (controller.signal.aborted) return;
        const run = data.research;
        if (run) setResearch({
          id: run.id,
          status: run.status,
          lastError: run.lastError,
          jobOfferId: offerId,
        });
        if (run && (run.status === 'queued' || run.status === 'running')) timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!controller.signal.aborted) timer = setTimeout(poll, POLL_MS);
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [research?.jobOfferId, research?.status]);

  useEffect(() => {
    if (!cvJob?.id || !isBusy(cvJob.status)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/ai/jobs/${cvJob.id}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!response.ok) throw new Error('poll');
        const current = await response.json();
        if (controller.signal.aborted) return;
        setCvJob({ id: current.id, status: current.status, lastError: current.lastError, result: current.result });
        if (current.status === 'queued' || current.status === 'running') timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!controller.signal.aborted) timer = setTimeout(poll, POLL_MS);
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [cvJob?.id, cvJob?.status]);

  const scoutProgress = discoveryResult(scout?.result);
  const cvId = cvIdFromResult(cvJob?.result);
  const keyPlaceholder = provider === 'openrouter' ? 'sk-or-…' : 'sk-…';
  const offerOptions = useMemo(() => props.offers, [props.offers]);

  const StatusBadge = ({ status }: { status?: string | null }) => {
    const tone = badgeTone(status);
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(tone)}`}>
        {t(`agents.status.${tone}`)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-subtle rounded-[8px] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-text">{t('agents.provider.title')}</h2>
            <p className="text-sm text-text-muted mt-1">{t('agents.provider.description')}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${credential.connected ? 'bg-success-surface text-success-text' : 'bg-surface text-text-muted border border-subtle'}`}>
            {credential.connected
              ? t('agents.provider.connected', { lastChars: credential.lastChars || '' })
              : t('agents.provider.disconnected')}
          </span>
        </div>
        {mismatch && <p className="text-sm text-warning-text">{t('agents.provider.mismatch')}</p>}
        {props.isGuest && (
          <p className="text-sm text-text-muted">
            {t('agents.provider.guest')}{' '}
            <Link href="/register" className="text-ai underline underline-offset-2">{t('agents.provider.guestCta')}</Link>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-text">
            {t('agents.provider.providerLabel')}
            <select
              className="mt-1 w-full min-h-11 rounded-[8px] border border-subtle bg-canvas px-3 text-sm"
              value={provider}
              disabled={keyLocked}
              onChange={event => setProvider(event.target.value as AiProvider)}
            >
              {PROVIDERS.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-text">
            {t('agents.provider.keyLabel')}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              disabled={keyLocked}
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder={t('agents.provider.keyPlaceholder', { example: keyPlaceholder })}
              className="mt-1 w-full min-h-11 rounded-[8px] border border-subtle bg-canvas px-3 text-sm"
            />
          </label>
        </div>
        {!readOnly && !props.isGuest && (
          <div className="flex flex-wrap gap-3">
            <Button variant="strong" onClick={() => void saveKey()} loading={saving} disabled={!apiKey.trim()}>
              {credential.connected ? t('agents.provider.replace') : t('agents.provider.save')}
            </Button>
            {credential.connected && (
              <Button variant="danger" onClick={() => void removeKey()} loading={deleting}>
                {confirmDelete ? t('agents.provider.deleteConfirm') : t('agents.provider.delete')}
              </Button>
            )}
          </div>
        )}
        {credentialOk && <p className="text-sm text-success-text">{t('agents.provider.saved')}</p>}
        {credentialError && <p role="alert" className="text-sm text-danger-text">{credentialError}</p>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="bg-surface border border-subtle rounded-[8px] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-text flex items-center gap-2">
                <Search className="w-4 h-4 text-ai-text stroke-[1.75]" aria-hidden="true" />
                {t('agents.scout.title')}
              </h2>
              <p className="text-sm text-text-muted mt-1">{t('agents.scout.help')}</p>
            </div>
            <StatusBadge status={scout?.status} />
          </div>
          {scout?.status === 'completed' && (
            <p className="text-sm text-success-text">
              {t(scoutProgress.added.length === 1 ? 'agents.scout.completedOne' : 'agents.scout.completed', { count: scoutProgress.added.length })}
            </p>
          )}
          {(scoutError || scout?.status === 'failed') && (
            <p role="alert" className="text-sm text-danger-text">
              {scoutError === 'DISCOVERY_PROFILE_REQUIRED' ? t('agents.scout.needProfile') : (scoutError ? t(`offerDiscovery.errors.${scoutError}`) : AI_PUBLIC_ERROR)}
            </p>
          )}
          {scoutError === 'DISCOVERY_PROFILE_REQUIRED' && (
            <ButtonLink variant="ghost" href="/dashboard/profile">{t('agents.scout.needProfile')}</ButtonLink>
          )}
          {!readOnly && (
            <Button variant="ai" onClick={() => void startScout()} loading={startingScout} disabled={isBusy(scout?.status) || startingScout}>
              <Sparkles className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              {t('agents.scout.run')}
            </Button>
          )}
          <ButtonLink variant="ghost" href="/dashboard/applications">{t('agents.scout.openResults')}</ButtonLink>
        </section>

        <section className="bg-surface border border-subtle rounded-[8px] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-text flex items-center gap-2">
                <Bot className="w-4 h-4 text-ai-text stroke-[1.75]" aria-hidden="true" />
                {t('agents.research.title')}
              </h2>
              <p className="text-sm text-text-muted mt-1">{t('agents.research.help')}</p>
            </div>
            <StatusBadge status={research?.status} />
          </div>
          {offerOptions.length ? (
            <label className="block text-sm font-medium text-text">
              {t('agents.research.selectOffer')}
              <select
                className="mt-1 w-full min-h-11 rounded-[8px] border border-subtle bg-canvas px-3 text-sm"
                value={researchOfferId}
                onChange={event => setResearchOfferId(event.target.value)}
                disabled={readOnly || !props.canResearch}
              >
                {offerOptions.map(offer => (
                  <option key={offer.id} value={offer.id}>{offer.title} · {offer.company}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-text-muted">{t('agents.research.emptyOffers')}</p>
          )}
          {(researchError || research?.status === 'failed') && (
            <p role="alert" className="text-sm text-danger-text">{researchError || AI_PUBLIC_ERROR}</p>
          )}
          {props.isGuest || !props.canResearch ? (
            <p className="text-sm text-text-muted">
              {t('agents.research.guest')}{' '}
              <Link href="/register" className="text-ai underline underline-offset-2">{t('agents.provider.guestCta')}</Link>
            </p>
          ) : !readOnly && (
            <Button variant="ai" onClick={() => void startResearch()} loading={startingResearch} disabled={!researchOfferId || isBusy(research?.status) || startingResearch}>
              <Sparkles className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              {t('agents.research.run')}
            </Button>
          )}
          {research?.jobOfferId && (
            <ButtonLink variant="ghost" href={`/dashboard/applications/offer/${research.jobOfferId}`}>{t('agents.research.openResults')}</ButtonLink>
          )}
        </section>

        <section className="bg-surface border border-subtle rounded-[8px] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-text flex items-center gap-2">
                <FileText className="w-4 h-4 text-ai-text stroke-[1.75]" aria-hidden="true" />
                {t('agents.cv.title')}
              </h2>
              <p className="text-sm text-text-muted mt-1">{t('agents.cv.help')}</p>
            </div>
            <StatusBadge status={cvJob?.status} />
          </div>
          {!props.baseCv && (
            <p className="text-sm text-text-muted">
              {t('agents.cv.needCv')}{' '}
              <Link href="/dashboard" className="text-ai underline underline-offset-2">{t('agents.cv.openCv')}</Link>
            </p>
          )}
          {offerOptions.length ? (
            <label className="block text-sm font-medium text-text">
              {t('agents.cv.selectOffer')}
              <select
                className="mt-1 w-full min-h-11 rounded-[8px] border border-subtle bg-canvas px-3 text-sm"
                value={cvOfferId}
                onChange={event => setCvOfferId(event.target.value)}
                disabled={readOnly || !props.baseCv}
              >
                {offerOptions.map(offer => (
                  <option key={offer.id} value={offer.id}>{offer.title} · {offer.company}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-text-muted">{t('agents.cv.emptyOffers')}</p>
          )}
          {(cvError || cvJob?.status === 'failed') && (
            <p role="alert" className="text-sm text-danger-text">
              {cvError === 'offer_description_required' ? t('agents.cv.needDescription') : cvError === 'need_cv' ? t('agents.cv.needCv') : (cvError || AI_PUBLIC_ERROR)}
            </p>
          )}
          {!readOnly && (
            <Button variant="ai" onClick={() => void startCv()} loading={startingCv} disabled={!props.baseCv || !cvOfferId || isBusy(cvJob?.status) || startingCv}>
              <Sparkles className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
              {t('agents.cv.run')}
            </Button>
          )}
          {cvId && <ButtonLink variant="ghost" href={`/editor/${cvId}`}>{t('agents.cv.openResults')}</ButtonLink>}
        </section>
      </div>
    </div>
  );
}
