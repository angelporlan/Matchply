"use client";
import { InlineAllowance } from '@/components/subscription/InlineAllowance';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Check,
  Eye,
  FolderKanban,
  Layers,
  Mic,
  Save,
  X,
  ScanSearch,
  Sparkles,
  Upload,
} from 'lucide-react';
import { saveUserCareerProfileAction } from '@/app/dashboard/actions';
import { useAiPromptDebug } from '@/components/ai/AiPromptDebugContext';
import { reportPlanRestriction, refreshPlanUsage } from '@/lib/plan-presentation';
import {
  CEFR_LABELS,
  CEFR_LEVELS,
  LANGUAGE_LABELS,
  LANGUAGE_PENALIZE_MAX_SCORE,
  LANGUAGE_REJECT_MAX_SCORE,
  describeHardConstraintChips,
  normalizeScoringPreferences,
  parseCefrLevel,
  parseMatchConstraints,
  type CefrLevel,
  type LanguagePolicy,
  type LanguageScoringRule,
  type ScoringPreferences,
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
import dynamic from 'next/dynamic';

const AiProfileInterviewModal = dynamic(() => import('@/components/profile/AiProfileInterviewModal'), { ssr: false });
const CvImportProfileModal = dynamic(() => import('@/components/profile/CvImportProfileModal'), { ssr: false });
const AiPreviewModal = dynamic(() => import('@/components/profile/AiPreviewModal'), { ssr: false });
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
    englishLevel?: string;
    englishOverLevelPolicy?: string;
    scoringPreferences?: ScoringPreferences;
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
    content?: string;
  }>;
  baseCvContent?: string;
}

function baseCvMarkdown(
  userCvs: Array<{ isBase: boolean; isPrincipal: boolean; content?: string }>,
  baseCvContent?: string,
) {
  if (baseCvContent) return baseCvContent;
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
  baseCvContent = '',
}: CareerProfileFormProps) {
  const cvMarkdown = useMemo(() => baseCvMarkdown(userCvs, baseCvContent), [userCvs, baseCvContent]);
  const initialStructured = useMemo(
    () => loadStructured(initialProfile, cvMarkdown),
    [initialProfile, cvMarkdown],
  );

  const initialRoles = Array.isArray(initialProfile?.targetRoles) ? initialProfile.targetRoles.join(', ') : '';
  const initialDirection = initialProfile?.targetTransition?.targetRole || '';
  const [bio, setBio] = useState(initialProfile?.bio || initialProfile?.additionalNotes || '');
  const [optionalTarget, setOptionalTarget] = useState(
    initialDirection || initialRoles.split(',')[0]?.trim() || '',
  );
  const [masterDocument, setMasterDocument] = useState(initialProfile?.masterDocument || '');
  const [curationCriteria, setCurationCriteria] = useState(initialProfile?.curationCriteria || '');
  const [experienceYears, setExperienceYears] = useState<number | ''>(
    initialProfile?.experienceYears ?? '',
  );
  const [targetRolesText, setTargetRolesText] = useState(initialRoles || initialDirection);
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
  const [englishLevel, setEnglishLevel] = useState<CefrLevel | ''>(
    parseCefrLevel(initialProfile?.englishLevel) || '',
  );
  const [savedScoringPreferences, setSavedScoringPreferences] = useState<ScoringPreferences>(
    () => normalizeScoringPreferences(initialProfile || {}),
  );
  const [ruleLanguage, setRuleLanguage] = useState('en');
  const [ruleCondition, setRuleCondition] = useState<LanguageScoringRule['condition']>('minimum_level');
  const [ruleMinimumLevel, setRuleMinimumLevel] = useState<CefrLevel>('c1');
  const [ruleAction, setRuleAction] = useState<LanguagePolicy | 'none'>('none');
  const [keyProjects, setKeyProjects] = useState<KeyProject[]>(initialStructured.projects);
  const [skills, setSkills] = useState<ProfileSkill[]>(initialStructured.skills);
  const [classification, setClassification] = useState<any>(initialProfile?.classification || null);
  const [autoFilled, setAutoFilled] = useState(initialStructured.autoFilled);
  const [pane, setPane] = useState<'profile' | 'criteria'>('profile');
  const [editingMaster, setEditingMaster] = useState(false);
  const [dictateMaster, setDictateMaster] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { inspectOrExecutePrompt } = useAiPromptDebug();

  const scoringPreferences = useMemo(
    () => normalizeScoringPreferences({ scoringPreferences: savedScoringPreferences, curationCriteria }),
    [savedScoringPreferences, curationCriteria],
  );
  const constraintChips = useMemo(
    () => describeHardConstraintChips(parseMatchConstraints({
      curationCriteria,
      preferredWorkplaces,
      salaryMin: salaryMin === '' ? null : Number(salaryMin),
      englishLevel: englishLevel || null,
      scoringPreferences,
    })),
    [curationCriteria, preferredWorkplaces, salaryMin, englishLevel, scoringPreferences],
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
    englishLevel: englishLevel || null,
    englishOverLevelPolicy: null,
    scoringPreferences,
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
    if (parseCefrLevel(data.englishLevel)) setEnglishLevel(parseCefrLevel(data.englishLevel) as CefrLevel);
    if (data.classification) setClassification(data.classification);
    if (data.targetTransition?.targetRole) {
      setOptionalTarget(data.targetTransition.targetRole);
      setTargetRolesText((current) => current.trim() ? current : data.targetTransition.targetRole);
    }
    const structured = applyStructured(data);
    const detected = detectStructuredProfile({
      bio: data.bio ?? bio,
      masterDocument: data.masterDocument ?? masterDocument,
      cvMarkdown,
      keyProjects: structured.keyProjects,
      skills: structured.skills,
    });
    const chainedSkills = mergeSkills(structured.skills, detected.skills);
    const chainedProjects = mergeProjects(structured.keyProjects, detected.projects);
    setSkills(chainedSkills);
    setKeyProjects(chainedProjects);
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
        skills: chainedSkills,
        keyProjects: chainedProjects,
        techStack: techStackFromSkills(chainedSkills),
      });
      markCleanOnNext.current = true;
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
      setBaseline(fingerprint);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar el perfil profesional.');
    } finally {
      setSaving(false);
    }
  };

  const setDirection = (value: string) => {
    setTargetRolesText(value);
    setOptionalTarget(value.split(',').map((role) => role.trim()).filter(Boolean)[0] || '');
  };

  const dismissLanguageRule = (rule: LanguageScoringRule) => {
    setSavedScoringPreferences((current) => ({
      ...current,
      languageRules: current.languageRules.filter((item) => item.id !== rule.id),
    }));
    if (rule.sourceText) {
      const source = rule.sourceText;
      setCurationCriteria((text) => text.replace(source, '').replace(/\n{3,}/g, '\n\n').trim());
    }
  };

  const profileReady = Boolean(
    masterDocument.trim().length >= 40
    || skills.some((skill) => skill.name.trim())
    || keyProjects.some((entry) => entry.title.trim() || entry.description.trim()),
  );

  const fingerprint = useMemo(() => JSON.stringify({
    bio,
    optionalTarget,
    masterDocument,
    curationCriteria,
    experienceYears,
    targetRolesText,
    preferredWorkplaces,
    preferredLocations,
    companyPreferences,
    salaryMin,
    salaryTarget,
    englishLevel,
    savedScoringPreferences,
    keyProjects,
    skills,
    classification,
  }), [
    bio, optionalTarget, masterDocument, curationCriteria, experienceYears, targetRolesText,
    preferredWorkplaces, preferredLocations, companyPreferences, salaryMin, salaryTarget,
    englishLevel, savedScoringPreferences, keyProjects, skills, classification,
  ]);
  const [baseline, setBaseline] = useState(fingerprint);
  const dirty = fingerprint !== baseline || autoFilled;
  const markCleanOnNext = useRef(false);
  useEffect(() => {
    if (!markCleanOnNext.current) return;
    markCleanOnNext.current = false;
    setBaseline(fingerprint);
  }, [fingerprint]);

  const scrollToSection = (section: string) => {
    if (section === 'dump') {
      if (profileReady) setIsImportOpen(true);
      else {
        setShowPaste(true);
        window.setTimeout(() => document.getElementById('section-dump')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      }
      return;
    }
    const nextPane = section === 'criteria' ? 'criteria' : 'profile';
    setPane(nextPane);
    window.setTimeout(() => document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const createFromPastedText = async () => {
    const text = bio.trim();
    if (text.length < 40) {
      setError('Pega un poco más de trayectoria para poder armar el perfil.');
      return;
    }
    const proceed = await inspectOrExecutePrompt({
      action: 'profile_extract',
      title: 'Estructurar perfil profesional con IA',
      data: { rawText: text },
    });
    if (!proceed) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/profile/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, requestId: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.profile) {
        reportPlanRestriction(data, 'profile-import');
        throw new Error(data.error || 'No se pudo crear el perfil.');
      }
      refreshPlanUsage();
      await handleApplyEnrichedProfile(data.profile);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el perfil.');
    } finally {
      setCreating(false);
    }
  };

  const inputClass =
    'w-full rounded-[8px] bg-canvas border border-control px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai min-h-11';
  const remoteOnly = preferredWorkplaces.length > 0 && preferredWorkplaces.every((item) => ['remote', 'remoto', 'teletrabajo'].includes(item.trim().toLowerCase()));
  const salaryChip = typeof salaryMin === 'number' && salaryMin > 0 ? Math.round(salaryMin) : null;

  return (
    <div className={`space-y-6 max-w-5xl mx-auto ${dirty ? 'pb-28' : 'pb-16'}`}>
      <InlineAllowance />
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

      {savedSuccess && (
        <div className="p-4 rounded-[12px] bg-success-surface border border-success-text/20 text-success-text text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 stroke-[1.75]" />
          <span>Perfil guardado. La curación y la adaptación de CVs usarán este documento.</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-[12px] bg-danger-surface border border-danger-text/20 text-danger-text text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {!profileReady ? (
          <section id="section-dump" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 sm:p-8 shadow-sm space-y-5">
            <div className="space-y-1 max-w-xl">
              <h2 className="text-lg font-bold text-text font-display">Empieza por tu experiencia</h2>
              <p className="text-sm text-text-muted">
                Sube un CV o pega tu trayectoria. Con eso se crean el documento maestro, las competencias y las actividades.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant={showPaste || bio.trim() ? 'secondary' : 'ai'} onClick={() => setIsImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Subir mi CV (PDF)
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowPaste(true)}>
                Pegar texto / LinkedIn
              </Button>
            </div>
            {(showPaste || bio.trim()) && (
              <div className="space-y-4 max-w-3xl">
                <DictationTextarea
                  id="career-dump"
                  label="Tu trayectoria, formación y actividades"
                  value={bio}
                  onChange={setBio}
                  rows={8}
                  placeholder="Pega aquí tu CV, el About de LinkedIn o unas notas con puestos, formación y contribuciones."
                />
                <div>
                  <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="career-direction">
                    Hacia dónde quieres ir (opcional)
                  </label>
                  <input
                    id="career-direction"
                    type="text"
                    value={targetRolesText}
                    onChange={(event) => setDirection(event.target.value)}
                    placeholder="Ej: AI Engineer. Déjalo vacío si no lo tienes claro."
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="ai" onClick={createFromPastedText} disabled={creating || !bio.trim()} loading={creating}>
                    <Sparkles className="h-4 w-4" />
                    Crear perfil con IA
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsInterviewOpen(true)}
                    disabled={!bio.trim()}
                    className="text-sm font-semibold text-text-muted underline disabled:opacity-50"
                  >
                    Prefiero responder preguntas
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="segmented" role="group" aria-label="Secciones del perfil">
                <button type="button" className="segmented__item" aria-pressed={pane === 'profile'} onClick={() => setPane('profile')}>
                  Tu perfil
                </button>
                <button type="button" className="segmented__item" aria-pressed={pane === 'criteria'} onClick={() => setPane('criteria')}>
                  Qué busco
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsPreviewOpen(true)}>
                  <Eye className="h-4 w-4" />
                  Cómo te ve la IA
                </Button>
                <Button type="button" variant="ai" onClick={() => setIsImportOpen(true)}>
                  <Sparkles className="h-4 w-4" />
                  Actualizar perfil con IA (CV o texto)
                </Button>
              </div>
            </div>

            {autoFilled && (
              <div className="p-4 rounded-[12px] bg-ai-surface border border-ai/20 text-ai-text text-xs font-semibold">
                Hemos extraído competencias y actividades desde tu texto. Revisa la evidencia de cada competencia. Los cambios se guardan con la barra de abajo.
              </div>
            )}

            <div className={pane === 'profile' ? 'space-y-6' : 'hidden'}>
              <section id="section-master" className="bg-white dark:bg-surface border border-ai/25 rounded-[12px] p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
                      <Sparkles className="w-4 h-4 stroke-[1.75]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-text font-display">Documento maestro</h2>
                      <p className="text-xs text-text-muted">La fuente de la verdad narrativa para la IA.</p>
                    </div>
                  </div>
                  {!editingMaster && (
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setDictateMaster(true); setEditingMaster(true); }}>
                        <Mic className="h-4 w-4" />
                        Dictar
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => { setDictateMaster(false); setEditingMaster(true); }}>
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
                {editingMaster ? (
                  <div className="space-y-3">
                    <DictationTextarea
                      id="career-master"
                      label="Quién eres, qué has hecho y con qué"
                      value={masterDocument}
                      onChange={setMasterDocument}
                      rows={8}
                      autoStart={dictateMaster}
                      placeholder="Escribe o dicta el documento. También puedes actualizar el perfil con un CV."
                    />
                    <div className="flex justify-end">
                      <Button type="button" variant="secondary" size="sm" onClick={() => { setEditingMaster(false); setDictateMaster(false); }}>
                        Listo
                      </Button>
                    </div>
                  </div>
                ) : masterDocument.trim() ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{masterDocument}</p>
                ) : (
                  <p className="text-sm text-text-muted">Todavía no hay documento maestro. Edítalo o actualiza el perfil con un CV o un texto.</p>
                )}
              </section>

              <section id="section-skills" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-subtle">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
                      <Layers className="w-4 h-4 stroke-[1.75]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-text font-display">Competencias con evidencia</h2>
                      <p className="text-xs text-text-muted">Solo lo que puedes defender. Relaciona cada competencia con una contribución real.</p>
                    </div>
                  </div>
                  <button type="button" onClick={handleDetectFromSources} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ai-text">
                    <ScanSearch className="h-4 w-4 stroke-[1.75]" />
                    Detectar desde el texto
                  </button>
                </div>
                <SkillsEvidenceEditor
                  skills={skills}
                  evidenceOptions={evidenceOptions}
                  suggestions={suggestions}
                  onChange={setSkills}
                />
              </section>

              <section id="section-experience" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
                  <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
                    <Briefcase className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text font-display">Experiencia profesional</h2>
                    <p className="text-xs text-text-muted">Cada puesto se lee como una ficha. Edítalo solo cuando haga falta.</p>
                  </div>
                </div>
                <KeyProjectsEditor
                  kind="experience"
                  projects={entriesOfKind(keyProjects, 'experience')}
                  onChange={(next) => replaceEntries('experience', next)}
                />
              </section>

              <section id="section-projects" className="bg-white dark:bg-surface border border-subtle rounded-[12px] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
                  <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
                    <FolderKanban className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text font-display">Proyectos personales</h2>
                    <p className="text-xs text-text-muted">Productos propios, freelance o side projects.</p>
                  </div>
                </div>
                <KeyProjectsEditor
                  kind="project"
                  projects={entriesOfKind(keyProjects, 'project')}
                  onChange={(next) => replaceEntries('project', next)}
                />
              </section>
            </div>

            <div className={pane === 'criteria' ? 'space-y-6' : 'hidden'}>
              <section id="section-criteria" className="bg-white dark:bg-surface border border-ai/30 rounded-[12px] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
                  <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center">
                    <Sparkles className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text font-display">Criterios de match</h2>
                    <p className="text-xs text-text-muted">Qué buscas y qué debe bajar la puntuación. Tu experiencia no vive aquí.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="target-roles">Roles objetivo</label>
                    <input
                      id="target-roles"
                      type="text"
                      value={targetRolesText}
                      onChange={(event) => setDirection(event.target.value)}
                      placeholder="Administración, ventas, docencia…"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="experience-years">Años de experiencia</label>
                    <input
                      id="experience-years"
                      type="number"
                      min={0}
                      max={40}
                      value={experienceYears}
                      onChange={(event) => setExperienceYears(event.target.value === '' ? '' : Number(event.target.value))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <DictationTextarea
                  id="career-criteria"
                  label="Reglas de búsqueda"
                  value={curationCriteria}
                  onChange={setCurationCriteria}
                  rows={4}
                  placeholder="Ej: Prioriza TypeScript y producto. Penaliza si piden C1 o C2 de inglés."
                />
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {scoringPreferences.languageRules.map((rule) => {
                      const condition = rule.condition === 'minimum_level' && rule.minimumLevel
                        ? `${CEFR_LABELS[rule.minimumLevel]} o superior`
                        : 'obligatorio';
                      const max = rule.action === 'reject' ? LANGUAGE_REJECT_MAX_SCORE : LANGUAGE_PENALIZE_MAX_SCORE;
                      const label = `${LANGUAGE_LABELS[rule.language] || rule.language} ${condition}: máx. ${max} pts`;
                      return (
                        <span key={rule.id} className="inline-flex items-center gap-1 rounded-lg border border-ai/25 bg-ai/10 pl-2.5 pr-1 py-1 text-[11px] font-bold text-ai-text">
                          {label}
                          <button type="button" onClick={() => dismissLanguageRule(rule)} aria-label={`Quitar ${label}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })}
                    {salaryChip !== null && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-ai/25 bg-ai/10 pl-2.5 pr-1 py-1 text-[11px] font-bold text-ai-text">
                        Salario mín. {salaryChip}€
                        <button type="button" onClick={() => setSalaryMin('')} aria-label={`Quitar salario mínimo de ${salaryChip} euros`} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                    {remoteOnly && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-ai/25 bg-ai/10 pl-2.5 pr-1 py-1 text-[11px] font-bold text-ai-text">
                        Solo remoto
                        <button type="button" onClick={() => setPreferredWorkplaces((current) => current.filter((item) => !['remote', 'remoto', 'teletrabajo'].includes(item.trim().toLowerCase())))} aria-label="Quitar solo remoto" className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      aria-expanded={ruleEditorOpen}
                      onClick={() => setRuleEditorOpen((open) => !open)}
                      className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-ai-text"
                    >
                      + Añadir regla manual
                    </button>
                  </div>
                  {scoringPreferences.languageRules.length === 0 && salaryChip === null && !remoteOnly && (
                    <p className="text-sm text-text-muted">Sin reglas activas. Escríbelas arriba o añade una a mano.</p>
                  )}
                  {ruleEditorOpen && (
                    <div className="space-y-4 rounded-xl border border-subtle bg-canvas/40 p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="text-xs font-bold text-text" htmlFor="language-rule-language">
                          Idioma
                          <select id="language-rule-language" value={ruleLanguage} onChange={(event) => setRuleLanguage(event.target.value)} className={`${inputClass} mt-1.5`}>
                            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-bold text-text" htmlFor="language-rule-condition">
                          Condición
                          <select id="language-rule-condition" value={ruleCondition} onChange={(event) => setRuleCondition(event.target.value as LanguageScoringRule['condition'])} className={`${inputClass} mt-1.5`}>
                            <option value="minimum_level">Exigen este nivel o superior</option>
                            <option value="required">Exigen el idioma, con cualquier nivel</option>
                          </select>
                        </label>
                        {ruleCondition === 'minimum_level' && (
                          <label className="text-xs font-bold text-text" htmlFor="language-rule-level">
                            Nivel a partir del que aplicar la regla
                            <select id="language-rule-level" value={ruleMinimumLevel} onChange={(event) => setRuleMinimumLevel(event.target.value as CefrLevel)} className={`${inputClass} mt-1.5`}>
                              {CEFR_LEVELS.map((level) => <option key={level} value={level}>{CEFR_LABELS[level]}</option>)}
                            </select>
                          </label>
                        )}
                        <label className="text-xs font-bold text-text" htmlFor="language-rule-action">
                          Acción
                          <select id="language-rule-action" value={ruleAction} onChange={(event) => setRuleAction(event.target.value as LanguagePolicy | 'none')} className={`${inputClass} mt-1.5`}>
                            <option value="none">Sin penalización</option>
                            <option value="penalize">Penalizar: máximo 40 puntos</option>
                            <option value="reject">Descartar: máximo 30 puntos</option>
                          </select>
                        </label>
                      </div>
                      {ruleAction !== 'none' && (
                        <p className="text-xs text-text" role="status">
                          Si el puesto exige {LANGUAGE_LABELS[ruleLanguage].toLowerCase()}
                          {ruleCondition === 'minimum_level' ? ` ${CEFR_LABELS[ruleMinimumLevel]} o superior` : ''},
                          {' '}la puntuación será como máximo {ruleAction === 'reject' ? '30 y se recomendará descartar' : '40'}.
                        </p>
                      )}
                      <Button type="button" variant="secondary" disabled={ruleAction === 'none'} onClick={() => {
                        if (ruleAction === 'none') return;
                        setSavedScoringPreferences((current) => ({
                          ...current,
                          languageRules: [...current.languageRules, {
                            id: `explicit:${ruleLanguage}:${ruleCondition}:${ruleCondition === 'minimum_level' ? ruleMinimumLevel : 'any'}:${ruleAction}`,
                            language: ruleLanguage,
                            condition: ruleCondition,
                            ...(ruleCondition === 'minimum_level' ? { minimumLevel: ruleMinimumLevel } : {}),
                            action: ruleAction,
                            source: 'explicit' as const,
                          }],
                          reviewRequired: current.reviewRequired.filter((text) => !text.startsWith('La regla antigua')),
                        }));
                        setRuleAction('none');
                        setRuleEditorOpen(false);
                      }}>
                        Añadir regla
                      </Button>
                    </div>
                  )}
                </div>
                {scoringPreferences.reviewRequired.length > 0 && (
                  <div className="rounded-xl border border-subtle bg-surface-muted p-4 text-xs text-text" role="status">
                    <p className="font-bold">Criterios pendientes de aclarar — inactivos</p>
                    <ul className="mt-2 list-disc pl-4 space-y-1">
                      {scoringPreferences.reviewRequired.map((text) => <li key={text}>{text}</li>)}
                    </ul>
                    <p className="mt-2">Aclara la condición en tus reglas de búsqueda o añade una regla de idioma. Estos textos no generan topes.</p>
                    {scoringPreferences.reviewRequired.some((text) => text.startsWith('La regla antigua')) && (
                      <Button type="button" variant="secondary" className="mt-3" onClick={() => setSavedScoringPreferences((current) => ({
                        ...current, reviewRequired: current.reviewRequired.filter((text) => !text.startsWith('La regla antigua')),
                      }))}>
                        Mantener desactivada la regla antigua
                      </Button>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-text mb-2 font-display">Modalidad</label>
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
                          aria-pressed={active}
                          className={`text-xs font-bold min-h-11 px-3.5 rounded-[8px] border ${
                            active
                              ? 'bg-success-surface text-success-text border-success-text/25'
                              : 'bg-canvas text-text-muted border-subtle'
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
                    <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="preferred-locations">Ubicaciones</label>
                    <input id="preferred-locations" type="text" value={preferredLocations} onChange={(event) => setPreferredLocations(event.target.value)} placeholder="Alicante, Valencia, remoto…" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="company-preferences">Empresas</label>
                    <input id="company-preferences" type="text" value={companyPreferences} onChange={(event) => setCompanyPreferences(event.target.value)} placeholder="Producto / scale-up; evitar consultoría masiva" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="salary-min">Salario mínimo (€)</label>
                    <input id="salary-min" type="number" step={1000} value={salaryMin} onChange={(event) => setSalaryMin(event.target.value === '' ? '' : Number(event.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="salary-target">Salario objetivo (€)</label>
                    <input id="salary-target" type="number" step={1000} value={salaryTarget} onChange={(event) => setSalaryTarget(event.target.value === '' ? '' : Number(event.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text mb-1.5 font-display" htmlFor="english-level">Tu inglés</label>
                    <select id="english-level" value={englishLevel} onChange={(event) => setEnglishLevel(parseCefrLevel(event.target.value) || '')} className={inputClass}>
                      <option value="">No lo indico</option>
                      {CEFR_LEVELS.map((level) => (
                        <option key={level} value={level}>{CEFR_LABELS[level]}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-text-muted">Este dato informa a la evaluación. No activa penalizaciones por sí solo.</p>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </form>

      {dirty && (
        <div className="fixed bottom-4 z-30 left-4 right-4 md:left-[calc(16rem+1rem)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-control bg-surface px-4 py-3 shadow-xl">
            <p className="text-sm font-medium text-text">Hay cambios sin guardar</p>
            <Button type="button" variant="strong" onClick={() => handleSave()} disabled={saving} loading={saving}>
              {!saving && <Save className="h-4 w-4" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
      {isInterviewOpen && (
      <AiProfileInterviewModal
        isOpen={isInterviewOpen}
        onClose={() => setIsInterviewOpen(false)}
        dumpText={bio}
        optionalTarget={optionalTarget}
        currentProfile={buildPayload()}
        onApplyProfile={handleApplyEnrichedProfile}
      />
      )}
      {isImportOpen && (
      <CvImportProfileModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        userCvs={userCvs}
        onApplyProfile={handleApplyEnrichedProfile}
      />
      )}
      {isPreviewOpen && (
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
          englishLevel,
          scoringPreferences,
          curationCriteria,
          masterDocument,
        }}
        constraintChips={constraintChips}
      />
      )}
    </div>
  );
}
