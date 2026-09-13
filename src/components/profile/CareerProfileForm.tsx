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
  Layers,
  FolderKanban,
  ScanSearch,
} from 'lucide-react';
import { saveUserCareerProfileAction } from '@/app/dashboard/actions';
import {
  describeHardConstraintChips,
  parseHardConstraints,
} from '@/lib/curation-constraints';
import {
  assignEntryKinds,
  detectStructuredProfile,
  entriesOfKind,
  extractProjectsFromMarkdown,
  hydrateStructuredProfile,
  mergeProjects,
  mergeSkills,
  normalizeProjects,
  normalizeSkills,
  resolveEntryKind,
  skillsFromTechStack,
  techStackFromSkills,
  type KeyProject,
  type ProfileEntryKind,
  type ProfileSkill,
  type TechStackCategories,
} from '@/lib/career-profile';
import DictationTextarea from '@/components/profile/DictationTextarea';
import { Button } from '@/components/ui/Button';
import ProfileCompletenessBar from '@/components/profile/ProfileCompletenessBar';
import AiProfileInterviewModal from '@/components/profile/AiProfileInterviewModal';
import CvImportProfileModal from '@/components/profile/CvImportProfileModal';
import AiPreviewModal from '@/components/profile/AiPreviewModal';
import SkillsEvidenceEditor from '@/components/profile/SkillsEvidenceEditor';
import KeyProjectsEditor from '@/components/profile/KeyProjectsEditor';

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
    skills?: ProfileSkill[];
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

function baseCvMarkdown(
  userCvs: Array<{ isBase: boolean; isPrincipal: boolean; content: string }>,
) {
  return userCvs.find((cv) => cv.isBase)?.content
    || userCvs.find((cv) => cv.isPrincipal)?.content
    || userCvs[0]?.content
    || '';
}

function loadStructured(
  profile: CareerProfileFormProps['initialProfile'],
  cvMarkdown: string,
) {
  const savedSkills = mergeSkills(
    normalizeSkills(profile?.skills),
    skillsFromTechStack(profile?.techStack),
  );
  const savedProjects = assignEntryKinds(
    normalizeProjects(profile?.keyProjects),
    extractProjectsFromMarkdown(cvMarkdown),
  );
  if (savedSkills.length || savedProjects.length) {
    return { skills: savedSkills, projects: savedProjects, autoFilled: false };
  }
  const detected = detectStructuredProfile({
    bio: profile?.bio,
    masterDocument: profile?.masterDocument,
    cvMarkdown,
  });
  return {
    skills: detected.skills,
    projects: detected.projects,
    autoFilled: detected.skills.length > 0 || detected.projects.length > 0,
  };
}

export default function CareerProfileForm({
  initialProfile,
  userCvs = [],
}: CareerProfileFormProps) {
  const cvMarkdown = useMemo(() => baseCvMarkdown(userCvs), [userCvs]);
  const initialStructured = useMemo(
    () => loadStructured(initialProfile, cvMarkdown),
    [initialProfile, cvMarkdown],
  );

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
  const [keyProjects, setKeyProjects] = useState<KeyProject[]>(initialStructured.projects);
  const [skills, setSkills] = useState<ProfileSkill[]>(initialStructured.skills);
  const [classification, setClassification] = useState<any>(initialProfile?.classification || null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoFilled, setAutoFilled] = useState(initialStructured.autoFilled);

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

  const techStack = useMemo(() => techStackFromSkills(skills), [skills]);

  const evidenceOptions = useMemo(
    () => keyProjects.map((project) => project.title).filter(Boolean),
    [keyProjects],
  );

  const replaceEntries = (kind: ProfileEntryKind, next: KeyProject[]) => {
    setKeyProjects((prev) => [
      ...prev.filter((entry) => resolveEntryKind(entry) !== kind),
      ...next.map((entry) => ({ ...entry, kind: entry.kind || kind })),
    ]);
  };

  const suggestions = useMemo(() => {
    const detected = detectStructuredProfile({
      bio,
      masterDocument,
      cvMarkdown,
      keyProjects,
    });
    const existing = new Set(skills.map((skill) => skill.name.toLowerCase()));
    return detected.skills.filter((skill) => !existing.has(skill.name.toLowerCase())).slice(0, 8);
  }, [bio, masterDocument, cvMarkdown, keyProjects, skills]);

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
    skills: skills.filter((skill) => skill.name.trim()),
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

  const applyStructured = (data: Record<string, any>) => {
    const hydrated = hydrateStructuredProfile(data, {
      bio: data.bio ?? bio,
      masterDocument: data.masterDocument ?? masterDocument,
      cvMarkdown,
    });
    const nextSkills = mergeSkills(skills, hydrated.skills);
    const nextProjects = mergeProjects(keyProjects, hydrated.keyProjects);
    setSkills(nextSkills);
    setKeyProjects(nextProjects);
    return { skills: nextSkills, keyProjects: nextProjects, techStack: techStackFromSkills(nextSkills) };
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
    if (data.classification) setClassification(data.classification);
    if (data.targetTransition?.targetRole) setOptionalTarget(data.targetTransition.targetRole);
    const structured = applyStructured(data);
    setAutoFilled(false);

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
        classification: data.classification ?? classification,
        targetTransition: {
          targetRole: data.targetTransition?.targetRole || optionalTarget,
          targetIndustries: data.targetTransition?.targetIndustries || '',
          targetGeography: data.targetTransition?.targetGeography || preferredLocations,
        },
        ...structured,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Se aplicó el documento pero no se pudo guardar. Pulsa Guardar.');
    }
  };

  const handleDetectFromSources = () => {
    const detected = detectStructuredProfile({
      bio,
      masterDocument,
      keyProjects,
      skills,
      cvMarkdown,
    });
    setSkills(mergeSkills(skills, detected.skills));
    setKeyProjects(mergeProjects(keyProjects, detected.projects));
    setAutoFilled(true);
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
      setAutoFilled(false);
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

  const inputClass =
    'w-full rounded-[8px] bg-canvas border border-control px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai min-h-11';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <ProfileCompletenessBar
        dumpText={bio}
        masterDocument={masterDocument}
        curationCriteria={curationCriteria}
        skills={skills}
        keyProjects={keyProjects}
        preferredLocations={preferredLocations}
        companyPreferences={companyPreferences}
        salaryMin={salaryMin}
        preferredWorkplaces={preferredWorkplaces}
        onActionClick={scrollToSection}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-surface border border-ai/20 p-4 rounded-[12px] shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsInterviewOpen(true)}
            disabled={!bio.trim()}
            className="px-4 py-2 min-h-11 rounded-[8px] bg-ai-action text-on-ai-action text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Bot className="w-4 h-4 stroke-[1.75]" />
            <span>Crear documento con IA</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 min-h-11 rounded-[8px] bg-canvas border border-control hover:border-ai text-xs font-bold text-text flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-ai stroke-[1.75]" />
            <span>Desde un CV</span>
          </button>
          <button
            type="button"
            onClick={handleDetectFromSources}
            className="px-3.5 py-2 min-h-11 rounded-[8px] bg-canvas border border-control hover:border-ai text-xs font-bold text-text flex items-center gap-1.5"
          >
            <ScanSearch className="w-3.5 h-3.5 text-ai stroke-[1.75]" />
            <span>Detectar stack y proyectos</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-3.5 py-2 min-h-11 rounded-[8px] bg-canvas border border-control text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Cómo te ve la IA</span>
          </button>
        </div>
        <Button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          loading={saving}
          className="ml-auto"
        >
          {!saving && <Save className="w-4 h-4 stroke-[1.75]" />}
          <span>{saving ? 'Guardando…' : 'Guardar'}</span>
        </Button>
      </div>

      {autoFilled && (
        <div className="p-4 rounded-[12px] bg-ai/5 border border-ai/20 text-ai-text dark:text-ai text-xs font-semibold">
          Hemos rellenado stack y proyectos desde tu CV y tu texto. Revisa la prueba de cada tecnología y pulsa Guardar.
        </div>
      )}
      {savedSuccess && (
        <div className="p-4 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 stroke-[1.75]" />
          <span>Perfil guardado. La curación y la adaptación de CVs usarán este documento.</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-[12px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div id="section-dump" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
            <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
              <Briefcase className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-display">
                1. Pega tu experiencia
              </h2>
              <p className="text-xs text-text-muted font-sans">
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
            <label className="block text-xs font-bold text-text mb-1.5 font-display">
              Hacia dónde quieres ir (opcional)
            </label>
            <input
              type="text"
              value={optionalTarget}
              onChange={(e) => setOptionalTarget(e.target.value)}
              placeholder="Ej: AI Engineer, no centrar en Dynamics. Déjalo vacío si no lo tienes claro."
              className={inputClass}
            />
          </div>
        </div>

        <div id="section-master" className="bg-white dark:bg-surface border border-ai/25 rounded-[12px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
            <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-display">
                2. Documento maestro
              </h2>
              <p className="text-xs text-text-muted font-sans">
                Lo genera el copiloto a partir de lo que pegaste. Puedes editarlo. Es la fuente de la verdad narrativa.
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

        <div id="section-skills" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
            <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
              <Layers className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-display">
                3. Stack con evidencia
              </h2>
              <p className="text-xs text-text-muted font-sans">
                Solo lo que puedes defender. Enlaza cada tecnología a un proyecto o logro.
              </p>
            </div>
          </div>
          <SkillsEvidenceEditor
            skills={skills}
            evidenceOptions={evidenceOptions}
            suggestions={suggestions}
            onChange={setSkills}
          />
        </div>

        <div id="section-experience" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
            <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
              <Briefcase className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-display">
                4. Experiencia profesional
              </h2>
              <p className="text-xs text-text-muted font-sans">
                Empresas donde has trabajado. El match usa puesto, stack e impacto.
              </p>
            </div>
          </div>
          <KeyProjectsEditor
            kind="experience"
            projects={entriesOfKind(keyProjects, 'experience')}
            onChange={(next) => replaceEntries('experience', next)}
          />
        </div>

        <div id="section-projects" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
            <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
              <FolderKanban className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-display">
                5. Proyectos personales
              </h2>
              <p className="text-xs text-text-muted font-sans">
                Productos propios, freelance o side projects. Separado de los puestos de empresa.
              </p>
            </div>
          </div>
          <KeyProjectsEditor
            kind="project"
            projects={entriesOfKind(keyProjects, 'project')}
            onChange={(next) => replaceEntries('project', next)}
          />
        </div>

        <div id="section-criteria" className="bg-white dark:bg-surface border border-ai/30 rounded-[12px] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
            <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text font-display">
                6. Preferencias y cómo puntuar
              </h2>
              <p className="text-xs text-text-muted font-sans">
                Idioma, modalidad, ciudad y tipo de empresa. Las reglas de idioma se aplican en código.
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
                  className="inline-flex items-center rounded-lg border border-ai/25 bg-ai/10 px-2.5 py-1 text-[11px] font-bold text-ai-text dark:text-ai"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-text mb-2 font-display">
              Modalidad
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
                    className={`text-xs font-bold min-h-11 px-3.5 rounded-[8px] border ${
                      active
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                        : 'bg-canvas text-slate-500 border-subtle'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5 inline mr-1 stroke-[1.75]" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text mb-1.5 font-display">Ubicaciones</label>
              <input
                type="text"
                value={preferredLocations}
                onChange={(e) => setPreferredLocations(e.target.value)}
                placeholder="Alicante, Valencia, remoto…"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text mb-1.5 font-display">Empresas</label>
              <input
                type="text"
                value={companyPreferences}
                onChange={(e) => setCompanyPreferences(e.target.value)}
                placeholder="Producto / scale-up; evitar consultoría masiva"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text mb-1.5 font-display">Salario mínimo (€)</label>
              <input
                type="number"
                step={1000}
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text mb-1.5 font-display">Salario objetivo (€)</label>
              <input
                type="number"
                step={1000}
                value={salaryTarget}
                onChange={(e) => setSalaryTarget(e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6">
          <button
            type="button"
            onClick={() => setShowAdvanced((open) => !open)}
            className="w-full flex items-center justify-between gap-3 text-left min-h-11"
            aria-expanded={showAdvanced}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Building className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text font-display">Ajustes avanzados</h2>
                <p className="text-xs text-text-muted font-sans">
                  Roles objetivo y años. La IA puede rellenarlos.
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 stroke-[1.75] text-text-muted transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 mt-5 border-t border-subtle">
              <div>
                <label className="block text-xs font-bold text-text mb-1.5 font-display">Roles objetivo</label>
                <input
                  type="text"
                  value={targetRolesText}
                  onChange={(e) => setTargetRolesText(e.target.value)}
                  placeholder="Full Stack, AI Engineer…"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text mb-1.5 font-display">Años de experiencia</label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            loading={saving}
            className="px-8"
          >
            {!saving && <Save className="w-4 h-4 stroke-[1.75]" />}
            <span>{saving ? 'Guardando…' : 'Guardar perfil y criterios'}</span>
          </Button>
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
          skills,
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
