'use client';

import { useState } from 'react';
import { Check, Clipboard, Link2, Loader2, RefreshCw, ShieldCheck, Trash2, Unplug } from 'lucide-react';

type Installation = {
  id: string;
  tokenPrefix: string;
  extensionVersion: string | null;
  status: string;
  lastSeenAt: string | Date | null;
  lastCaptureAt: string | Date | null;
  expiresAt: string | Date;
  revokedAt: string | Date | null;
  createdAt: string | Date;
};

type Props = {
  initialInstallations: Installation[];
  initialQuota: { used: number; limit: number };
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export default function LinkedInExtensionConsole({ initialInstallations, initialQuota }: Props) {
  const [installations, setInstallations] = useState(initialInstallations);
  const [pairing, setPairing] = useState<{ id: string; code: string; expiresAt: string } | null>(null);
  const [quota, setQuota] = useState(initialQuota);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [installationsResponse, quotaResponse] = await Promise.all([
      fetch('/api/extension/pairings', { cache: 'no-store' }),
      fetch('/api/research/quota', { cache: 'no-store' }),
    ]);
    if (installationsResponse.ok) setInstallations((await installationsResponse.json()).installations || []);
    if (quotaResponse.ok) setQuota((await quotaResponse.json()).quota || quota);
  }

  async function createPairing() {
    setLoading(true);
    setError(null);
    setPairing(null);
    const response = await fetch('/api/extension/pairings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'No se pudo generar el código');
    else setPairing(body.pairing);
    setLoading(false);
  }

  async function revoke(id: string) {
    if (!window.confirm('¿Revocar esta instalación de la extensión?')) return;
    setLoading(true);
    const response = await fetch(`/api/extension/pairings/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || 'No se pudo revocar la instalación');
    } else {
      await refresh();
    }
    setLoading(false);
  }

  async function copyCode() {
    if (!pairing) return;
    await navigator.clipboard.writeText(pairing.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="relative bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/20 shadow-md shadow-[#8b5cf6]/5 mt-8 overflow-hidden font-display">
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#8b5cf6]/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#1e1b4b]/10 dark:border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#8b5cf6] stroke-[1.75]" /> Extensión de LinkedIn
            </h3>
            <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans font-light mt-1 max-w-xl">
              Captura ofertas desde LinkedIn y deja que Matchply las investigue. La extensión solo recibe una sesión limitada de ingesta.
            </p>
          </div>
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/35 px-2.5 py-1 rounded-full">PRO · 10/mes</span>
        </div>

        {error && <div className="p-3 rounded-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-5">
          <div className="rounded-xl border border-[#1e1b4b]/10 dark:border-white/10 bg-[#fafafa] dark:bg-[#0b0f19]/30 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1e1b4b] dark:text-white"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Vincular una instalación</div>
            <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans leading-relaxed">Genera un código temporal, abre el popup de la extensión e introdúcelo allí. El código se consume una sola vez y caduca en 10 minutos.</p>
            <button type="button" onClick={createPairing} disabled={loading} className="inline-flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold py-2.5 px-4 rounded-[8px] text-xs disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Generar código
            </button>
            {pairing && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">Código válido hasta {formatDate(pairing.expiresAt)}</div>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-2xl tracking-[0.25em] font-bold text-[#1e1b4b] dark:text-white">{pairing.code}</code>
                  <button type="button" onClick={copyCode} className="p-2 rounded-md bg-white/70 dark:bg-black/20 text-[#8b5cf6]" title="Copiar código">{copied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}</button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#1e1b4b]/10 dark:border-white/10 p-5 space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-[#1e1b4b] dark:text-white">Cuota de investigación</span><button type="button" onClick={() => void refresh()} className="text-[#8b5cf6]" title="Actualizar"><RefreshCw className="w-4 h-4" /></button></div>
            <div className="text-3xl font-bold text-[#1e1b4b] dark:text-white">{quota.used}<span className="text-base text-slate-400"> / {quota.limit}</span></div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-[#8b5cf6] rounded-full" style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%` }} /></div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Se cuentan ofertas distintas por mes UTC. Los reintentos técnicos no consumen cuota.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-[#1e1b4b] dark:text-white">Instalaciones conectadas</h4><button type="button" onClick={() => void refresh()} className="text-xs text-[#8b5cf6] hover:underline">Actualizar</button></div>
          {!installations.length ? <div className="p-4 rounded-lg border border-dashed border-[#1e1b4b]/15 dark:border-white/10 text-xs text-slate-500">Aún no hay una instalación vinculada.</div> : installations.map(installation => (
            <div key={installation.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-[#1e1b4b]/10 dark:border-white/10 bg-[#fafafa] dark:bg-[#0b0f19]/20">
              <div className="flex items-start gap-3"><div className={`mt-1 w-2 h-2 rounded-full ${installation.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} /><div><div className="text-xs font-semibold text-[#1e1b4b] dark:text-white">{installation.tokenPrefix}… · {installation.status === 'active' ? 'Activa' : 'Revocada'}</div><div className="text-[10px] text-slate-500 mt-1">v{installation.extensionVersion || '?'} · última actividad {formatDate(installation.lastSeenAt)} · última captura {formatDate(installation.lastCaptureAt)}</div></div></div>
              {installation.status === 'active' && <button type="button" onClick={() => void revoke(installation.id)} disabled={loading} className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs text-rose-500 hover:text-rose-600 disabled:opacity-50"><Unplug className="w-3.5 h-3.5" /> Revocar</button>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-2"><Trash2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Matchply no guarda API keys en la extensión ni envía candidaturas, mensajes o contactos automáticamente.</p>
      </div>
    </div>
  );
}
