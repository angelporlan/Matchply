"use client";

import React, { useState } from 'react';
import { User, Briefcase, Building, MapPin, DollarSign, SlidersHorizontal, Sparkles, Check, AlertCircle, Save, Layers } from 'lucide-react';
import { saveUserCareerProfileAction } from '@/app/dashboard/actions';

interface CareerProfileFormProps {
  initialProfile?: {
    bio?: string;
    experienceYears?: number;
    targetRoles?: string[];
    preferredWorkplaces?: string[];
    preferredLocations?: string;
    companyPreferences?: string;
    salaryMin?: number;
    salaryTarget?: number;
    curationCriteria?: string;
    additionalNotes?: string;
  };
}

export default function CareerProfileForm({ initialProfile }: CareerProfileFormProps) {
  const [bio, setBio] = useState(initialProfile?.bio || initialProfile?.additionalNotes || '');
  const [experienceYears, setExperienceYears] = useState<number | ''>(initialProfile?.experienceYears ?? 3);
  const [targetRolesText, setTargetRolesText] = useState(
    Array.isArray(initialProfile?.targetRoles) ? initialProfile.targetRoles.join(', ') : ''
  );
  const [preferredWorkplaces, setPreferredWorkplaces] = useState<string[]>(
    initialProfile?.preferredWorkplaces || ['remote', 'hybrid']
  );
  const [preferredLocations, setPreferredLocations] = useState(
    initialProfile?.preferredLocations || 'Madrid, España Remoto'
  );
  const [companyPreferences, setCompanyPreferences] = useState(
    initialProfile?.companyPreferences || 'Startups de producto o scale-ups; evitar consultoría masiva'
  );
  const [salaryMin, setSalaryMin] = useState<number | ''>(initialProfile?.salaryMin || 35000);
  const [salaryTarget, setSalaryTarget] = useState<number | ''>(initialProfile?.salaryTarget || 45000);
  const [curationCriteria, setCurationCriteria] = useState(
    initialProfile?.curationCriteria || 
    'Prioriza ofertas con stack moderno (TypeScript, React/Next.js, Node.js, Python, IA). Si una oferta exige más años de experiencia pero el stack encaja al 100%, mantenla. Penaliza tecnologías obsoletas o presencial fuera de Madrid.'
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleWorkplace = (type: string) => {
    if (preferredWorkplaces.includes(type)) {
      if (preferredWorkplaces.length > 1) {
        setPreferredWorkplaces(preferredWorkplaces.filter(w => w !== type));
      }
    } else {
      setPreferredWorkplaces([...preferredWorkplaces, type]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const targetRoles = targetRolesText
        .split(',')
        .map(r => r.trim())
        .filter(Boolean);

      const payload = {
        bio,
        experienceYears: experienceYears === '' ? null : Number(experienceYears),
        targetRoles,
        preferredWorkplaces,
        preferredLocations,
        companyPreferences,
        salaryMin: salaryMin === '' ? null : Number(salaryMin),
        salaryTarget: salaryTarget === '' ? null : Number(salaryTarget),
        curationCriteria,
        additionalNotes: bio, // compatibilidad con mcpProfile
      };

      const res = await saveUserCareerProfileAction(payload);
      if (res.error) {
        throw new Error(res.error);
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message || "Error al guardar el perfil profesional.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Banner de Estado */}
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
            <span>¡Perfil y criterios de IA guardados con éxito! La curación de ofertas usará esta información como fuente de la verdad.</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* BLOQUE 1: TRAYECTORIA Y HABILIDADES PROFESIONALES */}
      <div className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
          <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center">
            <Briefcase className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
              1. Tu Trayectoria & Habilidades (Fuente de la Verdad)
            </h2>
            <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
              Describe todo tu contexto profesional, tecnologías dominadas y experiencia para que la IA sepa exactamente quién eres.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
            Biografía Técnica, Experiencia & Stack Completo
          </label>
          <textarea
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ej: Desarrollador Full Stack con 3+ años de experiencia. Especializado en TypeScript, React, Next.js, Node.js, PostgreSQL y Tailwind CSS. He construido arquitecturas SaaS completas, sistemas de suscripciones con Stripe y APIs con IA. Background sólido en optimización de rendimiento y bases de datos relacionales..."
            className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all font-sans leading-relaxed resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
              Roles y Títulos Objetivo (separados por coma)
            </label>
            <input
              type="text"
              value={targetRolesText}
              onChange={(e) => setTargetRolesText(e.target.value)}
              placeholder="Full Stack Engineer, Backend Developer, AI Engineer"
              className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
              Años de Experiencia Real
            </label>
            <input
              type="number"
              min={0}
              max={40}
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="3"
              className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all"
            />
          </div>
        </div>
      </div>

      {/* BLOQUE 2: PREFERENCIAS DE EMPLEO */}
      <div className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Building className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
              2. Preferencias de Empresa, Modalidad y Salario
            </h2>
            <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
              Define en qué tipo de organizaciones quieres trabajar y bajo qué condiciones.
            </p>
          </div>
        </div>

        {/* Modalidad de trabajo */}
        <div>
          <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-2 font-display">
            Modalidad de Trabajo Aceptada
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'remote', label: '100% Remoto' },
              { id: 'hybrid', label: 'Híbrido' },
              { id: 'onsite', label: 'Presencial' },
            ].map((item) => {
              const active = preferredWorkplaces.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleWorkplace(item.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    active
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 shadow-xs'
                      : 'bg-[#fafafa] dark:bg-[#0b0f19] text-slate-500 border-[#1e1b4b]/10 dark:border-white/10 hover:border-slate-300'
                  }`}
                >
                  {active && <Check className="w-3 h-3 inline mr-1 stroke-[2.5]" />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
              Ubicación Geográfica Preferida
            </label>
            <input
              type="text"
              value={preferredLocations}
              onChange={(e) => setPreferredLocations(e.target.value)}
              placeholder="Madrid, España Remoto, Unión Europea"
              className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
              Tipo de Empresa Deseada
            </label>
            <input
              type="text"
              value={companyPreferences}
              onChange={(e) => setCompanyPreferences(e.target.value)}
              placeholder="Startups de producto o scale-ups; no consultoras masivas"
              className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all"
            />
          </div>
        </div>

        {/* Salario */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
              Salario Mínimo (€/año)
            </label>
            <input
              type="number"
              step={1000}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="35000"
              className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
              Salario Deseado / Target (€/año)
            </label>
            <input
              type="number"
              step={1000}
              value={salaryTarget}
              onChange={(e) => setSalaryTarget(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="45000"
              className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all"
            />
          </div>
        </div>
      </div>

      {/* BLOQUE 3: CRITERIOS Y REGLAS DE PUNTUACIÓN DE IA */}
      <div className="bg-white dark:bg-[#111827] border border-[#8b5cf6]/25 rounded-2xl p-6 shadow-md shadow-[#8b5cf6]/5 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8b5cf6] to-[#7c3aed] text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display flex items-center gap-2">
              3. Reglas de Puntuación & Curación de la IA
            </h2>
            <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
              Instrucciones específicas para que la IA filtre, pondere y justifique el Match Score de cada oferta.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
            Directrices para la IA al Curar y Descartar Ofertas
          </label>
          <textarea
            rows={4}
            value={curationCriteria}
            onChange={(e) => setCurationCriteria(e.target.value)}
            placeholder="Ej: Prioriza ofertas con stack moderno en TypeScript, React y Node.js. Si una oferta pide 5 años pero coincide con mi stack tecnológico, mantenla si es remota o startup. Penaliza ofertas con tecnologías legadas (ej. PHP clásico o Java viejo) o presenciales fuera de Madrid."
            className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all font-sans leading-relaxed resize-y"
          />
        </div>
      </div>

      {/* Botón de Guardado */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#2ECC71] hover:bg-[#27AE60] text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-98"
        >
          <Save className="w-4 h-4 stroke-[2]" />
          <span>{saving ? 'Guardando…' : 'Guardar Perfil & Criterios'}</span>
        </button>
      </div>
    </form>
  );
}
