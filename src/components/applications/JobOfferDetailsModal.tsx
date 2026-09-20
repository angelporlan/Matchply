"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { JobOffer } from '@/db/schema';
import { CompanyLookupItem, CvListItem } from '@/lib/job-offer-queries';
import CompanyLookupInput from '@/components/companies/CompanyLookupInput';
import { 
  updateJobOfferDetails, 
  updateJobOfferCv
} from '@/app/dashboard/applications/actions';
import { createCvPlaceholder } from '@/app/dashboard/actions';
import { 
  X, ExternalLink, Calendar, Briefcase, Building2, Link2, 
  FileText, CheckCircle2, Bookmark, Send, PartyPopper, Ban, 
  Edit3, Save, Loader2, Sparkles, Clock, Archive,
  TrendingUp, AlertTriangle, AlertCircle, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { MATCH_DIMENSION_KEYS, MATCH_DIMENSION_LABELS } from '@/lib/matching/types';
import { currentMatchEvidence } from '@/lib/match-display';

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
        return `<li class="text-xs text-text-muted dark:text-slate-300 ml-4 list-disc my-1">${trimmed.substring(2)}</li>`;
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

interface JobOfferDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: JobOffer;
  userCvs: CvListItem[];
  companies?: CompanyLookupItem[];
}

export default function JobOfferDetailsModal({
  isOpen,
  onClose,
  offer,
  userCvs,
  companies = [],
}: JobOfferDetailsModalProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // States para integración con API externa
  const [activeTab, setActiveTab] = useState<'details' | 'ai_eval' | 'outreach'>('details');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };


  useEffect(() => {
    setMounted(true);
  }, []);
  const [loading, setLoading] = useState(false);
  const [optimizingCv, setOptimizingCv] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State para Edición
  const [formData, setFormData] = useState({
    title: offer.title,
    company: offer.company,
    url: offer.url || '',
    platform: offer.platform,
    description: offer.description || '',
  });

  // Selector de CV en Modal
  const [selectedCv, setSelectedCv] = useState<string>(offer.cvId || '');

  // Resetear estados al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setIsEditing(false);
      setError(null);
      setActiveTab('details');
      setCopiedField(null);
      setFormData({
        title: offer.title,
        company: offer.company,
        url: offer.url || '',
        platform: offer.platform,
        description: offer.description || '',
      });
      setSelectedCv(offer.cvId || '');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, offer]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen || !mounted) return null;

  // Manejar clics fuera del modal para cerrar
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node) && !loading) {
      onClose();
    }
  };
  // Obtener estilo de la plataforma
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

  // Obtener estilo e icono del estado
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

      onClose();
      router.push(`/editor/${targetCvId}?optimize=true`);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar la optimización.');
      setOptimizingCv(false);
    }
  };

  // Cambiar CV vinculado
  const handleCvChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cvId = e.target.value;
    setSelectedCv(cvId);
    setLoading(true);
    const result = await updateJobOfferCv(offer.id, cvId === '' ? null : cvId);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || t('applications.modal.cvUpdateError'));
    }
    setLoading(false);
  };

  // Guardar cambios en edición
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
      router.refresh();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-surface border border-subtle rounded-2xl p-6 md:p-8 shadow-dialog dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-300 transform scale-100 max-h-[90vh] flex flex-col"
      >
        {/* Glow effects de fondo */}
        <div className={`absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full filter blur-[80px] pointer-events-none ${platformStyle.glow}`} />
        <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-ai/3 dark:bg-ai/5 rounded-full filter blur-[60px] pointer-events-none" />

        {/* Botón de cierre */}
        {!loading && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 md:top-8 md:right-8 text-text-muted hover:text-text dark:hover:text-white p-2 rounded-[8px] bg-canvas/45 hover:bg-canvas dark:hover:bg-canvas/90 border border-subtle flex items-center justify-center transition-all z-50 shadow-sm"
            title={t('dashboard.modal.ai.close')}
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        )}

        {/* CONTENIDO DEL MODAL (Scrolleable si es necesario) */}
        <div className="flex-1 overflow-y-auto scrollbar-custom pr-2 space-y-6 relative z-10">
          
          {/* Alerta de Error */}
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs rounded-[8px] font-medium pr-12 md:pr-16 font-sans">
              {error}
            </div>
          )}

          {!isEditing ? (
            /* ================= MODO VISTA ================= */
            <>
              {/* Header */}
              <div className="space-y-3 pr-12 md:pr-16">
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
                  <h3 className="text-xl md:text-2xl font-bold text-text tracking-tight font-display flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-ai shrink-0 stroke-[1.75]" />
                    {offer.title}
                  </h3>
                  <p className="text-text-muted dark:text-slate-300 text-sm font-semibold flex items-center gap-1.5 font-display">
                    <Building2 className="w-4 h-4 text-text-muted dark:text-slate-550 shrink-0 stroke-[1.75]" />
                    {offer.companyId ? (
                      <a
                        href={`/dashboard/applications/companies/${offer.companyId}`}
                        className="hover:text-ai hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {offer.company}
                      </a>
                    ) : offer.company}
                  </p>
                </div>
              </div>

              {/* Fila de Pestañas si es una oferta enriquecida por la IA */}
              {(() => {
                const isAiEnriched = 
                  offer.scoreOverall !== null || 
                  offer.tldr !== null || 
                  offer.rawReport !== null || 
                  offer.coverLetter !== null || 
                  offer.outreachMessage !== null;

                if (!isAiEnriched) {
                  return (
                    <>
                      {/* Grid de Información Secundaría */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-subtle py-4">
                        {/* Fechas de Seguimiento */}
                        <div className="space-y-2 font-display">
                          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
                            {t('applications.modal.datesTitle')}
                          </span>
                          <div className="space-y-1 text-xs text-text-muted dark:text-text font-sans">
                            <p className="flex justify-between sm:justify-start sm:gap-4">
                              <span className="text-text-muted font-medium">{t('applications.modal.dateRegistered')}</span> 
                              <span suppressHydrationWarning className="font-light">{new Date(offer.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { timeZone: 'Europe/Madrid' })}</span>
                            </p>
                            <p className="flex justify-between sm:justify-start sm:gap-4">
                              <span className="text-text-muted font-medium">{t('applications.modal.dateUpdated')}</span> 
                              <span suppressHydrationWarning className="font-light">{new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { timeZone: 'Europe/Madrid' })}</span>
                            </p>
                          </div>
                        </div>

                        {/* Enlace original */}
                        <div className="space-y-2 font-display">
                          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 stroke-[1.75]" />
                            {t('applications.modal.linkField')}
                          </span>
                          <div>
                            {offer.url ? (
                              <a
                                href={offer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-ai hover:text-ai/90 dark:hover:text-violet-300 font-semibold bg-ai/10 border border-ai/20 px-3 py-1.5 rounded-[8px] hover:bg-ai/15 transition-all"
                              >
                                {t('applications.modal.linkCvOfficial')}
                                <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                              </a>
                            ) : (
                              <span className="text-xs text-text-muted dark:text-slate-550 font-light italic font-sans">{t('applications.modal.noLinkProvided')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CV Vinculado y Selector */}
                      <div className="bg-canvas/35 border border-subtle p-4 rounded-[12px] space-y-3.5 font-display">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-ai stroke-[1.75]" />
                              {t('applications.modal.cvLinkedTitle')}
                            </h4>
                            <p className="text-[11px] text-text-muted font-sans">
                              {t('applications.modal.cvLinkedDesc')}
                            </p>
                          </div>

                          {/* Selector rápido */}
                          <div className="bg-canvas border border-control p-2 rounded-[8px] flex items-center gap-2 max-w-xs shrink-0">
                            <Link2 className="w-3.5 h-3.5 text-text-muted dark:text-slate-550 stroke-[1.75]" />
                            <select
                              value={selectedCv}
                              onChange={handleCvChange}
                              disabled={loading}
                              className="bg-transparent text-[11px] text-text font-medium focus:outline-none cursor-pointer pr-4 font-sans"
                            >
                              <option value="" className="bg-canvas text-text-muted dark:text-slate-550">{t('applications.modal.noCvLinked')}</option>
                              {userCvs.map((cv) => (
                                <option key={cv.id} value={cv.id} className="bg-canvas text-text">
                                  {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Si hay un CV enlazado, dar un botón premium para ir a verlo/editarlo */}
                        {offer.cvId && (
                          <div className="border-t border-subtle pt-3 flex justify-end">
                            <a
                              href={`/editor/${offer.cvId}`}
                              className="text-xs font-bold text-on-ai-action bg-ai-action hover:bg-ai-hover px-4 py-2 rounded-[8px] shadow-sm transition-all flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                              {t('applications.modal.viewCvBtn')}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Descripción Completa */}
                      <div className="space-y-2 font-display">
                        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-text-muted dark:text-slate-550 stroke-[1.75]" />
                          {t('applications.modal.descFieldRequired')}
                        </h4>
                        {offer.description ? (
                          <div className="bg-canvas/45 border border-subtle p-4 rounded-[12px] max-h-[300px] overflow-y-auto scrollbar-custom text-text-muted dark:text-text text-sm whitespace-pre-wrap leading-relaxed font-sans font-light">
                            {offer.description}
                          </div>
                        ) : (
                          <div className="bg-canvas/25 border border-dashed border-subtle p-6 rounded-[12px] text-center text-text-muted italic text-xs font-sans">
                            {t('applications.modal.noDescText')}
                          </div>
                        )}
                      </div>
                    </>
                  );
                }

                // Si es una oferta enriquecida con datos de IA, mostramos la interfaz moderna de pestañas
                return (
                  <div className="space-y-5 flex-1 flex flex-col min-h-0">
                    {/* Barra de Pestañas Premium */}
                    <div className="flex border-b border-subtle pb-px overflow-x-auto scrollbar-none gap-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 font-display ${
                          activeTab === 'details'
                            ? 'border-text dark:border-white text-text'
                            : 'border-transparent text-text-muted hover:text-text-muted dark:hover:text-slate-200'
                        }`}
                      >
                        📋 {t('applications.modal.tabDetails')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ai_eval')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 font-display flex items-center gap-1 ${
                          activeTab === 'ai_eval'
                            ? 'border-ai text-ai'
                            : 'border-transparent text-text-muted hover:text-text-muted dark:hover:text-slate-200'
                        }`}
                      >
                        ⚡ {t('applications.modal.tabAiEval')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('outreach')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 font-display flex items-center gap-1 ${
                          activeTab === 'outreach'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-text-muted hover:text-text-muted dark:hover:text-slate-200'
                        }`}
                      >
                        ✉️ {t('applications.modal.tabOutreach')}
                      </button>
                    </div>

                    {/* Contenidos Específicos */}
                    <div className="flex-1 min-h-0 space-y-4">
                      
                      {/* PESTAÑA: DETALLES */}
                      {activeTab === 'details' && (
                        <div className="space-y-4 animate-fadeIn">
                          {/* Grid de Información Secundaría */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-subtle pb-4">
                            {/* Fechas de Seguimiento */}
                            <div className="space-y-2 font-display">
                              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
                                {t('applications.modal.datesTitle')}
                              </span>
                              <div className="space-y-1 text-xs text-text-muted dark:text-text font-sans">
                                <p className="flex justify-between sm:justify-start sm:gap-4">
                                  <span className="text-text-muted font-medium">{t('applications.modal.dateRegistered')}</span> 
                                  <span suppressHydrationWarning className="font-light">{new Date(offer.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { timeZone: 'Europe/Madrid' })}</span>
                                </p>
                                <p className="flex justify-between sm:justify-start sm:gap-4">
                                  <span className="text-text-muted font-medium">{t('applications.modal.dateUpdated')}</span> 
                                  <span suppressHydrationWarning className="font-light">{new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { timeZone: 'Europe/Madrid' })}</span>
                                </p>
                                {offer.nextFollowupDate && (
                                  <p className="flex justify-between sm:justify-start sm:gap-4 text-ai font-bold">
                                    <span className="text-text-muted font-medium">Seguimiento:</span> 
                                    <span suppressHydrationWarning>{new Date(offer.nextFollowupDate).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { timeZone: 'Europe/Madrid' })}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Enlace original */}
                            <div className="space-y-2 font-display">
                              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 stroke-[1.75]" />
                                {t('applications.modal.linkField')}
                              </span>
                              <div>
                                {offer.url ? (
                                  <a
                                    href={offer.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-ai hover:text-ai/90 dark:hover:text-violet-300 font-semibold bg-ai/10 border border-ai/20 px-3 py-1.5 rounded-[8px] hover:bg-ai/15 transition-all"
                                  >
                                    {t('applications.modal.linkCvOfficial')}
                                    <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                                  </a>
                                ) : (
                                  <span className="text-xs text-text-muted dark:text-slate-550 font-light italic font-sans">{t('applications.modal.noLinkProvided')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* CV Vinculado y Selector */}
                          <div className="bg-canvas/35 border border-subtle p-4 rounded-[12px] space-y-3.5 font-display">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-ai stroke-[1.75]" />
                                  {t('applications.modal.cvLinkedTitle')}
                                </h4>
                                <p className="text-[11px] text-text-muted font-sans">
                                  {t('applications.modal.cvLinkedDesc')}
                                </p>
                              </div>

                              {/* Selector rápido */}
                              <div className="bg-canvas border border-control p-2 rounded-[8px] flex items-center gap-2 max-w-xs shrink-0">
                                <Link2 className="w-3.5 h-3.5 text-text-muted dark:text-slate-550 stroke-[1.75]" />
                                <select
                                  value={selectedCv}
                                  onChange={handleCvChange}
                                  disabled={loading}
                                  className="bg-transparent text-[11px] text-text font-medium focus:outline-none cursor-pointer pr-4 font-sans"
                                >
                                  <option value="" className="bg-canvas text-text-muted dark:text-slate-550">{t('applications.modal.noCvLinked')}</option>
                                  {userCvs.map((cv) => (
                                    <option key={cv.id} value={cv.id} className="bg-canvas text-text">
                                      {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="border-t border-subtle pt-3 flex items-center justify-end gap-2">
                              {offer.cvId ? (
                                <>
                                  <a
                                    href={`/editor/${offer.cvId}`}
                                    className="text-xs font-bold text-text bg-surface border border-control dark:border-white/15 hover:bg-surface-muted dark:hover:bg-surface-muted px-3.5 py-2 rounded-[8px] transition-all flex items-center gap-1.5"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 stroke-[1.75]" />
                                    {t('applications.modal.viewCvBtn')}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={handleOptimizeCvForOffer}
                                    disabled={optimizingCv || loading}
                                    className="text-xs font-bold text-on-ai-action bg-ai-action hover:bg-ai-hover px-3.5 py-2 rounded-[8px] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {optimizingCv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />}
                                    Re-optimizar con IA
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleOptimizeCvForOffer}
                                  disabled={optimizingCv || loading}
                                  className="text-xs font-bold text-on-ai-action bg-ai-action hover:bg-ai-hover px-4 py-2 rounded-[8px] shadow-sm shadow-ai/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {optimizingCv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />}
                                  ✨ Crear y optimizar CV con IA
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Descripción Completa */}
                          <div className="space-y-2 font-display">
                            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-text-muted dark:text-slate-550 stroke-[1.75]" />
                              {t('applications.modal.descFieldRequired')}
                            </h4>
                            {offer.description ? (
                              <div className="bg-canvas/45 border border-subtle p-4 rounded-[12px] max-h-[220px] overflow-y-auto scrollbar-custom text-text-muted dark:text-text text-sm whitespace-pre-wrap leading-relaxed font-sans font-light">
                                {offer.description}
                              </div>
                            ) : (
                              <div className="bg-canvas/25 border border-dashed border-subtle p-6 rounded-[12px] text-center text-text-muted italic text-xs font-sans">
                                {t('applications.modal.noDescText')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PESTAÑA: EVALUACIÓN IA */}
                      {activeTab === 'ai_eval' && (
                        <div className="space-y-5 animate-fadeIn font-display max-h-[50vh] overflow-y-auto pr-1 scrollbar-custom">
                          {/* Fila de Score y Datos Clave */}
                          <div className="flex flex-col sm:flex-row gap-6 bg-canvas/35 border border-subtle p-4.5 rounded-2xl">
                            {/* Compatibility Score Radial Indicator */}
                            <div className="flex flex-col items-center justify-center shrink-0 w-full sm:w-32 text-center my-auto">
                              <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">
                                {t('applications.modal.aiScoreTitle')}
                              </span>
                              {Boolean(currentMatchEvidence(offer)) ? (
                              <div className="relative flex items-center justify-center">
                                <svg className="w-20 h-20 transform -rotate-90">
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r="34"
                                    className="stroke-slate-200 dark:stroke-slate-700 fill-transparent"
                                    strokeWidth="6"
                                  />
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r="34"
                                    className={`fill-transparent transition-all duration-1000 ${
                                      (offer.scoreOverall ?? 0) >= 75
                                        ? 'stroke-emerald-500'
                                        : (offer.scoreOverall ?? 0) >= 60
                                        ? 'stroke-ai'
                                        : 'stroke-rose-500'
                                    }`}
                                    strokeWidth="6"
                                    strokeDasharray={2 * Math.PI * 34}
                                    strokeDashoffset={2 * Math.PI * 34 - ((offer.scoreOverall ?? 0) / 100) * (2 * Math.PI * 34)}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute flex flex-col items-center">
                                  <span className="text-xl font-black text-text leading-none">
                                    {Math.round(offer.scoreOverall || 0)}
                                  </span>
                                  <span className="text-[8px] font-bold text-text-muted dark:text-slate-550 uppercase mt-0.5">
                                    de 100
                                  </span>
                                </div>
                              </div>
                              ) : (
                                <p className="text-[10px] text-text-muted font-sans px-2">Sin match de perfil</p>
                              )}
                              <p className="text-[9px] text-text-muted leading-tight mt-2.5 font-sans max-w-[110px] italic">
                                {t('applications.modal.aiScoreHelp')}
                              </p>
                            </div>

                            {/* Breakdown bars */}
                            <div className="flex-1 space-y-3">
                              <h4 className="text-[10px] font-bold text-text uppercase tracking-wider flex items-center gap-1.5 border-b border-subtle pb-1">
                                <TrendingUp className="w-3.5 h-3.5 text-ai stroke-[1.75]" />
                                {t('applications.modal.aiBreakdownTitle')}
                              </h4>

                              {(() => {
                                const breakdown = getParsedJson(offer.scoreBreakdown) || {};
                                if (!currentMatchEvidence(offer)) {
                                  return (
                                    <div className="text-xs font-light text-text-muted dark:text-slate-550 italic font-sans py-1">
                                      Sin desglose de match de perfil.
                                    </div>
                                  );
                                }

                                return (
                                  <div className="space-y-2.5 max-h-[140px] overflow-y-auto scrollbar-custom pr-1">
                                    {MATCH_DIMENSION_KEYS.map((key) => {
                                      const valNum = Number(breakdown[key]);
                                      const safe = Number.isFinite(valNum) ? Math.round(valNum) : 0;
                                      
                                      return (
                                        <div key={key} className="space-y-0.5 font-sans">
                                          <div className="flex justify-between items-center text-[11px]">
                                            <span className="font-semibold text-text-muted dark:text-slate-350 capitalize text-[10px]">
                                              {MATCH_DIMENSION_LABELS[key]}
                                            </span>
                                            <span className="font-bold text-text text-[10px]">
                                              {safe}/100
                                            </span>
                                          </div>
                                          <div className="w-full bg-text/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                                            <div
                                              style={{ width: `${safe}%` }}
                                              className={`h-full rounded-full transition-all duration-1000 ${
                                                safe >= 75
                                                  ? 'bg-emerald-500'
                                                  : safe >= 60
                                                  ? 'bg-ai-action'
                                                  : 'bg-rose-500'
                                              }`}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}

                              {offer.legitimacyTier && (
                                <div className="pt-2 border-t border-subtle flex items-center justify-between text-[11px] font-sans">
                                  <span className="font-semibold text-text-muted">
                                    {t('applications.modal.aiLegitimacyTitle')}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-ai/10 text-ai border border-ai/20 font-bold text-[9px] uppercase">
                                    🛡️ {offer.legitimacyTier}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* TL;DR Highlight quote block */}
                          {offer.tldr && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-ai stroke-[1.75]" />
                                {t('applications.modal.aiTldrTitle')}
                              </span>
                              <div className="relative bg-ai/5 dark:bg-ai/10 border border-ai/20 rounded-xl p-3.5 pl-6">
                                <div className="absolute top-1 left-2 text-ai/25 font-serif text-3xl leading-none">“</div>
                                <p className="text-[11px] font-sans font-medium text-text italic leading-relaxed pl-0.5">
                                  {offer.tldr}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Red Flags array */}
                          <div className="space-y-1.5">
                            <h5 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 stroke-[1.75]" />
                              {t('applications.modal.aiRedFlagsTitle')}
                            </h5>
                            {(() => {
                              const flags = getParsedJson(offer.redFlags);
                              const hasFlags = Array.isArray(flags) && flags.length > 0;

                              if (!hasFlags) {
                                return (
                                  <div className="flex items-center gap-2 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 font-sans">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[1.75]" />
                                    <span className="text-[11px]">{t('applications.modal.starNoRedFlags')}</span>
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {flags.map((flag: any, idx: number) => {
                                    const isObj = typeof flag === 'object' && flag !== null;
                                    const title = isObj ? flag.title : '';
                                    const description = isObj ? flag.description : flag;
                                    return (
                                      <div key={idx} className="flex items-start gap-2 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 dark:border-rose-500/20 px-3 py-2 rounded-xl text-[11px] font-medium text-rose-600 dark:text-rose-400 font-sans leading-snug w-full">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 stroke-[1.75] mt-0.5" />
                                        <div className="flex-1 space-y-0.5">
                                          {title && (
                                            <span className="font-bold block text-rose-700 dark:text-rose-350">{title}</span>
                                          )}
                                          <span className={`${title ? 'text-[10px] text-rose-600/90 dark:text-rose-450/90 font-normal' : 'font-medium'} block`}>
                                            {description}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Proof points suggested to emphasize */}
                          {!!offer.targetProofPoints && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Bookmark className="w-3.5 h-3.5 text-violet-500 stroke-[1.75]" />
                                {t('applications.modal.aiProofPointsTitle')}
                              </span>
                              <div className="bg-canvas/35 border border-subtle p-3 rounded-xl font-sans">
                                <ul className="space-y-2">
                                  {(() => {
                                    const points = getParsedJson(offer.targetProofPoints);
                                    if (Array.isArray(points)) {
                                      return points.map((pt: any, idx: number) => {
                                        const isObj = typeof pt === 'object' && pt !== null;
                                        const title = isObj ? pt.title : '';
                                        const description = isObj ? pt.description : pt;
                                        return (
                                          <li key={idx} className="flex items-start gap-1.5 text-xs text-text-muted dark:text-slate-350 leading-relaxed">
                                            <Sparkles className="w-3 h-3 text-ai shrink-0 mt-0.5 stroke-[1.75]" />
                                            <div className="flex-1 space-y-0.5">
                                              {title && (
                                                <span className="font-bold block text-violet-700 dark:text-ai">{title}</span>
                                              )}
                                              <span className={`${title ? 'text-[10px] text-text-muted font-normal' : 'font-light'} block`}>
                                                {description}
                                              </span>
                                            </div>
                                          </li>
                                        );
                                      });
                                    }
                                    return <p className="text-xs italic text-text-muted">{JSON.stringify(points)}</p>;
                                  })()}
                                </ul>
                              </div>
                            </div>
                          )}

                          {/* Raw markdown report viewer */}
                          {offer.rawReport && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-text-muted dark:text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
                                {t('applications.modal.aiReportTitle')}
                              </span>
                              <div 
                                className="bg-canvas/45 border border-subtle p-4.5 rounded-xl max-h-[300px] overflow-y-auto scrollbar-custom font-sans font-light text-left leading-relaxed space-y-2.5"
                                dangerouslySetInnerHTML={{ __html: mdToHtml(offer.rawReport) }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* PESTAÑA: CONTACTO / OUTREACH */}
                      {activeTab === 'outreach' && (
                        <div className="space-y-4 animate-fadeIn font-display max-h-[50vh] overflow-y-auto pr-1 scrollbar-custom">
                          
                          {/* Recruiter Outreach note */}
                          {offer.outreachMessage && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                  <Send className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
                                  {t('applications.modal.outreachMessageTitle')}
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
                                      <span>{t('applications.modal.outreachCopyBtn')}</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="bg-canvas/45 border border-subtle p-3.5 rounded-xl text-xs text-text-muted dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans font-light select-all">
                                {offer.outreachMessage}
                              </div>
                            </div>
                          )}

                          {/* Cover Letter letterbox */}
                          {offer.coverLetter && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-text-muted dark:text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
                                  {t('applications.modal.outreachCoverLetterTitle')}
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
                                      <span>{t('applications.modal.outreachCopyBtn')}</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="bg-canvas/45 border border-subtle p-4 rounded-xl text-xs text-text-muted dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans font-light select-all max-h-[250px] overflow-y-auto scrollbar-custom">
                                {offer.coverLetter}
                              </div>
                            </div>
                          )}

                          {!offer.outreachMessage && !offer.coverLetter && (
                            <div className="bg-canvas/25 border border-dashed border-subtle p-6 rounded-xl text-center text-text-muted italic text-[11px] font-sans">
                              No se encontraron recursos de contacto para esta postulación.
                            </div>
                          )}
                        </div>
                      )}



                    </div>

                    {/* Acciones del footer de Pestañas */}
                    <div className="flex justify-between items-center pt-3 border-t border-subtle font-display mt-auto">
                      <span className="text-[9px] text-text-muted dark:text-slate-550 italic font-light font-sans">
                        ID: {offer.id}
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-4.5 py-2 rounded-[8px] bg-canvas border border-control hover:border-control dark:hover:border-white/20 text-text-muted dark:text-slate-300 hover:text-text dark:hover:text-white font-bold text-xs transition-all shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-ai stroke-[1.75]" />
                        {t('applications.modal.editBtn')}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            /* ================= MODO EDICIÓN ================= */
            <form onSubmit={handleSave} className="space-y-5 font-display">
              <div className="space-y-1 pr-12 md:pr-16">
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                  <Edit3 className="w-4.5 h-4.5 text-ai stroke-[1.75]" />
                  {t('applications.modal.editTitle')}
                </h3>
                <p className="text-xs text-text-muted font-sans">
                  {t('applications.modal.editDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    {t('applications.modal.jobField')}
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder={t('applications.modal.jobPlaceholder')}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai focus:ring-1 focus:ring-ai transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    {t('applications.modal.companyField')}
                  </label>
                  <CompanyLookupInput
                    name="company"
                    required
                    value={formData.company}
                    companies={companies}
                    placeholder={t('applications.modal.companyPlaceholder')}
                    onChange={(company) => setFormData((prev) => ({ ...prev, company }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-text-muted stroke-[1.75]" />
                    {t('applications.modal.linkField')}
                  </label>
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai focus:ring-1 focus:ring-ai transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted dark:text-text">{t('applications.modal.platformField')}</label>
                  <select
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text focus:outline-none focus:border-ai dark:focus:border-ai transition-all cursor-pointer font-sans"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="infojobs">InfoJobs</option>
                    <option value="indeed">Indeed</option>
                    <option value="other">{t('applications.modal.platformOther')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted dark:text-text">
                  {t('applications.modal.descFieldRequired')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={8}
                  placeholder={t('applications.modal.descPlaceholder')}
                  className="w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai focus:ring-1 focus:ring-ai transition-all resize-y font-sans font-light"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="px-4 py-2.5 text-sm font-semibold text-text-muted hover:text-text dark:hover:text-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-text hover:bg-text/90 dark:bg-white dark:hover:bg-surface-muted dark:text-canvas rounded-[8px] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('applications.modal.savingBtn')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 stroke-[1.75]" />
                      {t('applications.modal.saveChangesBtn')}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
