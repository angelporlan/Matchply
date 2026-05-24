"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobOffer, CV } from '@/db/schema';
import KanbanCard from './KanbanCard';
import { createJobOffer } from '@/app/dashboard/kanban/actions';
import { Plus, X, Briefcase, Building2, Link, FileText, CheckCircle2, RefreshCw, Bookmark, Send, Calendar, PartyPopper, Ban } from 'lucide-react';

interface KanbanBoardProps {
  offers: JobOffer[];
  userCvs: CV[];
}

interface Column {
  id: 'interested' | 'applied' | 'interview' | 'offer' | 'rejected';
  title: string;
  color: string;
  borderColor: string;
  glowColor: string;
}

export default function KanbanBoard({ offers, userCvs }: KanbanBoardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    url: '',
    platform: 'linkedin',
    description: '',
  });

  const columns: Column[] = [
    { id: 'interested', title: 'Interesado', color: 'text-indigo-400 bg-indigo-500/10', borderColor: 'border-indigo-500/20', glowColor: 'rgba(99,102,241,0.15)' },
    { id: 'applied', title: 'Postulado', color: 'text-blue-400 bg-blue-500/10', borderColor: 'border-blue-500/20', glowColor: 'rgba(59,130,246,0.15)' },
    { id: 'interview', title: 'Entrevista', color: 'text-amber-400 bg-amber-500/10', borderColor: 'border-amber-500/20', glowColor: 'rgba(245,158,11,0.15)' },
    { id: 'offer', title: 'Ofrecido', color: 'text-emerald-400 bg-emerald-500/10', borderColor: 'border-emerald-500/20', glowColor: 'rgba(16,185,129,0.15)' },
    { id: 'rejected', title: 'Rechazado', color: 'text-rose-400 bg-rose-500/10', borderColor: 'border-rose-500/20', glowColor: 'rgba(244,63,94,0.15)' },
  ];

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-sky-400" />
            Embudo de Candidaturas
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Arrastra y gestiona tus ofertas de empleo y vincula tus currículums optimizados
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

      {/* Grid de Columnas (Kanban) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnOffers = offers.filter((offer) => offer.status === column.id);

          return (
            <div
              key={column.id}
              className="flex flex-col min-w-[280px] md:min-w-[240px] lg:min-w-[260px] xl:min-w-0 glass-card p-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 relative overflow-hidden"
              style={{
                boxShadow: `inset 0 0 20px ${column.glowColor}, 0 4px 30px rgba(0,0,0,0.4)`
              }}
            >
              {/* Cabecera de la columna */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${column.color}`}>
                    {column.id === 'interested' && <Bookmark className="w-3.5 h-3.5" />}
                    {column.id === 'applied' && <Send className="w-3.5 h-3.5" />}
                    {column.id === 'interview' && <Calendar className="w-3.5 h-3.5" />}
                    {column.id === 'offer' && <PartyPopper className="w-3.5 h-3.5" />}
                    {column.id === 'rejected' && <Ban className="w-3.5 h-3.5" />}
                    {column.title}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-850">
                  {columnOffers.length}
                </span>
              </div>

              {/* Lista de tarjetas */}
              <div className="flex flex-col gap-4 min-h-[450px]">
                {columnOffers.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-850 rounded-2xl p-6 text-center text-slate-600">
                    <CheckCircle2 className="w-6 h-6 mb-2 text-slate-700 opacity-60" />
                    <p className="text-[11px] font-medium uppercase tracking-wider">Vacío</p>
                  </div>
                ) : (
                  columnOffers.map((offer) => (
                    <KanbanCard
                      key={offer.id}
                      offer={offer}
                      userCvs={userCvs}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
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
    </div>
  );
}
