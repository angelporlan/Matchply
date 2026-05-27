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
  Edit3, Save, Loader2, Sparkles, Clock, Archive
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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
          style: 'text-indigo-650 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
          icon: <Bookmark className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'applied':
        return {
          title: t('kanban.columns.applied.title'),
          style: 'text-blue-650 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
          icon: <Send className="w-3.5 h-3.5 stroke-[1.75]" />,
        };
      case 'interview':
        return {
          title: t('kanban.columns.interview.title'),
          style: 'text-amber-650 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
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
          style: 'text-rose-600 dark:text-rose-455 bg-rose-500/10 border-rose-500/20',
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
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-455 text-xs rounded-[8px] font-medium pr-12 md:pr-16 font-sans">
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
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-bold text-[#1e1b4b] dark:text-white tracking-tight font-display flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#8b5cf6] dark:text-violet-400 shrink-0 stroke-[1.75]" />
                    {offer.title}
                  </h3>
                  <p className="text-[#1e1b4b]/70 dark:text-slate-300 text-sm font-semibold flex items-center gap-1.5 font-display">
                    <Building2 className="w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-500 shrink-0 stroke-[1.75]" />
                    {offer.company}
                  </p>
                </div>
              </div>

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
                      <span className="text-xs text-[#1e1b4b]/40 dark:text-slate-500 font-light italic font-sans">{t('kanban.modal.noLinkProvided')}</span>
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

              {/* Acciones del footer */}
              <div className="flex justify-between items-center pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5 font-display">
                <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 italic font-light font-sans">
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
