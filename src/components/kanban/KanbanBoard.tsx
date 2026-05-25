"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobOffer, CV } from '@/db/schema';
import KanbanCard from './KanbanCard';
import JobOfferDetailsModal from './JobOfferDetailsModal';
import { createJobOffer } from '@/app/dashboard/kanban/actions';
import { Plus, X, Briefcase, Building2, Link, FileText, CheckCircle2, RefreshCw, Bookmark, Send, Calendar, PartyPopper, Ban, Search, SlidersHorizontal, Minimize2, Maximize2, Link2, ListChecks } from 'lucide-react';

interface KanbanBoardProps {
  offers: JobOffer[];
  userCvs: CV[];
}

interface Column {
  id: 'interested' | 'applied' | 'interview' | 'offer' | 'rejected';
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  borderColor: string;
  glowColor: string;
}

export default function KanbanBoard({ offers, userCvs }: KanbanBoardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfferForDetails, setSelectedOfferForDetails] = useState<JobOffer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cvFilter, setCvFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable'>('compact');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    platform: 'linkedin',
    description: '',
  });

  const columns: Column[] = [
    { id: 'interested', title: 'Interesado', shortTitle: 'Interés', description: 'Por valorar', color: 'text-indigo-400 bg-indigo-500/10', borderColor: 'border-indigo-500/20', glowColor: 'rgba(99,102,241,0.15)' },
    { id: 'applied', title: 'Postulado', shortTitle: 'Postulado', description: 'Ya enviada', color: 'text-blue-400 bg-blue-500/10', borderColor: 'border-blue-500/20', glowColor: 'rgba(59,130,246,0.15)' },
    { id: 'interview', title: 'Entrevista', shortTitle: 'Entrevista', description: 'En conversación', color: 'text-amber-400 bg-amber-500/10', borderColor: 'border-amber-500/20', glowColor: 'rgba(245,158,11,0.15)' },
    { id: 'offer', title: 'Ofrecido', shortTitle: 'Oferta', description: 'Resultado positivo', color: 'text-emerald-400 bg-emerald-500/10', borderColor: 'border-emerald-500/20', glowColor: 'rgba(16,185,129,0.15)' },
    { id: 'rejected', title: 'Rechazado', shortTitle: 'Descartado', description: 'Cerradas', color: 'text-rose-400 bg-rose-500/10', borderColor: 'border-rose-500/20', glowColor: 'rgba(244,63,94,0.15)' },
  ];

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const linkedOffers = offers.filter((offer) => Boolean(offer.cvId)).length;
  const activeOffers = offers.filter((offer) => offer.status !== 'rejected').length;
  const filteredOffers = offers.filter((offer) => {
    const matchesSearch = !normalizedSearch || [offer.title, offer.company, offer.platform]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
    const matchesCvFilter =
      cvFilter === 'all' ||
      (cvFilter === 'linked' && Boolean(offer.cvId)) ||
      (cvFilter === 'unlinked' && !offer.cvId);

    return matchesSearch && matchesCvFilter;
  });
  const hasActiveFilters = Boolean(normalizedSearch) || cvFilter !== 'all';

  const renderColumnIcon = (columnId: Column['id']) => {
    switch (columnId) {
      case 'interested':
        return <Bookmark className="w-3.5 h-3.5" />;
      case 'applied':
        return <Send className="w-3.5 h-3.5" />;
      case 'interview':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'offer':
        return <PartyPopper className="w-3.5 h-3.5" />;
      case 'rejected':
        return <Ban className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.company) {
      setError('El puesto y la empresa son campos obligatorios.');
      return;
    }

    setLoading(true);
    const result = await createJobOffer(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsModalOpen(false);
      setFormData({
        title: '',
        company: '',
        url: '',
        platform: 'linkedin',
        description: '',
      });
      router.refresh();
    }
  };

  return (
    <div className="w-full">
      {/* Cabecera del Tablero */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-sky-400" />
            Embudo de Candidaturas
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Gestiona tus ofertas por etapa y encuentra rápido la candidatura que necesitas.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/15 hover:shadow-sky-500/25 transition-all duration-300 transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          Nueva Candidatura
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total</p>
          <p className="text-xl font-bold text-white mt-1">{offers.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Activas</p>
          <p className="text-xl font-bold text-sky-300 mt-1">{activeOffers}</p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Con CV</p>
          <p className="text-xl font-bold text-emerald-300 mt-1">{linkedOffers}</p>
        </div>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Mostrando</p>
          <p className="text-xl font-bold text-white mt-1">{filteredOffers.length}</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por puesto, empresa o plataforma"
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Limpiar búsqueda"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
            <SlidersHorizontal className="w-4 h-4 text-slate-500 ml-2 hidden sm:block" />
            {[
              { value: 'all', label: 'Todas' },
              { value: 'linked', label: 'Con CV' },
              { value: 'unlinked', label: 'Sin CV' },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCvFilter(filter.value as 'all' | 'linked' | 'unlinked')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  cvFilter === filter.value
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'compact'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Compacta
            </button>
            <button
              type="button"
              onClick={() => setViewMode('comfortable')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'comfortable'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Cómoda
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Columnas (Kanban) */}
      <div className="-mx-4 px-4 overflow-x-auto pb-4 scrollbar-custom">
        <div className="grid min-w-[1180px] grid-cols-5 gap-4 items-start">
          {columns.map((column) => {
            const rawColumnOffers = offers.filter((offer) => offer.status === column.id);
            const columnOffers = filteredOffers.filter((offer) => offer.status === column.id);

            return (
              <div
                key={column.id}
                aria-label={`Columna ${column.title}`}
                className={`flex h-[calc(100vh-330px)] min-h-[520px] max-h-[760px] flex-col glass-card rounded-2xl border ${column.borderColor} bg-slate-900/35 relative overflow-hidden`}
                style={{
                  boxShadow: `inset 0 0 20px ${column.glowColor}, 0 4px 30px rgba(0,0,0,0.35)`
                }}
              >
                {/* Cabecera de la columna */}
                <div className="shrink-0 p-3.5 pb-3 border-b border-slate-800/80 bg-slate-950/35 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${column.color}`}>
                        {renderColumnIcon(column.id)}
                        {column.shortTitle}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-2 truncate">{column.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        {hasActiveFilters && rawColumnOffers.length > 0 ? `${columnOffers.length}/${rawColumnOffers.length}` : rawColumnOffers.length}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        ofertas
                      </span>
                    </div>
                  </div>
                  {rawColumnOffers.length > 0 && (
                    <div className="mt-3 h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${column.color.split(' ')[1]}`}
                        style={{
                          width: `${Math.max(8, Math.round((columnOffers.length / rawColumnOffers.length) * 100))}%`,
                          opacity: hasActiveFilters ? 0.8 : 1,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Lista de tarjetas */}
                <div className={`flex-1 overflow-y-auto scrollbar-custom p-3 pr-2 ${viewMode === 'compact' ? 'space-y-2.5' : 'space-y-4'}`}>
                  {columnOffers.length === 0 ? (
                    <div className="h-full min-h-[260px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center text-slate-600">
                      {hasActiveFilters ? (
                        <>
                          <Search className="w-6 h-6 mb-2 text-slate-700 opacity-70" />
                          <p className="text-[11px] font-bold uppercase tracking-wider">Sin resultados</p>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-6 h-6 mb-2 text-slate-700 opacity-60" />
                          <p className="text-[11px] font-bold uppercase tracking-wider">Vacío</p>
                        </>
                      )}
                    </div>
                  ) : (
                    columnOffers.map((offer) => (
                      <KanbanCard
                        key={offer.id}
                        offer={offer}
                        userCvs={userCvs}
                        onOpenDetails={setSelectedOfferForDetails}
                        density={viewMode}
                      />
                    ))
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/35 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <ListChecks className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{columnOffers.length} visibles</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Link2 className="w-3.5 h-3.5" />
                      {columnOffers.filter((offer) => offer.cvId).length}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Premium para crear Candidatura */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity">
          <div className="relative w-full max-w-lg glass-card border border-slate-800 bg-[#070b17] rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
            
            {/* Adornos visuales */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-sky-400" />
                  Agregar Candidatura
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Registra los datos de la oferta. Luego podrás optimizar tu CV para este puesto.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
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
                    <Link className="w-3.5 h-3.5 text-slate-400" />
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
                  Descripción / Requisitos de la Oferta (Opcional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Pega aquí la descripción del puesto. El motor de IA comparará esta descripción con tu CV para optimizarlo y adaptarlo a la oferta."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Candidatura'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedOfferForDetails && (
        <JobOfferDetailsModal
          isOpen={!!selectedOfferForDetails}
          onClose={() => setSelectedOfferForDetails(null)}
          offer={offers.find(o => o.id === selectedOfferForDetails.id) || selectedOfferForDetails}
          userCvs={userCvs}
        />
      )}
    </div>
  );
}
