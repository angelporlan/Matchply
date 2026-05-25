"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { JobOffer, CV } from '@/db/schema';
import { 
  updateJobOfferDetails, 
  updateJobOfferCv,
  updateJobOfferStatus 
} from '@/app/dashboard/kanban/actions';
import { 
  X, ExternalLink, Calendar, Briefcase, Building2, Link2, 
  FileText, CheckCircle2, Bookmark, Send, PartyPopper, Ban, 
  Edit3, Save, Loader2, Sparkles, Clock 
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
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

  if (!isOpen) return null;

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
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          glow: 'bg-blue-500/5',
        };
      case 'infojobs':
        return {
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          glow: 'bg-orange-500/5',
        };
      case 'indeed':
        return {
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          glow: 'bg-sky-500/5',
        };
      default:
        return {
          badge: 'bg-slate-800 text-slate-400 border-slate-700',
          glow: 'bg-indigo-500/5',
        };
    }
  };

  const platformStyle = getPlatformStyle(offer.platform);

  // Obtener estilo e icono del estado
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'interested':
        return {
          title: 'Interesado',
          style: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
          icon: <Bookmark className="w-3.5 h-3.5" />,
        };
      case 'applied':
        return {
          title: 'Postulado',
          style: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          icon: <Send className="w-3.5 h-3.5" />,
        };
      case 'interview':
        return {
          title: 'Entrevista',
          style: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Calendar className="w-3.5 h-3.5" />,
        };
      case 'offer':
        return {
          title: 'Ofrecido',
          style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: <PartyPopper className="w-3.5 h-3.5" />,
        };
      case 'rejected':
        return {
          title: 'Rechazado',
          style: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: <Ban className="w-3.5 h-3.5" />,
        };
      default:
        return {
          title: status,
          style: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
          icon: <Briefcase className="w-3.5 h-3.5" />,
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
      setError(result.error || "Error al actualizar el CV");
    }
    setLoading(false);
  };

  // Guardar cambios en edición
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.company) {
      setError('El puesto y la empresa son campos obligatorios.');
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

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-[#070b17] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 transform scale-100 max-h-[90vh] flex flex-col"
      >
        {/* Glow effects de fondo */}
        <div className={`absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full filter blur-[80px] pointer-events-none ${platformStyle.glow}`} />
        <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-indigo-500/5 rounded-full filter blur-[60px] pointer-events-none" />

        {/* Botón de cierre */}
        {!loading && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-900/60 border border-transparent hover:border-slate-800/60 transition-all z-10"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* CONTENIDO DEL MODAL (Scrolleable si es necesario) */}
        <div className="flex-1 overflow-y-auto scrollbar-custom pr-2 space-y-6 relative z-10">
          
          {/* Alerta de Error */}
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {!isEditing ? (
            /* ================= MODO VISTA ================= */
            <>
              {/* Header */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${platformStyle.badge}`}>
                    {offer.platform}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${statusConfig.style}`}>
                    {statusConfig.icon}
                    {statusConfig.title}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight Outfit font-display flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-sky-400 shrink-0" />
                    {offer.title}
                  </h3>
                  <p className="text-slate-350 text-sm font-semibold flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    {offer.company}
                  </p>
                </div>
              </div>

              {/* Grid de Información Secundaría */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-b border-slate-900/80 py-4">
                
                {/* Fechas de Seguimiento */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Fechas de Candidatura
                  </span>
                  <div className="space-y-1 text-xs text-slate-300">
                    <p className="flex justify-between sm:justify-start sm:gap-4">
                      <span className="text-slate-500 font-medium">Registrado:</span> 
                      <span className="font-light">{formatDate(offer.createdAt)}</span>
                    </p>
                    <p className="flex justify-between sm:justify-start sm:gap-4">
                      <span className="text-slate-500 font-medium">Actualizado:</span> 
                      <span className="font-light">{formatDate(offer.updatedAt)}</span>
                    </p>
                  </div>
                </div>

                {/* Enlace original */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Oferta Original
                  </span>
                  <div>
                    {offer.url ? (
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-xl hover:bg-sky-500/15 transition-all"
                      >
                        Ir al sitio web oficial
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 font-light italic">No se proporcionó enlace</span>
                    )}
                  </div>
                </div>
              </div>

              {/* CV Vinculado y Selector */}
              <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-2xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-purple-400" />
                      Currículum Vinculado
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Asigna o cambia el CV optimizado para esta postulación específica.
                    </p>
                  </div>

                  {/* Selector rápido */}
                  <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-xl flex items-center gap-2 max-w-xs shrink-0">
                    <Link2 className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={selectedCv}
                      onChange={handleCvChange}
                      disabled={loading}
                      className="bg-transparent text-[11px] text-slate-300 font-medium focus:outline-none cursor-pointer pr-4"
                    >
                      <option value="" className="bg-[#030712] text-slate-500">Sin CV Vinculado...</option>
                      {userCvs.map((cv) => (
                        <option key={cv.id} value={cv.id} className="bg-[#030712] text-slate-300">
                          {cv.title.length > 25 ? cv.title.substring(0, 25) + '...' : cv.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Si hay un CV enlazado, dar un botón premium para ir a verlo/editarlo */}
                {offer.cvId && (
                  <div className="border-t border-slate-900/60 pt-3 flex justify-end">
                    <a
                      href={`/editor/${offer.cvId}`}
                      className="text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-4 py-2 rounded-xl shadow-md hover:shadow-purple-500/10 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Editar / Ver CV Optimizado
                    </a>
                  </div>
                )}
              </div>

              {/* Descripción Completa */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Descripción / Requisitos de la Oferta
                </h4>
                {offer.description ? (
                  <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-2xl max-h-[300px] overflow-y-auto scrollbar-custom text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-sans font-light">
                    {offer.description}
                  </div>
                ) : (
                  <div className="bg-slate-950/20 border border-dashed border-slate-900 p-6 rounded-2xl text-center text-slate-550 italic text-xs">
                    No se ingresó descripción para esta candidatura. Puedes editarla para añadir los detalles.
                  </div>
                )}
              </div>

              {/* Acciones del footer */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-900/80">
                <span className="text-[10px] text-slate-550 italic font-light">
                  ID: {offer.id}
                </span>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-white font-semibold text-xs transition-all shadow-md"
                >
                  <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                  Editar Detalles
                </button>
              </div>
            </>
          ) : (
            /* ================= MODO EDICIÓN ================= */
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-sky-400" />
                  Editar Candidatura
                </h3>
                <p className="text-xs text-slate-400">
                  Modifica los datos principales de la oferta laboral.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Puesto *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Ej. Senior React Developer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Empresa *
                  </label>
                  <input
                    type="text"
                    name="company"
                    required
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Ej. Stripe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-slate-400" />
                    Enlace de la Oferta
                  </label>
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Plataforma</label>
                  <select
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="infojobs">InfoJobs</option>
                    <option value="indeed">Indeed</option>
                    <option value="other">Otra</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Descripción / Requisitos de la Oferta
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={8}
                  placeholder="Pega aquí la descripción del puesto. El motor de IA comparará esta descripción con tu CV para optimizarlo."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-y font-sans font-light"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 rounded-xl hover:shadow-lg hover:shadow-sky-500/10 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
