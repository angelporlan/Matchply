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
  initialApiKey: string | null;
  isPremium: boolean;
}

export default function ApiKeyConsole({ initialApiKey, isPremium }: ApiKeyConsoleProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    
    const result = await generateUserApiKey();
    if (result.success && result.apiKey) {
      setApiKey(result.apiKey);
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
      setApiKey(null);
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
      <div className="relative bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm mt-8 overflow-hidden font-display">
        {/* Glow de fondo */}
        <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/8 rounded-full filter blur-[60px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
          {/* Badge PRO y Icono de Bloqueo */}
          <div className="p-4 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/15 border border-[#8b5cf6]/20 rounded-2xl text-[#8b5cf6] shrink-0">
            <Lock className="w-7 h-7 stroke-[1.75]" />
          </div>

          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/35 px-2.5 py-0.5 rounded-full inline-block">
                {t('subscription.apiKey.badgePro')}
              </span>
              <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white">
                {t('subscription.apiKey.upsellTitle')}
              </h3>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 leading-relaxed font-sans font-light max-w-xl">
                {t('subscription.apiKey.upsellDesc')}
              </p>
            </div>

            {/* Listado de ventajas de integración */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 font-sans font-light text-xs text-[#1e1b4b]/80 dark:text-slate-350">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8b5cf6] shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature1')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8b5cf6] shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature2')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8b5cf6] shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature3')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8b5cf6] shrink-0 stroke-[1.75]" />
                <span>{t('subscription.apiKey.upsellFeature4')}</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="/api/stripe/checkout"
                className="inline-flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold py-2.5 px-5 rounded-[8px] text-xs transition-all shadow-sm shadow-[#8b5cf6]/10"
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
    <div className="relative bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/20 shadow-md shadow-[#8b5cf6]/5 mt-8 overflow-hidden font-display">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 rounded-full filter blur-[80px] pointer-events-none" />
      
      <div className="space-y-6 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e1b4b]/10 dark:border-white/5 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-[#8b5cf6] stroke-[1.75]" />
              {t('subscription.apiKey.title')}
            </h3>
            <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans font-light">
              {t('subscription.apiKey.desc')}
            </p>
          </div>

          <span className="self-start sm:self-auto text-[9px] uppercase tracking-wider font-extrabold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/35 px-2.5 py-0.5 rounded-full">
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
          <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 uppercase tracking-wider text-[10px]">
            {t('subscription.apiKey.labelSecretKey')}
          </label>

          {apiKey ? (
            <div className="flex gap-2">
              <div className="flex-1 bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 flex items-center justify-between font-mono text-xs text-[#1e1b4b] dark:text-white select-all min-w-0">
                <span className="truncate pr-4">
                  {showKey ? apiKey : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                </span>
                
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-[#1e1b4b]/50 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white shrink-0 p-1 transition-colors"
                  title={showKey ? 'Ocultar' : 'Revelar'}
                >
                  {showKey ? <EyeOff className="w-4 h-4 stroke-[1.75]" /> : <Eye className="w-4 h-4 stroke-[1.75]" />}
                </button>
              </div>

              {/* Botón Copiar */}
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-[#0b0f19]/90 rounded-[8px] flex items-center justify-center shrink-0 transition-all text-[#1e1b4b] dark:text-white"
                title="Copiar Clave"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 stroke-[1.75]" />}
              </button>

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
            <div className="bg-[#fafafa] dark:bg-[#0b0f19]/25 border border-dashed border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-6 text-center">
              <p className="text-xs text-[#1e1b4b]/50 dark:text-slate-400 italic font-sans font-light mb-4">
                {t('subscription.apiKey.placeholderEmpty')}
              </p>
              
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold py-2 px-4 rounded-[8px] text-xs transition-all disabled:opacity-50 shadow-sm"
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
        {apiKey && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-[#8b5cf6] hover:text-[#8b5cf6]/90 font-bold transition-all disabled:opacity-50"
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
        {apiKey && (
          <div className="space-y-3 pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1e1b4b] dark:text-white">
                <Terminal className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
                {t('subscription.apiKey.guideTitle')}
              </div>
              <Link 
                href="/docs/api"
                className="text-[10px] font-extrabold text-[#8b5cf6] hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                {language === 'es' ? 'Ver Manual Visual de la API' : 'View Visual API Guide'}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans leading-relaxed font-light">
              {t('subscription.apiKey.guideDesc')}
            </p>

            <div className="relative bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-xl font-mono text-[10px] text-[#1e1b4b]/80 dark:text-slate-200 select-all leading-relaxed whitespace-pre-wrap">
              {`# Integración oficial con tu Kanban de Matchply\n`}
              {`MATCHPLY_API_KEY=${apiKey}\n`}
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
