'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Key, Eye, EyeOff, Copy, Check, RefreshCw, Trash2, 
  ShieldAlert, Sparkles, Terminal, ArrowRight, Lock, 
  Loader2, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { generateUserApiKey, revokeUserApiKey } from '@/app/dashboard/actions';

interface ApiKeyConsoleProps {
  initialHasKey: boolean;
  initialApiKeyPrefix: string | null;
  isPremium: boolean;
}

export default function ApiKeyConsole({ initialHasKey, initialApiKeyPrefix, isPremium }: ApiKeyConsoleProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [keyPrefix, setKeyPrefix] = useState<string | null>(initialApiKeyPrefix);
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCopy = () => {
    if (!plaintextKey) return;
    navigator.clipboard.writeText(plaintextKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    
    const result = await generateUserApiKey();
    if (result.success && result.apiKey) {
      setHasKey(true);
      setPlaintextKey(result.apiKey);
      setKeyPrefix(result.prefix || result.apiKey.slice(0, 20));
      setShowKey(true);
      setSuccessMsg(t('subscription.apiKey.toastSuccess'));
      router.refresh();
    } else {
      setError(result.error || 'Failed to generate API Key');
    }
    setLoading(false);
  };

  const handleRevoke = async () => {
    const confirmMsg = t('subscription.apiKey.confirmRevoke');
    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const result = await revokeUserApiKey();
    if (result.success) {
      setHasKey(false);
      setPlaintextKey(null);
      setKeyPrefix(null);
      setShowKey(false);
      setSuccessMsg(t('subscription.apiKey.toastRevoked'));
      router.refresh();
    } else {
      setError(result.error || 'Failed to revoke API Key');
    }
    setLoading(false);
  };

  // CASO 1: BLOQUEO / UPSELL PARA PLAN GRATUITO
  if (!isPremium) {
    return (
      <div className="relative bg-surface p-8 rounded-[12px] border border-subtle shadow-sm mt-8 overflow-hidden font-display">
        {/* Glow de fondo */}
        <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-ai/5 dark:bg-ai/8 rounded-full filter blur-[60px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
          {/* Badge PRO y Icono de Bloqueo */}
          <div className="p-4 bg-ai/10 dark:bg-ai/15 border border-ai/20 rounded-2xl text-ai shrink-0">
            <Lock className="w-7 h-7 stroke-[1.75]" />
          </div>

          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-ai bg-ai/10 border border-ai/35 px-2.5 py-0.5 rounded-full inline-block">
                {t('subscription.apiKey.badgePro')}
              </span>
              <h3 className="text-lg font-bold text-text">
                {t('subscription.apiKey.upsellTitle')}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed font-sans font-light max-w-xl">
                {t('subscription.apiKey.upsellDesc')}
              </p>
            </div>

            {/* Listado de ventajas de integración */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 font-sans font-light text-xs text-text-muted dark:text-slate-350">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ai shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature1')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ai shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature2')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ai shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature3')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ai shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature4')}</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="/api/stripe/checkout"
                className="inline-flex items-center gap-2 bg-ai-action hover:bg-ai-hover text-on-ai-action font-bold py-2.5 px-5 rounded-[8px] text-xs transition-all shadow-sm shadow-ai/10"
              >
                <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                {t('subscription.apiKey.upsellCta')}
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CASO 2: PANEL ACTIVO PARA USUARIOS PREMIUM
  return (
    <div className="relative bg-surface p-8 rounded-[12px] border border-ai/20 shadow-md shadow-ai/5 mt-8 overflow-hidden font-display">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-ai/5 dark:bg-ai/10 rounded-full filter blur-[80px] pointer-events-none" />
      
      <div className="space-y-6 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-text flex items-center gap-2">
              <Key className="w-5 h-5 text-ai stroke-[1.75]" />
              {t('subscription.apiKey.title')}
            </h3>
            <p className="text-xs text-text-muted font-sans font-light">
              {t('subscription.apiKey.desc')}
            </p>
          </div>

          <span className="self-start sm:self-auto text-[9px] uppercase tracking-wider font-extrabold text-ai bg-ai/10 border border-ai/35 px-2.5 py-0.5 rounded-full">
            {t('subscription.apiKey.badgeActive')}
          </span>
        </div>

        {/* Alertas de error/éxito */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-[8px] text-xs font-semibold font-sans animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-[8px] text-xs font-semibold font-sans animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[1.75]" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Api key display field */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-muted dark:text-text uppercase tracking-wider text-[10px]">
            {t('subscription.apiKey.labelSecretKey')}
          </label>

          {hasKey ? (
            <div className="flex gap-2">
              <div className="flex-1 bg-canvas/45 border border-subtle rounded-[8px] px-3.5 py-2.5 flex items-center justify-between font-mono text-xs text-text select-all min-w-0">
                <span className="truncate pr-4">
                  {plaintextKey
                    ? (showKey ? plaintextKey : '••••••••••••••••••••••••••••••••••••••••••••••••')
                    : `${keyPrefix || 'matchply_usr_'}••••••••`}
                </span>
                
                {plaintextKey && (
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-text-muted hover:text-text dark:hover:text-white shrink-0 p-1 transition-colors"
                    title={showKey ? 'Ocultar' : 'Revelar'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4 stroke-[1.75]" /> : <Eye className="w-4 h-4 stroke-[1.75]" />}
                  </button>
                )}
              </div>

              {plaintextKey && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3.5 bg-canvas border border-control hover:bg-surface-muted dark:hover:bg-canvas/90 rounded-[8px] flex items-center justify-center shrink-0 transition-all text-text"
                  title="Copiar Clave"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 stroke-[1.75]" />}
                </button>
              )}

              {/* Botón Revocar (Trash icon) */}
              <button
                type="button"
                onClick={handleRevoke}
                disabled={loading}
                className="px-3.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 rounded-[8px] flex items-center justify-center shrink-0 transition-all text-rose-500 disabled:opacity-50"
                title="Revocar Clave"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 stroke-[1.75]" />}
              </button>
            </div>
          ) : (
            <div className="bg-canvas/25 border border-dashed border-subtle rounded-[12px] p-6 text-center">
              <p className="text-xs text-text-muted italic font-sans font-light mb-4">
                {t('subscription.apiKey.placeholderEmpty')}
              </p>
              
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-ai-action hover:bg-ai-hover text-on-ai-action font-bold py-2 px-4 rounded-[8px] text-xs transition-all disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 stroke-[1.75]" />
                    {t('subscription.apiKey.btnGenerate')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Regenerar clave si existe */}
        {hasKey && plaintextKey && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-sans leading-relaxed">
            {t('subscription.apiKey.revealedOnce')}
          </p>
        )}

        {hasKey && !plaintextKey && (
          <p className="text-[11px] text-text-muted font-sans leading-relaxed">
            {t('subscription.apiKey.storedMasked')}
          </p>
        )}

        {hasKey && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-ai hover:text-ai/90 font-bold transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 stroke-[1.75]" />
              )}
              {t('subscription.apiKey.btnRegenerate')}
            </button>
          </div>
        )}

        {/* Interactive Guide for API integration */}
        {hasKey && (
          <div className="space-y-3 pt-4 border-t border-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-text">
                <Terminal className="w-4 h-4 text-ai stroke-[1.75]" />
                {t('subscription.apiKey.guideTitle')}
              </div>
              <Link 
                href="/docs/api"
                className="text-[10px] font-extrabold text-ai hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                {language === 'es' ? 'Ver Manual Visual de la API' : 'View Visual API Guide'}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <p className="text-[11px] text-text-muted font-sans leading-relaxed font-light">
              {t('subscription.apiKey.guideDesc')}
            </p>

            <div className="relative bg-canvas border border-control p-4 rounded-xl font-mono text-[10px] text-text-muted dark:text-text select-all leading-relaxed whitespace-pre-wrap">
              {`# Integración oficial con tu Kanban de Matchply\n`}
              {`MATCHPLY_API_KEY=${plaintextKey || `${keyPrefix || 'matchply_usr_'}••••`}\n`}
              {`MATCHPLY_API_URL=http://localhost:3000/api/external/applications`}
            </div>

            <div className="flex items-start gap-2 text-[10px] text-amber-600 dark:text-amber-505 font-sans leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 stroke-[1.75] mt-0.5" />
              <span>
                <strong>{t('subscription.apiKey.infoTitle')}</strong> {t('subscription.apiKey.infoDesc')}
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
