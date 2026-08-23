'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

type ResearchData = {
  id: string;
  status: string;
  attempt: number;
  scoreOverall: number | null;
  confidence: number | null;
  report: any;
  lastError: string | null;
  createdAt: string | Date;
  completedAt: string | Date | null;
  agents: Array<{ id: string; role: string; status: string; error: string | null }>;
  sources: Array<{ id: string; url: string; canonicalUrl: string; title: string | null; domain: string | null; excerpt: string | null }>;
};

function statusLabel(status: string) {
  return ({ queued: 'En cola', running: 'Investigando', completed: 'Completada', partial: 'Parcial', failed: 'Fallida', quota_exceeded: 'Cuota agotada' } as Record<string, string>)[status] || status;
}

function dateLabel(value: string | Date | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('es-ES');
}

export default function ResearchPanel({ offerId, initialResearch }: { offerId: string; initialResearch: ResearchData | null }) {
  const [research, setResearch] = useState<ResearchData | null>(initialResearch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch(`/api/research/${offerId}`, { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json();
    setResearch(body.research || null);
  }

  useEffect(() => {
    if (!research || !['queued', 'running'].includes(research.status)) return;
    const timer = window.setInterval(() => { void load(); }, 4_000);
    return () => window.clearInterval(timer);
  }, [research?.status, offerId]);

  async function retry() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/research/${offerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retry: true }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'No se pudo reintentar la investigación');
    else await load();
    setLoading(false);
  }

  const report = research?.report;
  const agents = research?.agents || [];
  const sourceList = research?.sources || report?.sources || [];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#1e1b4b]/10 dark:border-white/5 pb-4">
        <div>
          <h3 className="text-sm font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#8b5cf6]" /> Investigación profunda</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Oferta, empresa, personas y señales públicas. Las fuentes se conservan como extractos limitados.</p>
        </div>
        {research && <span className={`self-start text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${research.status === 'completed' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' : research.status === 'failed' ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' : 'text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20'}`}>{statusLabel(research.status)}</span>}
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">{error}</div>}

      {!research ? (
        <div className="rounded-xl border border-dashed border-[#8b5cf6]/30 bg-[#8b5cf6]/5 p-8 text-center space-y-3">
          <Sparkles className="w-8 h-8 mx-auto text-[#8b5cf6]" />
          <p className="text-sm font-semibold text-[#1e1b4b] dark:text-white">Aún no hay una investigación para esta oferta.</p>
          <p className="text-xs text-slate-500">Iníciala para analizarla en segundo plano con tu cuota PRO.</p>
          <button type="button" onClick={() => void retry()} disabled={loading} className="inline-flex items-center gap-2 bg-[#8b5cf6] text-white font-bold text-xs px-4 py-2.5 rounded-lg disabled:opacity-50"><Sparkles className="w-4 h-4" /> Iniciar investigación</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#fafafa] dark:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/10 p-4"><span className="text-[10px] uppercase tracking-wider text-slate-500">Score</span><div className="text-2xl font-black text-[#1e1b4b] dark:text-white mt-1">{research.scoreOverall ?? 'N/D'}{research.scoreOverall !== null && <span className="text-xs font-normal text-slate-400">/100</span>}</div></div>
            <div className="rounded-xl bg-[#fafafa] dark:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/10 p-4"><span className="text-[10px] uppercase tracking-wider text-slate-500">Confianza</span><div className="text-2xl font-black text-[#1e1b4b] dark:text-white mt-1">{research.confidence === null ? 'N/D' : `${Math.round(research.confidence * 100)}%`}</div></div>
            <div className="rounded-xl bg-[#fafafa] dark:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/10 p-4"><span className="text-[10px] uppercase tracking-wider text-slate-500">Actualizada</span><div className="text-xs font-semibold text-[#1e1b4b] dark:text-white mt-2">{dateLabel(research.completedAt || research.createdAt)}</div></div>
          </div>

          <div className="rounded-xl border border-[#1e1b4b]/10 dark:border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-wider text-[#1e1b4b] dark:text-white">Progreso por agente</h4>{['queued', 'running'].includes(research.status) && <Loader2 className="w-4 h-4 animate-spin text-[#8b5cf6]" />}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{agents.map(agent => <div key={agent.id} className="flex items-center justify-between rounded-lg bg-[#fafafa] dark:bg-[#0b0f19]/30 p-3 text-xs"><span className="font-semibold text-[#1e1b4b] dark:text-white">{agent.role}</span><span className={`flex items-center gap-1 ${agent.status === 'completed' ? 'text-emerald-500' : agent.status === 'failed' ? 'text-rose-500' : 'text-[#8b5cf6]'}`}>{agent.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : agent.status === 'failed' ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}{agent.status}</span></div>)}</div>
          </div>

          {report && <div className="space-y-4">
            <div className="rounded-xl bg-[#8b5cf6]/5 border border-[#8b5cf6]/20 p-4"><div className="text-[10px] uppercase tracking-wider font-bold text-[#8b5cf6] mb-2">Recomendación: {report.recommendation || 'insufficient_evidence'}</div><p className="text-sm text-[#1e1b4b] dark:text-slate-200 leading-relaxed">{report.executiveSummary}</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Red flags</h4><ul className="mt-2 space-y-1.5 text-xs text-rose-700 dark:text-rose-300">{(report.redFlags || []).length ? report.redFlags.map((item: string, index: number) => <li key={index}>• {item}</li>) : <li>No hay señales confirmadas.</li>}</ul></div>
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Desconocidos</h4><ul className="mt-2 space-y-1.5 text-xs text-amber-700 dark:text-amber-300">{(report.unknowns || []).length ? report.unknowns.map((item: string, index: number) => <li key={index}>• {item}</li>) : <li>No hay desconocidos adicionales.</li>}</ul></div>
            </div>
            <div className="rounded-xl border border-[#1e1b4b]/10 dark:border-white/10 p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-[#1e1b4b] dark:text-white">Próximos pasos</h4><ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">{(report.nextSteps || []).map((item: string, index: number) => <li key={index}>• {item}</li>)}</ul></div>
          </div>}

          <div className="space-y-2"><h4 className="text-xs font-bold uppercase tracking-wider text-[#1e1b4b] dark:text-white">Fuentes utilizadas ({sourceList.length})</h4>{sourceList.length ? <div className="space-y-2">{sourceList.map((source: any, index: number) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 p-3 rounded-lg border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8b5cf6]/40 transition-colors"><ExternalLink className="w-3.5 h-3.5 text-[#8b5cf6] mt-0.5 shrink-0" /><span className="text-xs text-[#1e1b4b] dark:text-slate-200 truncate">{source.title || source.domain || source.url}</span></a>)}</div> : <p className="text-xs text-slate-500">No se han encontrado fuentes públicas accesibles.</p>}</div>

          {research.lastError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">{research.lastError}</div>}
          {['failed', 'partial'].includes(research.status) && <button type="button" onClick={() => void retry()} disabled={loading} className="inline-flex items-center gap-2 border border-[#8b5cf6]/30 text-[#8b5cf6] font-bold text-xs px-4 py-2.5 rounded-lg disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Reintentar investigación</button>}
        </>
      )}
    </div>
  );
}
