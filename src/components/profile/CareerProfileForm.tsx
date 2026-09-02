"use client";

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building,
  Check,
  ChevronDown,
  Save,
  Sparkles,
  Bot,
  Upload,
  Eye,
  Loader2,
} from 'lucide-react';
import { saveUserCareerProfileAction } from '@/app/dashboard/actions';
import {
  describeHardConstraintChips,
  parseHardConstraints,
} from '@/lib/curation-constraints';
import DictationTextarea from '@/components/profile/DictationTextarea';
import ProfileCompletenessBar from '@/components/profile/ProfileCompletenessBar';
import AiProfileInterviewModal from '@/components/profile/AiProfileInterviewModal';
import CvImportProfileModal from '@/components/profile/CvImportProfileModal';
import AiPreviewModal from '@/components/profile/AiPreviewModal';

interface KeyProject {
  title: string;
  role?: string;
  techStack?: string;
  description: string;
  impact?: string;
}

interface TechStackCategories {
  frontend?: string[];
  backend?: string[];
  ai_ml?: string[];
  cloud_devops?: string[];
  database?: string[];
}

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
    keyProjects?: KeyProject[];
    techStack?: TechStackCategories;
    targetTransition?: {
      targetRole?: string;
      targetIndustries?: string;
      targetGeography?: string;
    };
    masterDocument?: string;
    classification?: unknown;
    hardConstraints?: unknown;
  };
  userCvs?: Array<{
    id: string;
    title: string;
    isBase: boolean;
    isPrincipal: boolean;
    content: string;
  }>;
}

export default function CareerProfileForm({
  initialProfile,
  userCvs = [],
}: CareerProfileFormProps) {
  const [bio, setBio] = useState(initialProfile?.bio || initialProfile?.additionalNotes || '');
  const [optionalTarget, setOptionalTarget] = useState(
    initialProfile?.targetTransition?.targetRole || '',
  );
  const [masterDocument, setMasterDocument] = useState(initialProfile?.masterDocument || '');
  const [curationCriteria, setCurationCriteria] = useState(initialProfile?.curationCriteria || '');
  const [experienceYears, setExperienceYears] = useState<number | ''>(
    initialProfile?.experienceYears ?? '',
  );
  const [targetRolesText, setTargetRolesText] = useState(
    Array.isArray(initialProfile?.targetRoles) ? initialProfile.targetRoles.join(', ') : '',
  );
  const [preferredWorkplaces, setPreferredWorkplaces] = useState<string[]>(
    initialProfile?.preferredWorkplaces || [],
  );
  const [preferredLocations, setPreferredLocations] = useState(
    initialProfile?.preferredLocations || '',
  );
  const [companyPreferences, setCompanyPreferences] = useState(
    initialProfile?.companyPreferences || '',
  );
  const [salaryMin, setSalaryMin] = useState<number | ''>(initialProfile?.salaryMin ?? '');
  const [salaryTarget, setSalaryTarget] = useState<number | ''>(initialProfile?.salaryTarget ?? '');
  const [keyProjects, setKeyProjects] = useState<KeyProject[]>(
    Array.isArray(initialProfile?.keyProjects) ? initialProfile.keyProjects : [],
  );
  const [techStack, setTechStack] = useState<TechStackCategories>(
    initialProfile?.techStack || {},
  );
  const [classification, setClassification] = useState<any>(initialProfile?.classification || null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const constraintChips = useMemo(
    () => describeHardConstraintChips(parseHardConstraints({ curationCriteria })),
    [curationCriteria],
  );

  const targetRolesArray = useMemo(
    () => targetRolesText.split(',').map((role) => role.trim()).filter(Boolean),
    [targetRolesText],
  );

  const buildPayload = (overrides: Record<string, unknown> = {}) => ({
    bio,
    experienceYears: experienceYears === '' ? null : Number(experienceYears),
    targetRoles: targetRolesArray,
    preferredWorkplaces,
    preferredLocations,
    companyPreferences,
    salaryMin: salaryMin === '' ? null : Number(salaryMin),
    salaryTarget: salaryTarget === '' ? null : Number(salaryTarget),
    curationCriteria,
    additionalNotes: bio,
    keyProjects: keyProjects.filter((project) => project.title.trim() || project.description.trim()),
    techStack,
    targetTransition: {
      targetRole: optionalTarget || targetRolesArray[0] || '',
      targetIndustries: '',
      targetGeography: preferredLocations,
    },
    masterDocument,
    classification,
    ...overrides,
  });

  const persistProfile = async (overrides: Record<string, unknown> = {}) => {
    const payload = buildPayload(overrides);
    const res = await saveUserCareerProfileAction(payload);
    if (res.error) throw new Error(res.error);
    return payload;
  };

  const handleApplyEnrichedProfile = async (data: any) => {
    if (!data) return;
    if (data.bio) setBio(data.bio);
    if (data.masterDocument) setMasterDocument(data.masterDocument);
    if (data.curationCriteria) setCurationCriteria(data.curationCriteria);
    if (data.experienceYears !== undefined && data.experienceYears !== null) {
      setExperienceYears(data.experienceYears);
    }
    if (data.targetRoles && Array.isArray(data.targetRoles)) {
      setTargetRolesText(data.targetRoles.join(', '));
    }
    if (data.preferredWorkplaces && Array.isArray(data.preferredWorkplaces)) {
      setPreferredWorkplaces(data.preferredWorkplaces);
    }
    if (data.preferredLocations) setPreferredLocations(data.preferredLocations);
    if (data.companyPreferences) setCompanyPreferences(data.companyPreferences);
    if (typeof data.salaryMin === 'number') setSalaryMin(data.salaryMin);
    if (typeof data.salaryTarget === 'number') setSalaryTarget(data.salaryTarget);
    if (data.keyProjects && Array.isArray(data.keyProjects)) setKeyProjects(data.keyProjects);
    if (data.techStack && typeof data.techStack === 'object') setTechStack(data.techStack);
    if (data.classification) setClassification(data.classification);
    if (data.targetTransition?.targetRole) setOptionalTarget(data.targetTransition.targetRole);

    try {
      await persistProfile({
        bio: data.bio ?? bio,
        masterDocument: data.masterDocument ?? masterDocument,
        curationCriteria: data.curationCriteria ?? curationCriteria,
        experienceYears: data.experienceYears ?? (experienceYears === '' ? null : experienceYears),
        targetRoles: data.targetRoles ?? targetRolesArray,
        preferredWorkplaces: data.preferredWorkplaces ?? preferredWorkplaces,
        preferredLocations: data.preferredLocations ?? preferredLocations,
        companyPreferences: data.companyPreferences ?? companyPreferences,
        salaryMin: typeof data.salaryMin === 'number' ? data.salaryMin : (salaryMin === '' ? null : salaryMin),
        salaryTarget: typeof data.salaryTarget === 'number' ? data.salaryTarget : (salaryTarget === '' ? null : salaryTarget),
        keyProjects: data.keyProjects ?? keyProjects,
        techStack: data.techStack ?? techStack,
        classification: data.classification ?? classification,
        targetTransition: {
          targetRole: data.targetTransition?.targetRole || optionalTarget,
          targetIndustries: data.targetTransition?.targetIndustries || '',
          targetGeography: data.targetTransition?.targetGeography || preferredLocations,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Se aplicó el documento pero no se pudo guardar. Pulsa Guardar.');
    }
  };

  const toggleWorkplace = (type: string) => {
    if (preferredWorkplaces.includes(type)) {
      setPreferredWorkplaces(preferredWorkplaces.filter((item) => item !== type));
    } else {
      setPreferredWorkplaces([...preferredWorkplaces, type]);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);
    try {
      await persistProfile();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar el perfil profesional.');
    } finally {
      setSaving(false);
    }
  };

  const scrollToSection = (section: string) => {
    const el = document.getElementById(`section-${section}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <ProfileCompletenessBar
        dumpText={bio}
        masterDocument={masterDocument}
        curationCriteria={curationCriteria}
        onActionClick={scrollToSection}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111827] border border-[#8B5CF6]/20 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsInterviewOpen(true)}
            disabled={!bio.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7c3aed] text-white text-xs font-bold shadow-sm shadow-[#8B5CF6]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Bot className="w-4 h-4 stroke-[1.75]" />
            <span>Crear documento con IA</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8B5CF6] text-xs font-bold text-[#1e1b4b] dark:text-white flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#8B5CF6] stroke-[1.75]" />
            <span>Desde un CV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Cómo te ve la IA</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="px-6 py-2 rounded-xl bg-[#2ECC71] hover:bg-[#27AE60] text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer ml-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin stroke-[1.75]" /> : <Save className="w-4 h-4 stroke-[1.75]" />}
          <span>{saving ? 'Guardando…' : 'Guardar'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 stroke-[1.75]" />
          <span>Perfil guardado. La curación y la adaptación de CVs usarán este documento.</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div id="section-dump" className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
              <Briefcase className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                1. Pega tu experiencia
              </h2>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                CV, About de LinkedIn o notas. No hace falta decir a qué rol aspiras.
              </p>
            </div>
          </div>
          <DictationTextarea
            id="career-dump"
            label="Tu trayectoria, proyectos y tecnologías"
            value={bio}
            onChange={setBio}
            rows={8}
            placeholder="Pega aquí tu experiencia. Ejemplo: Full Stack con 3 años en TypeScript y Node, o un junior con prácticas en React..."
          />
          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
              Hacia dónde quieres ir (opcional)
            </label>
            <input
              type="text"
              value={optionalTarget}
              onChange={(e) => setOptionalTarget(e.target.value)}
              placeholder="Ej: AI Engineer, no centrar en Dynamics. Déjalo vacío si no lo tienes claro."
              className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 focus:outline-none focus:border-[#8b5cf6]"
            />
          </div>
        </div>

        <div id="section-master" className="bg-white dark:bg-[#111827] border border-[#8B5CF6]/25 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#7c3aed] text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                2. Documento maestro
              </h2>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                Lo genera el copiloto a partir de lo que pegaste. Puedes editarlo. Es la fuente de la verdad.
              </p>
            </div>
          </div>
          <DictationTextarea
            id="career-master"
            label="Quién eres, qué has hecho y con qué"
            value={masterDocument}
            onChange={setMasterDocument}
            rows={8}
            placeholder="Pulsa «Crear documento con IA» después de pegar tu experiencia. También puedes escribirlo tú."
          />
        </div>

        <div id="section-criteria" className="bg-white dark:bg-[#111827] border border-[#8B5CF6]/30 rounded-2xl p-6 shadow-md shadow-[#8B5CF6]/5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                3. Cómo debe puntuar las ofertas
              </h2>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                Idioma, presencial, consultoras… Las reglas de idioma se aplican en código.
              </p>
            </div>
          </div>
          <DictationTextarea
            id="career-criteria"
            label="Reglas de búsqueda"
            value={curationCriteria}
            onChange={setCurationCriteria}
            rows={5}
            placeholder="Ej: No puntúes alto ofertas en inglés. Prioriza el stack que uso. Penaliza presencial fuera de mi ciudad."
          />
          {constraintChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {constraintChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-2.5 py-1 text-[11px] font-bold text-[#6D28D9] dark:text-[#C4B5FD]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-2 font-display">
              Modalidad (opcional)
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
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                        : 'bg-[#fafafa] dark:bg-[#0b0f19] text-slate-500 border-[#1e1b4b]/10 dark:border-white/10'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5 inline mr-1 stroke-[1.75]" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6">
          <button
            type="button"
            onClick={() => setShowAdvanced((open) => !open)}
            className="w-full flex items-center justify-between gap-3 text-left"
            aria-expanded={showAdvanced}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Building className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">Ajustes avanzados</h2>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                  Roles, años y salario. La IA puede rellenarlos; no hace falta tocarlos.
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 stroke-[1.75] text-[#1e1b4b]/50 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 mt-5 border-t border-[#1e1b4b]/10 dark:border-white/10">
              <div>
                <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">Roles objetivo</label>
                <input
                  type="text"
                  value={targetRolesText}
                  onChange={(e) => setTargetRolesText(e.target.value)}
                  placeholder="Frontend, Backend…"
                  className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">Años de experiencia</label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">Salario mínimo (€)</label>
                <input
                  type="number"
                  step={1000}
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">Salario objetivo (€)</label>
                <input
                  type="number"
                  step={1000}
                  value={salaryTarget}
                  onChange={(e) => setSalaryTarget(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 rounded-xl bg-[#2ECC71] hover:bg-[#27AE60] text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin stroke-[1.75]" /> : <Save className="w-4 h-4 stroke-[1.75]" />}
            <span>{saving ? 'Guardando…' : 'Guardar perfil y criterios'}</span>
          </button>
        </div>
      </form>

      <AiProfileInterviewModal
        isOpen={isInterviewOpen}
        onClose={() => setIsInterviewOpen(false)}
        dumpText={bio}
        optionalTarget={optionalTarget}
        currentProfile={buildPayload()}
        onApplyProfile={handleApplyEnrichedProfile}
      />
      <CvImportProfileModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        userCvs={userCvs}
        onApplyProfile={handleApplyEnrichedProfile}
      />
      <AiPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        profileData={{
          bio,
          targetRoles: targetRolesArray,
          experienceYears,
          techStack,
          keyProjects,
          targetTransition: { targetRole: optionalTarget, targetIndustries: '', targetGeography: preferredLocations },
          preferredWorkplaces,
          preferredLocations,
          companyPreferences,
          salaryMin,
          salaryTarget,
          curationCriteria,
          masterDocument,
        }}
        constraintChips={constraintChips}
      />
    </div>
  );
}
