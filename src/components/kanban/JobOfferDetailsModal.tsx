"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { JobOffer, CV } from '@/db/schema';
import { 
  updateJobOfferDetails, 
  updateJobOfferCv
} from '@/app/dashboard/kanban/actions';
import { 
  X, ExternalLink, Calendar, Briefcase, Building2, Link2, 
  FileText, CheckCircle2, Bookmark, Send, PartyPopper, Ban, 
  Edit3, Save, Loader2, Sparkles, Clock, Archive,
  TrendingUp, AlertTriangle, AlertCircle, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';

function mdToHtml(markdown: string): string {
  if (!markdown) return '<p></p>';
  return markdown
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        return `<h4 class="text-xs font-bold text-[#1e1b4b] dark:text-white mt-4 mb-1.5 flex items-center gap-1">${trimmed.substring(4)}</h4>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h3 class="text-sm font-bold text-[#1e1b4b] dark:text-white mt-5 mb-2">${trimmed.substring(3)}</h3>`;
      }
      if (trimmed.startsWith('# ')) {
        return `<h2 class="text-base font-bold text-[#1e1b4b] dark:text-white mt-6 mb-3">${trimmed.substring(2)}</h2>`;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li class="text-xs text-[#1e1b4b]/80 dark:text-slate-300 ml-4 list-disc my-1">${trimmed.substring(2)}</li>`;
      }
      if (trimmed === '') {
        return '<div class="h-2"></div>';
      }
      let parsed = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#8b5cf6] dark:text-violet-400">$1</strong>');
      parsed = parsed.replace(/__(.*?)__/g, '<strong class="font-bold text-[#8b5cf6] dark:text-violet-400">$1</strong>');
      parsed = parsed.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
      parsed = parsed.replace(/_(.*?)_/g, '<em class="italic">$1</em>');
      
      return `<p class="text-xs text-[#1e1b4b]/80 dark:text-slate-300 my-1.5 leading-relaxed">${parsed}</p>`;
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
  userCvs: CV[];
}

export default function JobOfferDetailsModal({
  isOpen,
  onClose,
  offer,
  userCvs,
}: JobOfferDetailsModalProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // States para integración con API externa
  const [activeTab, setActiveTab] = useState<'details' | 'ai_eval' | 'outreach' | 'star_stories'>('details');
  const [expandedStory, setExpandedStory] = useState<number | null>(null);
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
      setExpandedStory(null);
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
          badge: 'bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b]/50 dark:text-slate-400 border-[#1e1b4b]/10 dark:border-white/10',
          glow: 'bg-[#8b5cf6]/3',
        };
    }
  };

  const platformStyle = getPlatformStyle(offer.platform);

  // Obtener estilo e icono del estado
  const getStatusConfig = (status: string) => {
    if (status.startsWith('archived:')) {
      return {
        title: t('kanban.board.archivedBadge'),
        style: 'text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/20',
        icon: <Archive className="w-3.5 h-3.5 stroke-[1.75]" />,
      };
    }

    switch (status) {
      case 'interested':
        return {
          title: t('kanban.columns.interested.title'),
          style: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
          icon: <Bookmark className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'applied':
        return {
          title: t('kanban.columns.applied.title'),
          style: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
          icon: <Send className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'interview':
        return {
          title: t('kanban.columns.interview.title'),
          style: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'offer':
        return {
          title: t('kanban.columns.offer.title'),
          style: 'text-[#2ecc71] bg-[#2ecc71]/10 border-emerald-500/20',
          icon: <PartyPopper className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'rejected':
        return {
          title: t('kanban.columns.rejected.title'),
          style: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: <Ban className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      default:
        return {
          title: status,
          style: 'text-[#1e1b4b]/50 dark:text-slate-400 bg-[#fafafa] dark:bg-[#0b0f19] border-[#1e1b4b]/10 dark:border-white/10',
          icon: <Briefcase className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
    }
  };

  const statusConfig = getStatusConfig(offer.status);

  // Cambiar CV vinculado
  const handleCvChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cvId = e.target.value;
    setSelectedCv(cvId);
    setLoading(true);
    const result = await updateJobOfferCv(offer.id, cvId === '' ? null : cvId);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || t('kanban.modal.cvUpdateError'));
    }
    setLoading(false);
  };

  // Guardar cambios en edición
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.company) {
      setError(t('kanban.modal.requiredError'));
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
        className="w-full max-w-2xl bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] p-6 md:p-8 shadow-[0_0_50px_rgba(139,92,246,0.15)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-300 transform scale-100 max-h-[90vh] flex flex-col"
      >
        {/* Glow effects de fondo */}
        <div className={`absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full filter blur-[80px] pointer-events-none ${platformStyle.glow}`} />
        <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-[60px] pointer-events-none" />

        {/* Botón de cierre */}
        {!loading && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 md:top-8 md:right-8 text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white p-2 rounded-[8px] bg-white dark:bg-[#0b0f19]/45 hover:bg-[#fafafa] dark:hover:bg-[#0b0f19]/90 border border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-center transition-all z-50 shadow-sm"
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
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#8b5cf6] stroke-[1.75]" />
                      {offer.source}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-bold text-[#1e1b4b] dark:text-white tracking-tight font-display flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#8b5cf6] dark:text-violet-400 shrink-0 stroke-[1.75]" />
                    {offer.title}
                  </h3>
                  <p className="text-[#1e1b4b]/70 dark:text-slate-300 text-sm font-semibold flex items-center gap-1.5 font-display">
                    <Building2 className="w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-550 shrink-0 stroke-[1.75]" />
                    {offer.company}
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
                  offer.outreachMessage !== null || 
                  offer.interviewStories !== null;

                if (!isAiEnriched) {
                  return (
                    <>
                      {/* Grid de Información Secundaría */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-[#1e1b4b]/10 dark:border-white/5 py-4">
                        {/* Fechas de Seguimiento */}
                        <div className="space-y-2 font-display">
                          <span className="text-[11px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
                            {t('kanban.modal.datesTitle')}
                          </span>
                          <div className="space-y-1 text-xs text-[#1e1b4b]/80 dark:text-slate-200 font-sans">
                            <p className="flex justify-between sm:justify-start sm:gap-4">
                              <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-medium">{t('kanban.modal.dateRegistered')}</span> 
                              <span className="font-light">{new Date(offer.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
                            </p>
                            <p className="flex justify-between sm:justify-start sm:gap-4">
                              <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-medium">{t('kanban.modal.dateUpdated')}</span> 
                              <span className="font-light">{new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
                            </p>
                          </div>
                        </div>

                        {/* Enlace original */}
                        <div className="space-y-2 font-display">
                          <span className="text-[11px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 stroke-[1.75]" />
                            {t('kanban.modal.linkField')}
                          </span>
                          <div>
                            {offer.url ? (
                              <a
                                href={offer.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-[#8b5cf6] dark:text-violet-400 hover:text-[#8b5cf6]/90 dark:hover:text-violet-300 font-semibold bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 px-3 py-1.5 rounded-[8px] hover:bg-[#8b5cf6]/15 transition-all"
                              >
                                {t('kanban.modal.linkCvOfficial')}
                                <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                              </a>
                            ) : (
                              <span className="text-xs text-[#1e1b4b]/40 dark:text-slate-550 font-light italic font-sans">{t('kanban.modal.noLinkProvided')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CV Vinculado y Selector */}
                      <div className="bg-[#fafafa] dark:bg-[#0b0f19]/35 border border-[#1e1b4b]/5 dark:border-white/5 p-4 rounded-[12px] space-y-3.5 font-display">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                              {t('kanban.modal.cvLinkedTitle')}
                            </h4>
                            <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                              {t('kanban.modal.cvLinkedDesc')}
                            </p>
                          </div>

                          {/* Selector rápido */}
                          <div className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 p-2 rounded-[8px] flex items-center gap-2 max-w-xs shrink-0">
                            <Link2 className="w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-550 stroke-[1.75]" />
                            <select
                              value={selectedCv}
                              onChange={handleCvChange}
                              disabled={loading}
                              className="bg-transparent text-[11px] text-[#1e1b4b] dark:text-slate-300 font-medium focus:outline-none cursor-pointer pr-4 font-sans"
                            >
                              <option value="" className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b]/40 dark:text-slate-550">{t('kanban.modal.noCvLinked')}</option>
                              {userCvs.map((cv) => (
                                <option key={cv.id} value={cv.id} className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b] dark:text-slate-300">
                                  {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Si hay un CV enlazado, dar un botón premium para ir a verlo/editarlo */}
                        {offer.cvId && (
                          <div className="border-t border-[#1e1b4b]/5 dark:border-white/5 pt-3 flex justify-end">
                            <a
                              href={`/editor/${offer.cvId}`}
                              className="text-xs font-bold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 px-4 py-2 rounded-[8px] shadow-sm transition-all flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                              {t('kanban.modal.viewCvBtn')}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Descripción Completa */}
                      <div className="space-y-2 font-display">
                        <h4 className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-550 stroke-[1.75]" />
                          {t('kanban.modal.descFieldRequired')}
                        </h4>
                        {offer.description ? (
                          <div className="bg-white dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-[12px] max-h-[300px] overflow-y-auto scrollbar-custom text-[#1e1b4b]/80 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed font-sans font-light">
                            {offer.description}
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-[#0b0f19]/25 border border-dashed border-[#1e1b4b]/10 dark:border-white/10 p-6 rounded-[12px] text-center text-[#1e1b4b]/40 dark:text-slate-500 italic text-xs font-sans">
                            {t('kanban.modal.noDescText')}
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
                    <div className="flex border-b border-[#1e1b4b]/10 dark:border-white/5 pb-px overflow-x-auto scrollbar-none gap-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 font-display ${
                          activeTab === 'details'
                            ? 'border-[#1e1b4b] dark:border-white text-[#1e1b4b] dark:text-white'
                            : 'border-transparent text-[#1e1b4b]/40 dark:text-slate-400 hover:text-[#1e1b4b]/70 dark:hover:text-slate-200'
                        }`}
                      >
                        📋 {t('kanban.modal.tabDetails')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ai_eval')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 font-display flex items-center gap-1 ${
                          activeTab === 'ai_eval'
                            ? 'border-[#8b5cf6] text-[#8b5cf6] dark:text-violet-400'
                            : 'border-transparent text-[#1e1b4b]/40 dark:text-slate-400 hover:text-[#1e1b4b]/70 dark:hover:text-slate-200'
                        }`}
                      >
                        ⚡ {t('kanban.modal.tabAiEval')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('outreach')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 font-display flex items-center gap-1 ${
                          activeTab === 'outreach'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-[#1e1b4b]/40 dark:text-slate-400 hover:text-[#1e1b4b]/70 dark:hover:text-slate-200'
                        }`}
                      >
                        ✉️ {t('kanban.modal.tabOutreach')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('star_stories')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 font-display flex items-center gap-1 ${
                          activeTab === 'star_stories'
                            ? 'border-[#8b5cf6] text-[#8b5cf6] dark:text-violet-400'
                            : 'border-transparent text-[#1e1b4b]/40 dark:text-slate-400 hover:text-[#1e1b4b]/70 dark:hover:text-slate-200'
                        }`}
                      >
                        🎯 {t('kanban.modal.tabStories')}
                      </button>
                    </div>

                    {/* Contenidos Específicos */}
                    <div className="flex-1 min-h-0 space-y-4">
                      
                      {/* PESTAÑA: DETALLES */}
                      {activeTab === 'details' && (
                        <div className="space-y-4 animate-fadeIn">
                          {/* Grid de Información Secundaría */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-[#1e1b4b]/10 dark:border-white/5 pb-4">
                            {/* Fechas de Seguimiento */}
                            <div className="space-y-2 font-display">
                              <span className="text-[11px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
                                {t('kanban.modal.datesTitle')}
                              </span>
                              <div className="space-y-1 text-xs text-[#1e1b4b]/80 dark:text-slate-200 font-sans">
                                <p className="flex justify-between sm:justify-start sm:gap-4">
                                  <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-medium">{t('kanban.modal.dateRegistered')}</span> 
                                  <span className="font-light">{new Date(offer.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
                                </p>
                                <p className="flex justify-between sm:justify-start sm:gap-4">
                                  <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-medium">{t('kanban.modal.dateUpdated')}</span> 
                                  <span className="font-light">{new Date(offer.updatedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
                                </p>
                                {offer.nextFollowupDate && (
                                  <p className="flex justify-between sm:justify-start sm:gap-4 text-[#8b5cf6] font-bold">
                                    <span className="text-[#1e1b4b]/40 dark:text-slate-500 font-medium">Seguimiento:</span> 
                                    <span>{new Date(offer.nextFollowupDate).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Enlace original */}
                            <div className="space-y-2 font-display">
                              <span className="text-[11px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 stroke-[1.75]" />
                                {t('kanban.modal.linkField')}
                              </span>
                              <div>
                                {offer.url ? (
                                  <a
                                    href={offer.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-[#8b5cf6] dark:text-violet-400 hover:text-[#8b5cf6]/90 dark:hover:text-violet-300 font-semibold bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 px-3 py-1.5 rounded-[8px] hover:bg-[#8b5cf6]/15 transition-all"
                                  >
                                    {t('kanban.modal.linkCvOfficial')}
                                    <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
                                  </a>
                                ) : (
                                  <span className="text-xs text-[#1e1b4b]/40 dark:text-slate-550 font-light italic font-sans">{t('kanban.modal.noLinkProvided')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* CV Vinculado y Selector */}
                          <div className="bg-[#fafafa] dark:bg-[#0b0f19]/35 border border-[#1e1b4b]/5 dark:border-white/5 p-4 rounded-[12px] space-y-3.5 font-display">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                                  {t('kanban.modal.cvLinkedTitle')}
                                </h4>
                                <p className="text-[11px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                                  {t('kanban.modal.cvLinkedDesc')}
                                </p>
                              </div>

                              {/* Selector rápido */}
                              <div className="bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 p-2 rounded-[8px] flex items-center gap-2 max-w-xs shrink-0">
                                <Link2 className="w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-550 stroke-[1.75]" />
                                <select
                                  value={selectedCv}
                                  onChange={handleCvChange}
                                  disabled={loading}
                                  className="bg-transparent text-[11px] text-[#1e1b4b] dark:text-slate-300 font-medium focus:outline-none cursor-pointer pr-4 font-sans"
                                >
                                  <option value="" className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b]/40 dark:text-slate-550">{t('kanban.modal.noCvLinked')}</option>
                                  {userCvs.map((cv) => (
                                    <option key={cv.id} value={cv.id} className="bg-white dark:bg-[#0b0f19] text-[#1e1b4b] dark:text-slate-300">
                                      {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Si hay un CV enlazado, dar un botón premium para ir a verlo/editarlo */}
                            {offer.cvId && (
                              <div className="border-t border-[#1e1b4b]/5 dark:border-white/5 pt-3 flex justify-end">
                                <a
                                  href={`/editor/${offer.cvId}`}
                                  className="text-xs font-bold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 px-4 py-2 rounded-[8px] shadow-sm transition-all flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                                  {t('kanban.modal.viewCvBtn')}
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Descripción Completa */}
                          <div className="space-y-2 font-display">
                            <h4 className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-550 stroke-[1.75]" />
                              {t('kanban.modal.descFieldRequired')}
                            </h4>
                            {offer.description ? (
                              <div className="bg-white dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-[12px] max-h-[220px] overflow-y-auto scrollbar-custom text-[#1e1b4b]/80 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed font-sans font-light">
                                {offer.description}
                              </div>
                            ) : (
                              <div className="bg-white dark:bg-[#0b0f19]/25 border border-dashed border-[#1e1b4b]/10 dark:border-white/10 p-6 rounded-[12px] text-center text-[#1e1b4b]/40 dark:text-slate-500 italic text-xs font-sans">
                                {t('kanban.modal.noDescText')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PESTAÑA: EVALUACIÓN IA */}
                      {activeTab === 'ai_eval' && (
                        <div className="space-y-5 animate-fadeIn font-display max-h-[50vh] overflow-y-auto pr-1 scrollbar-custom">
                          {/* Fila de Score y Datos Clave */}
                          <div className="flex flex-col sm:flex-row gap-6 bg-[#fafafa] dark:bg-[#0b0f19]/35 border border-[#1e1b4b]/5 dark:border-white/5 p-4.5 rounded-2xl">
                            {/* Compatibility Score Radial Indicator */}
                            <div className="flex flex-col items-center justify-center shrink-0 w-full sm:w-32 text-center my-auto">
                              <span className="text-[9px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider mb-2">
                                {t('kanban.modal.aiScoreTitle')}
                              </span>
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
                                      (offer.scoreOverall ?? 0) >= 4.0
                                        ? 'stroke-emerald-500'
                                        : (offer.scoreOverall ?? 0) >= 3.0
                                        ? 'stroke-[#8b5cf6]'
                                        : 'stroke-rose-500'
                                    }`}
                                    strokeWidth="6"
                                    strokeDasharray={2 * Math.PI * 34}
                                    strokeDashoffset={2 * Math.PI * 34 - ((offer.scoreOverall ?? 0) / 5) * (2 * Math.PI * 34)}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute flex flex-col items-center">
                                  <span className="text-xl font-black text-[#1e1b4b] dark:text-white leading-none">
                                    {offer.scoreOverall ? offer.scoreOverall.toFixed(1) : '0.0'}
                                  </span>
                                  <span className="text-[8px] font-bold text-[#1e1b4b]/30 dark:text-slate-550 uppercase mt-0.5">
                                    de 5
                                  </span>
                                </div>
                              </div>
                              <p className="text-[9px] text-[#1e1b4b]/50 dark:text-slate-400 leading-tight mt-2.5 font-sans max-w-[110px] italic">
                                {t('kanban.modal.aiScoreHelp')}
                              </p>
                            </div>

                            {/* Breakdown bars */}
                            <div className="flex-1 space-y-3">
                              <h4 className="text-[10px] font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-[#1e1b4b]/5 pb-1">
                                <TrendingUp className="w-3.5 h-3.5 text-[#8b5cf6] stroke-[1.75]" />
                                {t('kanban.modal.aiBreakdownTitle')}
                              </h4>

                              {(() => {
                                const breakdown = getParsedJson(offer.scoreBreakdown) || {};
                                const entries = Object.entries(breakdown);

                                if (entries.length === 0) {
                                  return (
                                    <div className="text-xs font-light text-[#1e1b4b]/40 dark:text-slate-550 italic font-sans py-1">
                                      Sin desglose detallado de puntuación.
                                    </div>
                                  );
                                }

                                return (
                                  <div className="space-y-2.5 max-h-[140px] overflow-y-auto scrollbar-custom pr-1">
                                    {entries.map(([label, value]: [string, any]) => {
                                      const valNum = parseFloat(value);
                                      const barPercentage = Math.round((valNum / 5) * 100);
                                      
                                      return (
                                        <div key={label} className="space-y-0.5 font-sans">
                                          <div className="flex justify-between items-center text-[11px]">
                                            <span className="font-semibold text-[#1e1b4b]/80 dark:text-slate-350 capitalize text-[10px]">
                                              {label.replace(/_/g, ' ')}
                                            </span>
                                            <span className="font-bold text-[#1e1b4b] dark:text-white text-[10px]">
                                              {valNum.toFixed(1)}/5
                                            </span>
                                          </div>
                                          <div className="w-full bg-[#1e1b4b]/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                                            <div
                                              style={{ width: `${barPercentage}%` }}
                                              className={`h-full rounded-full transition-all duration-1000 ${
                                                valNum >= 4.0
                                                  ? 'bg-emerald-500'
                                                  : valNum >= 3.0
                                                  ? 'bg-[#8b5cf6]'
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
                                <div className="pt-2 border-t border-[#1e1b4b]/5 dark:border-white/5 flex items-center justify-between text-[11px] font-sans">
                                  <span className="font-semibold text-[#1e1b4b]/50 dark:text-slate-500">
                                    {t('kanban.modal.aiLegitimacyTitle')}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 border border-[#8b5cf6]/20 font-bold text-[9px] uppercase">
                                    🛡️ {offer.legitimacyTier}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* TL;DR Highlight quote block */}
                          {offer.tldr && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6] stroke-[1.75]" />
                                {t('kanban.modal.aiTldrTitle')}
                              </span>
                              <div className="relative bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-xl p-3.5 pl-6">
                                <div className="absolute top-1 left-2 text-[#8b5cf6]/25 font-serif text-3xl leading-none">“</div>
                                <p className="text-[11px] font-sans font-medium text-[#1e1b4b] dark:text-slate-200 italic leading-relaxed pl-0.5">
                                  {offer.tldr}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Red Flags array */}
                          <div className="space-y-1.5">
                            <h5 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 stroke-[1.75]" />
                              {t('kanban.modal.aiRedFlagsTitle')}
                            </h5>
                            {(() => {
                              const flags = getParsedJson(offer.redFlags);
                              const hasFlags = Array.isArray(flags) && flags.length > 0;

                              if (!hasFlags) {
                                return (
                                  <div className="flex items-center gap-2 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 font-sans">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[1.75]" />
                                    <span className="text-[11px]">{t('kanban.modal.starNoRedFlags')}</span>
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {flags.map((flag: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 dark:border-rose-500/20 px-3 py-2 rounded-xl text-[11px] font-medium text-rose-600 dark:text-rose-400 font-sans leading-snug">
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 stroke-[1.75] mt-0.5" />
                                      <span>{flag}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Proof points suggested to emphasize */}
                          {!!offer.targetProofPoints && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Bookmark className="w-3.5 h-3.5 text-violet-500 stroke-[1.75]" />
                                {t('kanban.modal.aiProofPointsTitle')}
                              </span>
                              <div className="bg-[#fafafa] dark:bg-[#0b0f19]/35 border border-[#1e1b4b]/5 dark:border-white/5 p-3 rounded-xl font-sans">
                                <ul className="space-y-2">
                                  {(() => {
                                    const points = getParsedJson(offer.targetProofPoints);
                                    if (Array.isArray(points)) {
                                      return points.map((pt: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-1.5 text-xs text-[#1e1b4b]/80 dark:text-slate-350 leading-relaxed">
                                          <Sparkles className="w-3 h-3 text-[#8b5cf6] shrink-0 mt-0.5 stroke-[1.75]" />
                                          <span>{pt}</span>
                                        </li>
                                      ));
                                    }
                                    return <p className="text-xs italic text-[#1e1b4b]/45">{JSON.stringify(points)}</p>;
                                  })()}
                                </ul>
                              </div>
                            </div>
                          )}

                          {/* Raw markdown report viewer */}
                          {offer.rawReport && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-[#1e1b4b]/40 dark:text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
                                {t('kanban.modal.aiReportTitle')}
                              </span>
                              <div 
                                className="bg-white dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 p-4.5 rounded-xl max-h-[300px] overflow-y-auto scrollbar-custom font-sans font-light text-left leading-relaxed space-y-2.5"
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
                                <span className="text-[10px] font-bold text-[#1e1b4b]/40 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                  <Send className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
                                  {t('kanban.modal.outreachMessageTitle')}
                                </span>
                                
                                <button
                                  type="button"
                                  onClick={() => handleCopy(offer.outreachMessage!, 'outreach')}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-[#1e1b4b]/10 dark:border-white/10 bg-[#fafafa] dark:bg-[#0b0f19] hover:bg-slate-100 dark:hover:bg-[#0b0f19]/90 text-[#1e1b4b] dark:text-white"
                                >
                                  {copiedField === 'outreach' ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500">{t('kanban.modal.outreachCopied')}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400" />
                                      <span>{t('kanban.modal.outreachCopyBtn')}</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 p-3.5 rounded-xl text-xs text-[#1e1b4b]/80 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans font-light select-all">
                                {offer.outreachMessage}
                              </div>
                            </div>
                          )}

                          {/* Cover Letter letterbox */}
                          {offer.coverLetter && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-[#1e1b4b]/40 dark:text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
                                  {t('kanban.modal.outreachCoverLetterTitle')}
                                </span>
                                
                                <button
                                  type="button"
                                  onClick={() => handleCopy(offer.coverLetter!, 'cover_letter')}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-[#1e1b4b]/10 dark:border-white/10 bg-[#fafafa] dark:bg-[#0b0f19] hover:bg-slate-100 dark:hover:bg-[#0b0f19]/90 text-[#1e1b4b] dark:text-white"
                                >
                                  {copiedField === 'cover_letter' ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500">{t('kanban.modal.outreachCopied')}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-[#1e1b4b]/50 dark:text-slate-400" />
                                      <span>{t('kanban.modal.outreachCopyBtn')}</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-xl text-xs text-[#1e1b4b]/80 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans font-light select-all max-h-[250px] overflow-y-auto scrollbar-custom">
                                {offer.coverLetter}
                              </div>
                            </div>
                          )}

                          {!offer.outreachMessage && !offer.coverLetter && (
                            <div className="bg-[#fafafa] dark:bg-[#0b0f19]/25 border border-dashed border-[#1e1b4b]/10 dark:border-white/10 p-6 rounded-xl text-center text-[#1e1b4b]/40 dark:text-slate-500 italic text-[11px] font-sans">
                              No se encontraron recursos de contacto para esta postulación.
                            </div>
                          )}
                        </div>
                      )}

                      {/* PESTAÑA: HISTORIAS STAR */}
                      {activeTab === 'star_stories' && (
                        <div className="space-y-4 animate-fadeIn font-display max-h-[50vh] overflow-y-auto pr-1 scrollbar-custom">
                          <div>
                            <h4 className="text-[11px] font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              <PartyPopper className="w-3.5 h-3.5 text-[#8b5cf6] stroke-[1.75]" />
                              {t('kanban.modal.starStoriesTitle')}
                            </h4>
                            <p className="text-[10px] text-[#1e1b4b]/60 dark:text-slate-400 font-sans mt-0.5 leading-snug">
                              {t('kanban.modal.starStoriesDesc')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            {(() => {
                              const stories = getParsedJson(offer.interviewStories);
                              const hasStories = Array.isArray(stories) && stories.length > 0;

                              if (!hasStories) {
                                return (
                                  <div className="bg-[#fafafa] dark:bg-[#0b0f19]/25 border border-dashed border-[#1e1b4b]/10 dark:border-white/10 p-6 rounded-xl text-center text-[#1e1b4b]/40 dark:text-slate-500 italic text-xs font-sans">
                                    {t('kanban.modal.starNoStories')}
                                  </div>
                                );
                              }

                              return stories.map((story: any, idx: number) => {
                                const isExpanded = expandedStory === idx;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-[#fafafa] dark:bg-[#0b0f19]/30 border border-[#1e1b4b]/10 dark:border-white/5 rounded-xl overflow-hidden transition-all duration-350"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setExpandedStory(isExpanded ? null : idx)}
                                      className="w-full flex items-center justify-between p-3.5 text-left font-sans select-none hover:bg-slate-100/50 dark:hover:bg-slate-800/10 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 pr-4">
                                        <span className="flex items-center justify-center w-4.5 h-4.5 bg-[#8b5cf6]/10 text-[#8b5cf6] dark:text-violet-400 rounded-full text-[9px] font-bold">
                                          {idx + 1}
                                        </span>
                                        <span className="text-[11px] font-semibold text-[#1e1b4b] dark:text-slate-200 leading-tight">
                                          {story.title || `Historia #${idx + 1}`}
                                        </span>
                                      </div>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-500 shrink-0 stroke-[1.75]" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5 text-[#1e1b4b]/40 dark:text-slate-500 shrink-0 stroke-[1.75]" />
                                      )}
                                    </button>

                                    {isExpanded && (
                                      <div className="p-3.5 border-t border-[#1e1b4b]/5 dark:border-white/5 bg-white/40 dark:bg-black/10 space-y-2.5 text-[10px] font-sans">
                                        {story.situation && (
                                          <div className="space-y-0.5 leading-relaxed">
                                            <strong className="text-[9px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                                              📍 {t('kanban.modal.starStoryAccordionSituation')}
                                            </strong>
                                            <p className="text-[#1e1b4b]/80 dark:text-slate-350 font-light pl-2.5 border-l border-[#1e1b4b]/10 dark:border-white/10">
                                              {story.situation}
                                            </p>
                                          </div>
                                        )}

                                        {story.task && (
                                          <div className="space-y-0.5 leading-relaxed">
                                            <strong className="text-[9px] uppercase font-bold text-[#8b5cf6] dark:text-violet-400">
                                              🎯 {t('kanban.modal.starStoryAccordionTask')}
                                            </strong>
                                            <p className="text-[#1e1b4b]/80 dark:text-slate-350 font-light pl-2.5 border-l border-[#1e1b4b]/10 dark:border-white/10">
                                              {story.task}
                                            </p>
                                          </div>
                                        )}

                                        {story.action && (
                                          <div className="space-y-0.5 leading-relaxed">
                                            <strong className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400">
                                              ⚡ {t('kanban.modal.starStoryAccordionAction')}
                                            </strong>
                                            <p className="text-[#1e1b4b]/80 dark:text-slate-350 font-light pl-2.5 border-l border-[#1e1b4b]/10 dark:border-white/10">
                                              {story.action}
                                            </p>
                                          </div>
                                        )}

                                        {story.result && (
                                          <div className="space-y-0.5 leading-relaxed">
                                            <strong className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                                              🏆 {t('kanban.modal.starStoryAccordionResult')}
                                            </strong>
                                            <p className="text-[#1e1b4b]/80 dark:text-slate-350 font-light pl-2.5 border-l border-[#1e1b4b]/10 dark:border-white/10">
                                              {story.result}
                                            </p>
                                          </div>
                                        )}

                                        {story.relevance && (
                                          <div className="space-y-0.5 leading-relaxed">
                                            <strong className="text-[9px] uppercase font-bold text-pink-600 dark:text-pink-400">
                                              💫 {t('kanban.modal.starStoryAccordionRelevance')}
                                            </strong>
                                            <p className="text-[#1e1b4b]/80 dark:text-slate-350 font-light pl-2.5 border-l border-[#1e1b4b]/10 dark:border-white/10 italic">
                                              {story.relevance}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Acciones del footer de Pestañas */}
                    <div className="flex justify-between items-center pt-3 border-t border-[#1e1b4b]/10 dark:border-white/5 font-display mt-auto">
                      <span className="text-[9px] text-[#1e1b4b]/40 dark:text-slate-550 italic font-light font-sans">
                        ID: {offer.id}
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-4.5 py-2 rounded-[8px] bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#1e1b4b]/20 dark:hover:border-white/20 text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white font-bold text-xs transition-all shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                        {t('kanban.modal.editBtn')}
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
                <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4.5 h-4.5 text-[#8b5cf6] dark:text-violet-400 stroke-[1.75]" />
                  {t('kanban.modal.editTitle')}
                </h3>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                  {t('kanban.modal.editDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    {t('kanban.modal.jobField')}
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder={t('kanban.modal.jobPlaceholder')}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6] transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    {t('kanban.modal.companyField')}
                  </label>
                  <input
                    type="text"
                    name="company"
                    required
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder={t('kanban.modal.companyPlaceholder')}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6] transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#1e1b4b]/50 dark:text-slate-400 stroke-[1.75]" />
                    {t('kanban.modal.linkField')}
                  </label>
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6] transition-all font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200">{t('kanban.modal.platformField')}</label>
                  <select
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] transition-all cursor-pointer font-sans"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="infojobs">InfoJobs</option>
                    <option value="indeed">Indeed</option>
                    <option value="other">{t('kanban.modal.platformOther')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1e1b4b]/80 dark:text-slate-200">
                  {t('kanban.modal.descFieldRequired')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={8}
                  placeholder={t('kanban.modal.descPlaceholder')}
                  className="w-full bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] dark:focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6] transition-all resize-y font-sans font-light"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="px-4 py-2.5 text-sm font-semibold text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 dark:bg-white dark:hover:bg-slate-100 dark:text-[#0b0f19] rounded-[8px] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('kanban.modal.savingBtn')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 stroke-[1.75]" />
                      {t('kanban.modal.saveChangesBtn')}
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
