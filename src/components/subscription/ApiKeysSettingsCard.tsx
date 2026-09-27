'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clipboard, KeyRound } from 'lucide-react';
import { createApiKeyAction, revokeApiKeyAction } from '@/app/dashboard/profile/api-key-actions';
import AlertModal from '@/components/ui/AlertModal';
import { Button } from '@/components/ui/Button';
import {
  AGENT_SCOPES,
  apiTokenHint,
  type AgentScope,
  type ApiTokenView,
} from '@/lib/agent-api/scopes';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { timeAgo } from '@/lib/time-ago';

const SCOPE_KEYS: Record<AgentScope, string> = {
  'profile:read': 'subscription.integrations.apiKeys.scopeProfileRead',
  'profile:write': 'subscription.integrations.apiKeys.scopeProfileWrite',
  'cv:read': 'subscription.integrations.apiKeys.scopeCvRead',
  'cv:write': 'subscription.integrations.apiKeys.scopeCvWrite',
  'applications:read': 'subscription.integrations.apiKeys.scopeApplicationsRead',
  'applications:write': 'subscription.integrations.apiKeys.scopeApplicationsWrite',
};

function DialogFrame({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-surface border border-subtle rounded-2xl p-6 shadow-dialog"
      >
        <h3 id={titleId} className="text-base font-bold text-text font-display pr-6">{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function isActive(token: ApiTokenView) {
  if (token.revokedAt) return false;
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

export default function ApiKeysSettingsCard({ initialTokens }: { initialTokens: ApiTokenView[] }) {
  const { t, language } = useLanguage();
  const [tokens, setTokens] = useState(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<AgentScope[]>([...AGENT_SCOPES]);
  const [secret, setSecret] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState<'token' | 'curl' | null>(null);

  const fullAccess = scopes.length === AGENT_SCOPES.length;
  const revokeTarget = tokens.find((token) => token.id === revokeId) ?? null;

  function errorText(code: string) {
    const key = `subscription.integrations.apiKeys.errors.${code}`;
    const translated = t(key);
    return translated === key ? t('subscription.integrations.apiKeys.errors.generic') : translated;
  }

  function relative(value: Date | string | null) {
    if (!value) return t('subscription.integrations.apiKeys.never');
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return t('subscription.integrations.apiKeys.never');
    return timeAgo(date, language);
  }

  function absolute(value: Date | string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '';
    return date.toLocaleString(language === 'en' ? 'en-GB' : 'es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    });
  }

  function toggleScope(scope: AgentScope) {
    setScopes((current) => (
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    ));
  }

  async function createKey() {
    setCreating(true);
    setError(null);
    const result = await createApiKeyAction({ name, scopes });
    setCreating(false);
    if ('error' in result) {
      setError(errorText(result.error));
      return;
    }
    setTokens((current) => [result.apiToken, ...current]);
    setSecret(result.token);
    setCreateOpen(false);
    setName('');
    setScopes([...AGENT_SCOPES]);
  }

  async function confirmRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    setError(null);
    const result = await revokeApiKeyAction(revokeId);
    setRevoking(false);
    if ('error' in result) {
      setError(errorText(result.error));
      return;
    }
    setTokens((current) => current.map((token) => (
      token.id === result.id ? { ...token, revokedAt: new Date().toISOString() } : token
    )));
    setRevokeId(null);
  }

  async function copy(value: string, kind: 'token' | 'curl') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1800);
    } catch {
      setError(errorText('generic'));
    }
  }

  const curl = secret
    ? `curl -H "Authorization: Bearer ${secret}" ${typeof window === 'undefined' ? '' : window.location.origin}/api/v1/agent/profile`
    : '';

  return (
    <section className="bg-surface border border-subtle rounded-[12px] p-6 sm:p-8 shadow-sm font-display">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-subtle pb-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-text flex items-center gap-2">
            <KeyRound className="w-5 h-5 stroke-[1.75]" />
            {t('subscription.integrations.apiKeys.title')}
          </h3>
          <p className="text-xs text-text-muted font-sans font-light max-w-xl leading-relaxed">
            {t('subscription.integrations.apiKeys.description')}
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={() => { setError(null); setCreateOpen(true); }}>
          <KeyRound className="w-3.5 h-3.5 stroke-[1.75]" />
          {t('subscription.integrations.apiKeys.create')}
        </Button>
      </div>

      {error && !createOpen && (
        <p role="alert" className="mt-4 text-xs text-danger-text bg-danger-surface border border-danger-text/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {tokens.length === 0 ? (
          <li className="p-4 rounded-lg border border-dashed border-control text-xs text-text-muted font-sans">
            {t('subscription.integrations.apiKeys.empty')}
          </li>
        ) : tokens.map((token) => {
          const active = isActive(token);
          return (
            <li key={token.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-subtle">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">{token.name}</span>
                  <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border ${active ? 'bg-success-surface text-success-text border-success-text/20' : 'bg-danger-surface text-danger-text border-danger-text/20'}`}>
                    {active ? t('subscription.integrations.apiKeys.active') : t('subscription.integrations.apiKeys.revoked')}
                  </span>
                </div>
                <code className="text-xs text-text-muted font-sans">{apiTokenHint(token.lastChars)}</code>
                <p className="text-[11px] text-text-muted font-sans">
                  <span title={absolute(token.createdAt)}>{t('subscription.integrations.apiKeys.created', { when: relative(token.createdAt) })}</span>
                  {' · '}
                  <span title={absolute(token.lastUsedAt)}>{t('subscription.integrations.apiKeys.lastUsed', { when: relative(token.lastUsedAt) })}</span>
                </p>
              </div>
              {active && (
                <Button type="button" variant="ghost" size="sm" className="self-start sm:self-auto text-danger-text" onClick={() => setRevokeId(token.id)}>
                  {t('subscription.integrations.apiKeys.revoke')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {createOpen && (
        <DialogFrame title={t('subscription.integrations.apiKeys.create')} titleId="api-key-create-title" onClose={() => { if (!creating) setCreateOpen(false); }}>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createKey();
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-text">{t('subscription.integrations.apiKeys.nameLabel')}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
                autoFocus
                placeholder={t('subscription.integrations.apiKeys.namePlaceholder')}
                className="w-full rounded-lg border border-control bg-canvas px-3 py-2 text-sm text-text font-sans outline-none focus:border-text"
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-text">{t('subscription.integrations.apiKeys.scopesLabel')}</legend>
              <label className="flex items-center gap-2 text-sm text-text font-sans">
                <input
                  type="checkbox"
                  checked={fullAccess}
                  onChange={() => setScopes(fullAccess ? [] : [...AGENT_SCOPES])}
                />
                {t('subscription.integrations.apiKeys.fullAccess')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AGENT_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-xs text-text-muted font-sans">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    {t(SCOPE_KEYS[scope])}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" size="sm" disabled={creating} onClick={() => setCreateOpen(false)}>
                {t('subscription.integrations.apiKeys.cancel')}
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={creating} disabled={!name.trim() || scopes.length === 0}>
                {t('subscription.integrations.apiKeys.confirmCreate')}
              </Button>
            </div>
          </form>
        </DialogFrame>
      )}

      {secret && (
        <DialogFrame
          title={t('subscription.integrations.apiKeys.revealTitle')}
          titleId="api-key-reveal-title"
          onClose={() => { setSecret(null); setCopied(null); }}
        >
          <p className="mt-3 text-sm text-warning-text bg-warning-surface border border-warning-text/20 rounded-lg px-3 py-2 font-sans">
            {t('subscription.integrations.apiKeys.revealWarning')}
          </p>
          <code className="mt-3 block rounded-lg bg-canvas border border-subtle px-3 py-2 text-xs text-text break-all font-sans">{secret}</code>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void copy(secret, 'token')}>
              {copied === 'token' ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
              {copied === 'token' ? t('subscription.integrations.apiKeys.copied') : t('subscription.integrations.apiKeys.copy')}
            </Button>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-wide font-bold text-text-muted">{t('subscription.integrations.apiKeys.curlLabel')}</p>
          <pre className="mt-1 whitespace-pre-wrap break-all rounded-lg bg-canvas border border-subtle px-3 py-2 text-[11px] text-text-muted font-sans">{curl}</pre>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="primary" size="sm" onClick={() => { setSecret(null); setCopied(null); }}>
              {t('subscription.integrations.apiKeys.close')}
            </Button>
          </div>
        </DialogFrame>
      )}

      <AlertModal
        isOpen={Boolean(revokeTarget)}
        onClose={() => { if (!revoking) setRevokeId(null); }}
        type="danger"
        title={t('subscription.integrations.apiKeys.revokeTitle')}
        message={t('subscription.integrations.apiKeys.revokeMessage', { name: revokeTarget?.name ?? '' })}
        confirmLabel={t('subscription.integrations.apiKeys.revokeConfirm')}
        cancelLabel={t('subscription.integrations.apiKeys.cancel')}
        onConfirm={() => void confirmRevoke()}
        isPending={revoking}
      />
    </section>
  );
}
