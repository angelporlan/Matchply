"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { JobOffer } from '@/db/schema';
import { CvListItem } from '@/lib/job-offer-queries';
import { 
  updateJobOfferDetails, 
  updateJobOfferCv, 
  updateJobOfferStatus,
  evaluateSingleOfferMatchAction,
} from '@/app/dashboard/applications/actions';
import { createCvPlaceholder } from '@/app/dashboard/actions';
import { 
  X, ExternalLink, Calendar, Briefcase, Building2, Link2, 
  FileText, CheckCircle2, Bookmark, Send, PartyPopper, Ban, 
  Edit3, Save, Loader2, Sparkles, Clock, Archive,
  TrendingUp, AlertTriangle, AlertCircle, Copy, Check, ChevronDown, ChevronUp, ArrowLeft
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { parseSections, parseMarkdownTable, ParsedReport } from '@/lib/ai-parser';
import ResearchPanel from './ResearchPanel';

// Markdown-to-HTML parser function locally
function mdToHtml(markdown: string): string {
  if (!markdown) return '<p></p>';
  return markdown
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        return `<h4 class="text-xs font-bold text-text mt-4 mb-1.5 flex items-center gap-1">${trimmed.substring(4)}</h4>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h3 class="text-sm font-bold text-text mt-5 mb-2">${trimmed.substring(3)}</h3>`;
      }
      if (trimmed.startsWith('# ')) {
        return `<h2 class="text-base font-bold text-text mt-6 mb-3">${trimmed.substring(2)}</h2>`;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li class="text-xs text-text-muted dark:text-slate-350 ml-4 list-disc my-1">${trimmed.substring(2)}</li>`;
      }
      if (trimmed === '') {
        return '<div class="h-2"></div>';
      }
      
      let parsed = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-ai">$1</strong>');
      parsed = parsed.replace(/__(.*?)__/g, '<strong class="font-bold text-ai">$1</strong>');
      parsed = parsed.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
      parsed = parsed.replace(/_(.*?)_/g, '<em class="italic">$1</em>');
      
      return `<p class="text-xs text-text-muted dark:text-slate-300 my-1.5 leading-relaxed">${parsed}</p>`;
    })
    .join('');
}

function getParsedJson(field: any): any {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      return null;
    }
  }
  return field;
}

interface JobOfferDetailsPageProps {
  initialOffer: JobOffer;
  userCvs: CvListItem[];
  isPremium: boolean;
  initialResearch?: any;
}

export default function JobOfferDetailsPage({
  initialOffer,
  userCvs,
  isPremium,
  initialResearch = null,
}: JobOfferDetailsPageProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [offer, setOffer] = useState<JobOffer>(initialOffer);
  
  const [isEditing, setIsEditing] = useState(false);
  const [evaluatingMatch, setEvaluatingMatch] = useState(false);
  const [activeTab, setActiveTab] = useState<'research' | 'ai_eval' | 'outreach' | 'details'>(
    initialResearch ? 'research' : initialOffer.scoreOverall !== null ? 'ai_eval' : 'details'
  );
  
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [optimizingCv, setOptimizingCv] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State for editing details
  const [formData, setFormData] = useState({
    title: offer.title,
    company: offer.company,
    url: offer.url || '',
    platform: offer.platform,
    description: offer.description || '',
  });

  const [selectedCv, setSelectedCv] = useState<string>(offer.cvId || '');
  const [expandedReportSections, setExpandedReportSections] = useState<Record<string, boolean>>({
    A: true,
    B: true,
    C: false,
    D: false,
    E: true,
    G: false,
  });

  useEffect(() => {
    setOffer(initialOffer);
    setFormData({
      title: initialOffer.title,
      company: initialOffer.company,
      url: initialOffer.url || '',
      platform: initialOffer.platform,
      description: initialOffer.description || '',
    });
    setSelectedCv(initialOffer.cvId || '');
  }, [initialOffer]);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getPlatformStyle = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return {
          badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          glow: 'bg-blue-500/5',
        };
      case 'infojobs':
        return {
          badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
          glow: 'bg-orange-500/5',
        };
      case 'indeed':
        return {
          badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
          glow: 'bg-sky-500/5',
        };
      default:
        return {
          badge: 'bg-canvas text-text-muted border-subtle',
          glow: 'bg-ai/3',
        };
    }
  };

  const platformStyle = getPlatformStyle(offer.platform);

  const getStatusConfig = (status: string) => {
    const safeStatus = status.startsWith('archived:') ? 'archived' : status;
    switch (safeStatus) {
      case 'interested':
        return {
          title: t('applications.columns.interested.title'),
          style: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
          icon: <Bookmark className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'applied':
        return {
          title: t('applications.columns.applied.title'),
          style: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
          icon: <Send className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'interview':
        return {
          title: t('applications.columns.interview.title'),
          style: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'offer':
        return {
          title: t('applications.columns.offer.title'),
          style: 'text-success-text bg-action/10 border-emerald-500/20',
          icon: <PartyPopper className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'rejected':
        return {
          title: t('applications.columns.rejected.title'),
          style: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: <Ban className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'archived':
        return {
          title: t('applications.columns.archived.title'),
          style: 'text-slate-600 dark:text-slate-300 bg-slate-500/10 border-slate-500/20',
          icon: <Archive className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      default:
        return {
          title: status,
          style: 'text-text-muted bg-canvas border-subtle',
          icon: <Briefcase className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
    }
  };

  const statusConfig = getStatusConfig(offer.status);

  // Handle Create & Optimize CV for this offer with AI
  const handleOptimizeCvForOffer = async () => {
    setOptimizingCv(true);
    setError(null);
    try {
      const baseCv = userCvs.find(c => c.isBase) || userCvs.find(c => c.isPrincipal) || userCvs[0];
      if (!baseCv) {
        throw new Error('Primero crea o importa tu Currículum Base en Matchply para poder optimizarlo.');
      }

      const placeholderRes = await createCvPlaceholder({
        title: `CV - ${offer.title} (${offer.company})`,
        isBase: false,
        isPrincipal: false,
      });

      if (!placeholderRes.success || !placeholderRes.cvId) {
        throw new Error(placeholderRes.error || 'Error al crear el nuevo currículum.');
      }

      const targetCvId = placeholderRes.cvId;
      await updateJobOfferCv(offer.id, targetCvId);

      sessionStorage.setItem('matchply_optimize_params', JSON.stringify({
        baseCvId: baseCv.id,
        jobTitle: offer.title,
        company: offer.company,
        url: offer.url || undefined,
        platform: offer.platform || 'linkedin',
        jobDescription: offer.description || '',
        targetCvId: targetCvId,
      }));

      router.push(`/editor/${targetCvId}?optimize=true`);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar la optimización.');
      setOptimizingCv(false);
    }
  };

  // Handle CV change
  const handleCvChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cvId = e.target.value;
    setSelectedCv(cvId);
    setLoading(true);
    const result = await updateJobOfferCv(offer.id, cvId === '' ? null : cvId);
    if (result.success) {
      setOffer(prev => ({ ...prev, cvId: cvId === '' ? null : cvId }));
      router.refresh();
    } else {
      setError(result.error || t('applications.modal.cvUpdateError'));
    }
    setLoading(false);
  };

  // Handle stage/status change
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setLoading(true);
    const result = await updateJobOfferStatus(offer.id, newStatus);
    if (result.success) {
      setOffer(prev => ({ ...prev, status: newStatus }));
      router.refresh();
    } else {
      setError(result.error || 'Error al actualizar el estado.');
    }
    setLoading(false);
  };

  // Handle Save edits
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.company) {
      setError(t('applications.modal.requiredError'));
      return;
    }

    setLoading(true);
    const result = await updateJobOfferDetails(offer.id, {
      title: formData.title,
      company: formData.company,
      url: formData.url || null,
      platform: formData.platform,
      description: formData.description || null,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsEditing(false);
      setOffer(prev => ({
        ...prev,
        title: formData.title,
        company: formData.company,
        url: formData.url || null,
        platform: formData.platform,
        description: formData.description || null,
      }));
      router.refresh();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Generate outreach and prep questions on demand
  const handleGenerateOutreach = async () => {
    setAiGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Error al generar la información con IA.');
      }

      setOffer(prev => ({
        ...prev,
        outreachMessage: resData.outreachMessage,
        coverLetter: resData.coverLetter,
        interviewQuestions: resData.interviewQuestions
      }));
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al conectar con la IA de generación de contacto.');
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleSection = (sec: string) => {
    setExpandedReportSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Parsed data
  const parsedReport = parseSections(offer.rawReport || '');

  // Db structured questions or parsed from G
  const dbQuestions = getParsedJson(offer.interviewQuestions);
  const hasDbQuestions = Array.isArray(dbQuestions) && dbQuestions.length > 0;

  // Score computation values
  const scoreVal = offer.scoreOverall !== null ? offer.scoreOverall : 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius; // 282.74
  const isPercentage = scoreVal > 5;
  const strokeDashoffset = circumference - (circumference * scoreVal) / (isPercentage ? 100 : 5);

  return (
    <div className="space-y-6">
      {/* Botón Volver y cabecera móvil */}
      <div className="flex items-center justify-between gap-4 border-b border-subtle pb-4">
        <button
          onClick={() => router.push('/dashboard/applications')}
          className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-text dark:hover:text-white transition-colors bg-surface border border-subtle px-3 py-2 rounded-[8px] shadow-2xs font-display"
        >
          <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          Volver al tablero
        </button>

        <div className="flex items-center gap-2">
          {/* Mover Etapa Dropdown */}
          <div className="bg-surface border border-subtle px-3 py-2 rounded-[8px] flex items-center gap-1.5 shadow-2xs font-display text-xs">
            <span className="font-bold text-text-muted uppercase tracking-wide">Fase:</span>
            <select
              value={offer.status}
              onChange={handleStatusChange}
              disabled={loading}
              className="bg-transparent font-bold text-text focus:outline-none cursor-pointer pr-1"
            >
              <option value="interested">{t('applications.columns.interested.title')}</option>
              <option value="applied">{t('applications.columns.applied.title')}</option>
              <option value="interview">{t('applications.columns.interview.title')}</option>
              <option value="offer">{t('applications.columns.offer.title')}</option>
              <option value="rejected">{t('applications.columns.rejected.title')}</option>
              <option value="archived">{t('applications.columns.archived.title')}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleOptimizeCvForOffer}
            disabled={optimizingCv || loading}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-on-ai-action bg-ai-action hover:bg-ai-hover px-3.5 py-2 rounded-[8px] shadow-sm shadow-ai/20 transition-all font-display disabled:opacity-50"
          >
            {optimizingCv ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
            )}
            <span>{offer.cvId ? 'Re-optimizar CV con IA' : '✨ Optimizar CV con IA'}</span>
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-text dark:bg-white dark:text-canvas hover:bg-text/95 dark:hover:bg-surface-muted px-4 py-2 rounded-[8px] shadow-sm transition-all font-display"
          >
            {isEditing ? (
              <>
                <X className="w-3.5 h-3.5 stroke-[1.75]" />
                Cancelar
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 stroke-[1.75]" />
                Editar
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-450 text-xs rounded-[8px] font-medium font-sans">
          {error}
        </div>
      )}

      {/* Grid de 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLUMNA IZQUIERDA: Contexto Fijo / Sticky */}
        <div className="lg:col-span-4 bg-surface p-5 md:p-6 border border-subtle rounded-[12px] shadow-sm space-y-6 lg:sticky lg:top-6">
          
          {/* Score Overall Gauge */}
          {offer.scoreOverall !== null && (
            <div className="flex flex-col items-center justify-center text-center bg-canvas/35 border border-subtle p-4 rounded-xl relative overflow-hidden">
              <div className="absolute top-[-30%] right-[-30%] w-32 h-32 bg-action/3 rounded-full filter blur-xl pointer-events-none" />
              
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 font-display">
                Compatibilidad general
              </span>
              
              <div className="relative flex items-center justify-center w-28 h-28">
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    className="stroke-slate-200 dark:stroke-slate-800 fill-transparent"
                    strokeWidth="8"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    className={`fill-transparent transition-all duration-1000 ${
                      scoreVal >= 4.0
                        ? 'stroke-emerald-500'
                        : scoreVal >= 3.0
                        ? 'stroke-ai'
                        : 'stroke-rose-500'
                    }`}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center font-display">
                  <span className="text-3xl font-black text-text leading-none">
                    {isPercentage ? scoreVal.toFixed(0) : scoreVal.toFixed(1)}
                  </span>
                  <span className="text-[9px] font-bold text-text-muted dark:text-slate-550 uppercase mt-1">
                    {isPercentage ? 'de 100' : 'de 5'}
                  </span>
                </div>
              </div>
              
              {!!offer.scoreBreakdown && (
                <div className="w-full mt-4 pt-3 border-t border-subtle space-y-2">
                  {Object.entries(getParsedJson(offer.scoreBreakdown) || {}).map(([key, val]: [string, any]) => {
                    const parsedVal = parseFloat(val);
                    return (
                      <div key={key} className="flex justify-between items-center text-[10px] font-sans">
                        <span className="text-text-muted capitalize font-medium">{key.replace(/_/g, ' ')}</span>
                        <span className="font-bold text-text">
                          {parsedVal.toFixed(isPercentage ? 0 : 1)}{isPercentage ? '/100' : '/5'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Botón para recalcular match con perfil actual */}
              <button
                type="button"
                onClick={async () => {
                  setEvaluatingMatch(true);
                  try {
                    const res = await evaluateSingleOfferMatchAction(offer.id);
                    if (res.success && typeof res.score === 'number') {
                      setOffer(prev => ({ ...prev, scoreOverall: res.score }));
                      router.refresh();
                    }
                  } finally {
                    setEvaluatingMatch(false);
                  }
                }}
                disabled={evaluatingMatch}
                className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-ai/10 to-ai-action/10 hover:from-ai/20 hover:to-ai-action/20 text-ai border border-ai/25 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 font-display"
              >
                {evaluatingMatch ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{evaluatingMatch ? 'Evaluando...' : '⚡ Recalcular Match con tu Perfil'}</span>
              </button>
            </div>
          )}

          {/* CV vinculado selector */}
          <div className="bg-canvas/35 border border-subtle p-4 rounded-[12px] space-y-3 font-display">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-ai stroke-[1.75]" />
                Currículum Vinculado
              </h4>
              <p className="text-[10px] text-text-muted font-sans leading-relaxed">
                Asigna o edita el CV optimizado para esta oferta.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="bg-canvas border border-control p-2 rounded-[8px] flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-text-muted dark:text-slate-550 stroke-[1.75]" />
                <select
                  value={selectedCv}
                  onChange={handleCvChange}
                  disabled={loading}
                  className="w-full bg-transparent text-[11px] text-text font-bold focus:outline-none cursor-pointer pr-4 font-sans"
                >
                  <option value="">{t('applications.modal.noCvLinked')}</option>
                  {userCvs.map((cv) => (
                    <option key={cv.id} value={cv.id}>
                      {cv.title.length > 30 ? cv.title.substring(0, 30) + '...' : cv.title}
                    </option>
                  ))}
                </select>
              </div>

              {offer.cvId ? (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <a
                    href={`/editor/${offer.cvId}`}
                    className="text-xs font-bold text-text bg-surface border border-control dark:border-white/15 hover:bg-surface-muted dark:hover:bg-surface-muted py-2 rounded-[8px] transition-all flex items-center justify-center gap-1 text-center"
                  >
                    <Edit3 className="w-3.5 h-3.5 stroke-[1.75]" />
                    Editar CV
                  </a>
                  <button
                    type="button"
                    onClick={handleOptimizeCvForOffer}
                    disabled={optimizingCv || loading}
                    className="text-xs font-bold text-on-ai-action bg-ai-action hover:bg-ai-hover py-2 rounded-[8px] shadow-sm transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {optimizingCv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />}
                    Re-optimizar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOptimizeCvForOffer}
                  disabled={optimizingCv || loading}
                  className="text-xs font-bold text-on-ai-action bg-ai-action hover:bg-ai-hover py-2.5 rounded-[8px] shadow-sm shadow-ai/20 transition-all flex items-center justify-center gap-1.5 w-full disabled:opacity-50 mt-1"
                >
                  {optimizingCv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />}
                  ✨ Crear y optimizar CV con IA
                </button>
              )}
            </div>
          </div>

          {/* TL;DR */}
          {offer.tldr && (
            <div className="space-y-1.5 font-display">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-ai stroke-[1.75]" />
                Resumen de IA
              </span>
              <div className="relative bg-ai/5 dark:bg-ai/10 border border-ai/20 rounded-xl p-3.5 pl-6">
                <div className="absolute top-1 left-2 text-ai/25 font-serif text-3xl leading-none">“</div>
                <p className="text-[11px] font-sans font-medium text-text italic leading-relaxed">
                  {offer.tldr}
                </p>
              </div>
            </div>
          )}

          {/* Red Flags */}
          {(() => {
            const flags = getParsedJson(offer.redFlags);
            if (!flags || !Array.isArray(flags) || flags.length === 0) return null;
            return (
              <div className="space-y-2 font-display">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 stroke-[1.75]" />
                  Alertas detectadas ({flags.length})
                </span>
                <div className="space-y-2">
                  {flags.map((flag: any, idx: number) => {
                    const isObj = typeof flag === 'object' && flag !== null;
                    const title = isObj ? flag.title : '';
                    const description = isObj ? flag.description : flag;
                    return (
                      <div key={idx} className="flex items-start gap-2 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 dark:border-rose-500/20 px-3.5 py-2.5 rounded-xl text-[11px] font-medium text-rose-600 dark:text-rose-450 leading-snug">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 stroke-[1.75] mt-0.5" />
                        <div className="flex-1 space-y-0.5 font-sans">
                          {title && (
                            <span className="font-bold block text-rose-700 dark:text-rose-350">{title}</span>
                          )}
                          <span className={`${title ? 'text-[10px] text-rose-600/90 dark:text-rose-400/90 font-normal' : 'font-medium'} block`}>
                            {description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Fechas de Registro */}
          <div className="border-t border-subtle pt-4 space-y-2 font-display text-[11px]">
            <div className="flex justify-between">
              <span className="text-text-muted font-bold uppercase tracking-wider">Registrado</span>
              <span className="text-text-muted dark:text-slate-355 font-light">{new Date(offer.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted font-bold uppercase tracking-wider">Actualizado</span>
              <span className="text-text-muted dark:text-slate-355 font-light">{new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Pestañas e Información Detallada */}
        <div className="lg:col-span-8 space-y-6 flex flex-col min-h-[60vh]">
          
          {/* Header de la oferta */}
          <div className="bg-surface p-6 border border-subtle rounded-[12px] shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2 font-display">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${platformStyle.badge}`}>
                {offer.platform}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${statusConfig.style}`}>
                {statusConfig.icon}
                {statusConfig.title}
              </span>
              {offer.source && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-ai/20 bg-ai/10 text-ai flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-ai stroke-[1.75]" />
                  {offer.source}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-extrabold text-text tracking-tight font-display flex items-center gap-2">
                <Briefcase className="w-6.5 h-6.5 text-ai shrink-0 stroke-[1.75]" />
                {offer.title}
              </h1>
              <p className="text-text-muted dark:text-slate-300 text-base font-bold flex items-center gap-1.5 font-display">
                <Building2 className="w-5 h-5 text-text-muted shrink-0 stroke-[1.75]" />
                {offer.company}
              </p>
            </div>

            {offer.url && (
              <div className="pt-2">
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-ai hover:text-ai/90 dark:hover:text-violet-300 font-bold bg-ai/10 border border-ai/20 px-3.5 py-2 rounded-[8px] hover:bg-ai/15 transition-all shadow-2xs font-display"
                >
                  Ir al sitio web oficial de la oferta
                  <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                </a>
              </div>
            )}
          </div>

          {/* Barra de pestañas */}
          <div className="flex border-b border-subtle pb-px overflow-x-auto scrollbar-none gap-4 shrink-0 font-display">
            <button
              type="button"
              onClick={() => setActiveTab('research')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'research'
                  ? 'border-ai text-ai'
                  : 'border-transparent text-text-muted hover:text-text-muted dark:hover:text-slate-200'
              }`}
            >
              ✦ Investigación
            </button>
            {offer.rawReport && (
              <button
                type="button"
                onClick={() => setActiveTab('ai_eval')}
                className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'ai_eval'
                    ? 'border-ai text-ai'
                    : 'border-transparent text-text-muted hover:text-text-muted dark:hover:text-slate-200'
                }`}
              >
                ⚡ Evaluación IA
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('outreach')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'outreach'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-text-muted hover:text-text-muted dark:hover:text-slate-200'
              }`}
            >
              ✉️ Contacto y Prep
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'border-text dark:border-white text-text'
                  : 'border-transparent text-text-muted hover:text-text-muted dark:hover:text-slate-200'
              }`}
            >
              📋 Detalles
            </button>
          </div>

          {/* CONTENIDOS DE PESTAÑAS */}
          <div className="flex-1 bg-surface p-5 md:p-6 border border-subtle rounded-[12px] shadow-sm">
            {activeTab === 'research' && (
              <ResearchPanel offerId={offer.id} initialResearch={initialResearch} />
            )}
            
            {/* PESTAÑA: EVALUACIÓN IA */}
            {activeTab === 'ai_eval' && offer.rawReport && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-text uppercase tracking-wider font-display border-b border-subtle pb-2">
                  Informe Detallado de IA
                </h3>
                
                {/* Accordions */}
                <div className="space-y-3 font-sans">
                  
                  {/* Seccion B: Match con CV */}
                  {parsedReport.B && (
                    <div className="border border-subtle rounded-xl overflow-hidden bg-canvas/20">
                      <button
                        onClick={() => toggleSection('B')}
                        className="w-full flex items-center justify-between p-4 font-bold text-text text-xs uppercase tracking-wider font-display text-left"
                      >
                        <span>Match con CV y Gaps Técnicos</span>
                        {expandedReportSections.B ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      {expandedReportSections.B && (
                        <div className="p-4 border-t border-subtle bg-surface space-y-2.5">
                          {parsedReport.B.split('\n').map((line, idx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return null;
                            const isCheck = trimmed.includes('✓') || trimmed.includes('[✓]') || trimmed.match(/^-\s+✅|^-\s+✓/i);
                            const isAlert = trimmed.includes('⚠') || trimmed.includes('[!]') || trimmed.includes('x') || trimmed.match(/^-\s+❌|^-\s+⚠/i);
                            
                            return (
                              <div key={idx} className="flex items-start gap-2.5 text-xs text-text-muted dark:text-slate-300 leading-relaxed">
                                {isCheck ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                ) : isAlert ? (
                                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-ai-action shrink-0 mt-1.5 ml-1" />
                                )}
                                <span>{trimmed.replace(/^[-*+\s✓❌✅⚠]+/, '').replace(/^\[[✓!x]\]\s*/, '')}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Seccion C: Requisitos / Stack */}
                  {parsedReport.C && (
                    <div className="border border-subtle rounded-xl overflow-hidden bg-canvas/20">
                      <button
                        onClick={() => toggleSection('C')}
                        className="w-full flex items-center justify-between p-4 font-bold text-text text-xs uppercase tracking-wider font-display text-left"
                      >
                        <span>Análisis de Stack Tecnológico</span>
                        {expandedReportSections.C ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      {expandedReportSections.C && (
                        <div 
                          className="p-4 border-t border-subtle bg-surface text-xs leading-relaxed space-y-2.5"
                          dangerouslySetInnerHTML={{ __html: mdToHtml(parsedReport.C) }}
                        />
                      )}
                    </div>
                  )}

                  {/* Seccion E: Blueprint */}
                  {parsedReport.E && (
                    <div className="border border-subtle rounded-xl overflow-hidden bg-canvas/20">
                      <button
                        onClick={() => toggleSection('E')}
                        className="w-full flex items-center justify-between p-4 font-bold text-text text-xs uppercase tracking-wider font-display text-left"
                      >
                        <span>Blueprint de Personalización del CV</span>
                        {expandedReportSections.E ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      {expandedReportSections.E && (
                        <div className="p-4 border-t border-subtle bg-surface overflow-x-auto">
                          {(() => {
                            const table = parseMarkdownTable(parsedReport.E);
                            if (!table) {
                              return (
                                <div 
                                  className="text-xs leading-relaxed space-y-2.5"
                                  dangerouslySetInnerHTML={{ __html: mdToHtml(parsedReport.E) }}
                                />
                              );
                            }
                            return (
                              <table className="w-full text-left border-collapse text-xs font-sans">
                                <thead>
                                  <tr className="border-b border-subtle bg-canvas/45">
                                    {table.headers.map((h, i) => (
                                      <th key={i} className="p-2.5 font-bold uppercase tracking-wider text-text-muted text-[10px]">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {table.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="border-b border-subtle hover:bg-surface-muted dark:hover:bg-surface-muted/20">
                                      {row.map((col, cIdx) => (
                                        <td key={cIdx} className="p-2.5 text-text-muted dark:text-slate-300 align-top leading-relaxed">
                                          {/* Highlight key terminology */}
                                          <div dangerouslySetInnerHTML={{
                                            __html: col
                                              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-ai bg-ai/5 px-1 py-0.5 rounded">$1</strong>')
                                          }} />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Otras secciones (A, D, G) */}
                  {['A', 'D', 'G'].map((secLetter) => {
                    const content = parsedReport[secLetter as keyof ParsedReport];
                    if (!content) return null;
                    const secNames: Record<string, string> = {
                      A: 'Resumen Ejecutivo',
                      D: 'Puntos Fuertes y Débiles',
                      G: 'Preguntas Técnicas Sugeridas'
                    };
                    return (
                      <div key={secLetter} className="border border-subtle rounded-xl overflow-hidden bg-canvas/20">
                        <button
                          onClick={() => toggleSection(secLetter)}
                          className="w-full flex items-center justify-between p-4 font-bold text-text text-xs uppercase tracking-wider font-display text-left"
                        >
                          <span>{secNames[secLetter] || `Sección ${secLetter}`}</span>
                          {expandedReportSections[secLetter] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        
                        {expandedReportSections[secLetter] && (
                          <div 
                            className="p-4 border-t border-subtle bg-surface text-xs leading-relaxed space-y-2.5"
                            dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PESTAÑA: CONTACTO Y PREP */}
            {activeTab === 'outreach' && (
              <div className="space-y-6 animate-fadeIn font-display">
                
                {/* Check if outreach message, cover letter, and questions are empty */}
                {!offer.outreachMessage && !offer.coverLetter && !hasDbQuestions ? (
                  <div className="bg-surface border border-dashed border-control dark:border-white/10 rounded-[12px] p-8 text-center text-text-muted shadow-xs flex flex-col items-center justify-center min-h-[300px] font-sans">
                    <div className="w-12 h-12 rounded-full border border-ai/20 flex items-center justify-center bg-ai/5 shadow-sm mb-4">
                      <Send className="w-5 h-5 text-ai" />
                    </div>
                    <h3 className="text-sm font-bold text-text mb-2 font-display uppercase tracking-wider">
                      Sin contacto ni preparación
                    </h3>
                    <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed mb-6">
                      Genera plantillas personalizadas de email, mensajes para reclutadores y preguntas típicas de entrevista técnica basadas en los requisitos de esta oferta.
                    </p>
                    
                    <button
                      onClick={handleGenerateOutreach}
                      disabled={aiGenerating}
                      className="bg-text dark:bg-white dark:text-canvas hover:bg-text/95 dark:hover:bg-surface-muted text-white font-bold px-6 py-3 rounded-[8px] text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer font-display hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {aiGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-ai" />
                          Generando con IA...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-ai animate-pulse" />
                          Generar con IA
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-subtle pb-2">
                      <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                        Estrategias de Contacto y Preparación
                      </h3>
                      {aiGenerating && (
                        <span className="text-xs text-ai font-bold flex items-center gap-1.5 animate-pulse font-sans">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerando...
                        </span>
                      )}
                    </div>

                    {/* Email Outreach message */}
                    {offer.outreachMessage && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
                            Mensaje de Contacto / Outreach
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleCopy(offer.outreachMessage!, 'outreach')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-subtle bg-canvas hover:bg-surface-muted dark:hover:bg-canvas/90 text-text"
                          >
                            {copiedField === 'outreach' ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">{t('applications.modal.outreachCopied')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-text-muted" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="bg-canvas/45 border border-subtle p-3.5 rounded-xl text-xs text-text-muted dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans font-light">
                          {offer.outreachMessage}
                        </div>
                      </div>
                    )}

                    {/* Cover Letter */}
                    {offer.coverLetter && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
                            Carta de Presentación (Cover Letter)
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleCopy(offer.coverLetter!, 'cover_letter')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-subtle bg-canvas hover:bg-surface-muted dark:hover:bg-canvas/90 text-text"
                          >
                            {copiedField === 'cover_letter' ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">{t('applications.modal.outreachCopied')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-text-muted" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="bg-canvas/45 border border-subtle p-4 rounded-xl text-xs text-text-muted dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans font-light max-h-[250px] overflow-y-auto scrollbar-custom">
                          {offer.coverLetter}
                        </div>
                      </div>
                    )}

                    {/* Technical Interview Questions (Preguntas probables) */}
                    {(hasDbQuestions || parsedReport.G) && (
                      <div className="space-y-3 pt-3 border-t border-subtle">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-indigo-500 stroke-[1.75]" />
                          Preguntas Probables de Entrevista
                        </span>

                        <div className="space-y-3 font-sans">
                          {hasDbQuestions ? (
                            dbQuestions.map((item: any, qIdx: number) => (
                              <div key={qIdx} className="bg-canvas/35 border border-subtle p-4 rounded-xl space-y-1.5">
                                <h4 className="text-xs font-bold text-text flex gap-1.5 leading-snug">
                                  <span className="text-ai">{qIdx + 1}.</span>
                                  {item.question}
                                </h4>
                                <p className="text-[11px] text-text-muted dark:text-slate-350 leading-relaxed font-light pl-4 border-l border-ai/30">
                                  <strong className="font-semibold text-text">Consejo de respuesta:</strong> {item.tip}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div 
                              className="bg-canvas/35 border border-subtle p-4.5 rounded-xl text-xs leading-relaxed space-y-2.5 font-light"
                              dangerouslySetInnerHTML={{ __html: mdToHtml(parsedReport.G || '') }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Option to regenerate */}
                    <div className="flex justify-end pt-3">
                      <button
                        onClick={handleGenerateOutreach}
                        disabled={aiGenerating}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ai hover:text-ai/90 bg-ai/10 border border-ai/20 px-4 py-2.5 rounded-[8px] transition-all disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        Regenerar con IA
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA: DETALLES COMPLETOS */}
            {activeTab === 'details' && (
              <div className="space-y-4 animate-fadeIn">
                
                {isEditing ? (
                  /* Formulario de Edición */
                  <form onSubmit={handleSave} className="space-y-4 font-display">
                    <h3 className="text-sm font-bold text-text uppercase tracking-wider border-b border-subtle pb-2">
                      Editar Detalles de la Oferta
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted dark:text-text flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-text-muted" />
                          Puesto *
                        </label>
                        <input
                          type="text"
                          name="title"
                          required
                          value={formData.title}
                          onChange={handleInputChange}
                          className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted dark:text-text flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-text-muted" />
                          Empresa *
                        </label>
                        <input
                          type="text"
                          name="company"
                          required
                          value={formData.company}
                          onChange={handleInputChange}
                          className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted dark:text-text flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-text-muted" />
                          Enlace de la Oferta
                        </label>
                        <input
                          type="url"
                          name="url"
                          value={formData.url}
                          onChange={handleInputChange}
                          placeholder="https://..."
                          className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-muted dark:text-text">Plataforma</label>
                        <select
                          name="platform"
                          value={formData.platform}
                          onChange={handleInputChange}
                          className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai transition-all cursor-pointer font-sans"
                        >
                          <option value="linkedin">LinkedIn</option>
                          <option value="infojobs">InfoJobs</option>
                          <option value="indeed">Indeed</option>
                          <option value="other">Otra</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted dark:text-text">Descripción / Requisitos</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={10}
                        className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all resize-none font-sans"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text dark:hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-text dark:bg-white dark:text-canvas rounded-[8px] transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            Guardar Cambios
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Modo Vista de Detalles */
                  <div className="space-y-5">
                    <div className="flex justify-between items-center border-b border-subtle pb-2">
                      <h3 className="text-sm font-bold text-text uppercase tracking-wider font-display">
                        Descripción de la Vacante
                      </h3>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-bold text-ai hover:underline flex items-center gap-1 font-display"
                      >
                        <Edit3 className="w-3.5 h-3.5 stroke-[1.75]" />
                        Editar descripción
                      </button>
                    </div>

                    {offer.description ? (
                      <div className="bg-canvas/45 border border-subtle p-5 rounded-[12px] text-text-muted dark:text-text text-sm whitespace-pre-wrap leading-relaxed font-sans font-light max-h-[50vh] overflow-y-auto scrollbar-custom">
                        {offer.description}
                      </div>
                    ) : (
                      <div className="bg-canvas/25 border border-dashed border-subtle p-8 rounded-[12px] text-center text-text-muted italic text-xs font-sans">
                        No hay descripción detallada registrada para esta oferta.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
