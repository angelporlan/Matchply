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
  Plus,
  Trash2,
  Code,
  Target,
  Layers,
  Zap,
  Loader2,
  RefreshCw,
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
  // State
  const [bio, setBio] = useState(initialProfile?.bio || initialProfile?.additionalNotes || '');
  const [curationCriteria, setCurationCriteria] = useState(initialProfile?.curationCriteria || '');
  const [experienceYears, setExperienceYears] = useState<number | ''>(
    initialProfile?.experienceYears ?? '',
  );
  const [targetRolesText, setTargetRolesText] = useState(
    Array.isArray(initialProfile?.targetRoles) ? initialProfile.targetRoles.join(', ') : '',
  );
  const [preferredWorkplaces, setPreferredWorkplaces] = useState<string[]>(
    initialProfile?.preferredWorkplaces || ['remote', 'hybrid'],
  );
  const [preferredLocations, setPreferredLocations] = useState(
    initialProfile?.preferredLocations || '',
  );
  const [companyPreferences, setCompanyPreferences] = useState(
    initialProfile?.companyPreferences || '',
  );
  const [salaryMin, setSalaryMin] = useState<number | ''>(initialProfile?.salaryMin ?? '');
  const [salaryTarget, setSalaryTarget] = useState<number | ''>(initialProfile?.salaryTarget ?? '');

  // Rich fields
  const [keyProjects, setKeyProjects] = useState<KeyProject[]>(
    Array.isArray(initialProfile?.keyProjects) && initialProfile.keyProjects.length > 0
      ? initialProfile.keyProjects
      : [
          {
            title: '',
            role: '',
            techStack: '',
            description: '',
            impact: '',
          },
        ],
  );

  const [techStack, setTechStack] = useState<TechStackCategories>(
    initialProfile?.techStack || {
      frontend: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'],
      backend: ['Node.js', 'PostgreSQL'],
      ai_ml: ['Gemini API', 'OpenRouter', 'LLMs'],
      cloud_devops: ['Docker'],
    },
  );

  const [targetRoleTransition, setTargetRoleTransition] = useState(
    initialProfile?.targetTransition?.targetRole || '',
  );
  const [targetIndustries, setTargetIndustries] = useState(
    initialProfile?.targetTransition?.targetIndustries || '',
  );
  const [targetGeography, setTargetGeography] = useState(
    initialProfile?.targetTransition?.targetGeography || '',
  );

  // New skill input temporary state
  const [newSkillInput, setNewSkillInput] = useState<{ [category: string]: string }>({});

  // Modals & UI States
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [polishingBio, setPolishingBio] = useState(false);
  const [polishingCriteria, setPolishingCriteria] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Constraint chips
  const constraintChips = useMemo(
    () => describeHardConstraintChips(parseHardConstraints({ curationCriteria })),
    [curationCriteria],
  );

  // Target roles array
  const targetRolesArray = useMemo(() => {
    return targetRolesText
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  }, [targetRolesText]);

  // Handler for merging extracted or synthesized profile
  const handleApplyEnrichedProfile = (data: any) => {
    if (!data) return;

    if (data.bio) setBio(data.bio);
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
    if (data.salaryMin) setSalaryMin(data.salaryMin);
    if (data.salaryTarget) setSalaryTarget(data.salaryTarget);

    if (data.keyProjects && Array.isArray(data.keyProjects) && data.keyProjects.length > 0) {
      setKeyProjects(data.keyProjects);
    }

    if (data.techStack && typeof data.techStack === 'object') {
      setTechStack(data.techStack);
    }

    if (data.targetTransition) {
      if (typeof data.targetTransition === 'object') {
        if (data.targetTransition.targetRole) setTargetRoleTransition(data.targetTransition.targetRole);
        if (data.targetTransition.targetIndustries) setTargetIndustries(data.targetTransition.targetIndustries);
        if (data.targetTransition.targetGeography) setTargetGeography(data.targetTransition.targetGeography);
      } else if (typeof data.targetTransition === 'string') {
        setTargetRoleTransition(data.targetTransition);
      }
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 5000);
  };

  const toggleWorkplace = (type: string) => {
    if (preferredWorkplaces.includes(type)) {
      setPreferredWorkplaces(preferredWorkplaces.filter((item) => item !== type));
    } else {
      setPreferredWorkplaces([...preferredWorkplaces, type]);
    }
  };

  // Polish with AI
  const handlePolishBio = async () => {
    if (!bio.trim()) return;
    setPolishingBio(true);
    try {
      const res = await fetch('/api/ai/profile/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'polish_section',
          sectionType: 'bio',
          currentContent: bio,
        }),
      });
      const data = await res.json();
      if (data.success && data.polishedContent) {
        setBio(data.polishedContent);
      }
    } catch (err) {
      console.error('Error polishing bio:', err);
    } finally {
      setPolishingBio(false);
    }
  };

  const handlePolishCriteria = async () => {
    if (!curationCriteria.trim()) return;
    setPolishingCriteria(true);
    try {
      const res = await fetch('/api/ai/profile/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'polish_section',
          sectionType: 'curationCriteria',
          currentContent: curationCriteria,
        }),
      });
      const data = await res.json();
      if (data.success && data.polishedContent) {
        setCurationCriteria(data.polishedContent);
      }
    } catch (err) {
      console.error('Error polishing criteria:', err);
    } finally {
      setPolishingCriteria(false);
    }
  };

  // Projects management
  const addProject = () => {
    setKeyProjects((prev) => [
      ...prev,
      { title: '', role: '', techStack: '', description: '', impact: '' },
    ]);
  };

  const removeProject = (index: number) => {
    setKeyProjects((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProject = (index: number, field: keyof KeyProject, value: string) => {
    setKeyProjects((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  };

  // Tech stack tags
  const addTechTag = (category: keyof TechStackCategories) => {
    const val = (newSkillInput[category as string] || '').trim();
    if (!val) return;
    setTechStack((prev) => {
      const currentList = prev[category] || [];
      if (currentList.includes(val)) return prev;
      return { ...prev, [category]: [...currentList, val] };
    });
    setNewSkillInput((prev) => ({ ...prev, [category as string]: '' }));
  };

  const removeTechTag = (category: keyof TechStackCategories, tagToRemove: string) => {
    setTechStack((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((t) => t !== tagToRemove),
    }));
  };

  // Save handler
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const validProjects = keyProjects.filter(
        (p) => p.title.trim() || p.description.trim(),
      );

      const payload = {
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
        keyProjects: validProjects,
        techStack,
        targetTransition: {
          targetRole: targetRoleTransition || targetRolesArray[0] || '',
          targetIndustries,
          targetGeography: targetGeography || preferredLocations,
        },
      };

      const res = await saveUserCareerProfileAction(payload);
      if (res.error) {
        throw new Error(res.error);
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Error al guardar el perfil profesional.');
    } finally {
      setSaving(false);
    }
  };

  const scrollToSection = (section: string) => {
    const el = document.getElementById(`section-${section}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. Barra de Fuerza del Perfil y Acciones Rápidas */}
      <ProfileCompletenessBar
        bio={bio}
        targetRoles={targetRolesArray}
        techStack={techStack}
        keyProjects={keyProjects}
        targetTransition={{ targetRole: targetRoleTransition, targetIndustries }}
        curationCriteria={curationCriteria}
        onActionClick={scrollToSection}
      />

      {/* 2. Barra de Herramientas Inteligentes */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111827] border border-[#8B5CF6]/20 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsInterviewOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7c3aed] hover:from-[#7c3aed] hover:to-[#6D28D9] text-white text-xs font-bold shadow-sm shadow-[#8B5CF6]/20 flex items-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <Bot className="w-4 h-4 stroke-[1.75]" />
            <span>Copiloto de Entrevista IA</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-[#8B5CF6] text-xs font-bold text-[#1e1b4b] dark:text-white flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#8B5CF6] stroke-[1.75]" />
            <span>Auto-completar desde CV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 hover:border-slate-300 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>Cómo te ve la IA</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="px-6 py-2 rounded-xl bg-[#2ECC71] hover:bg-[#27AE60] text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-98 ml-auto"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin stroke-[1.75]" />
          ) : (
            <Save className="w-4 h-4 stroke-[1.75]" />
          )}
          <span>{saving ? 'Guardando…' : 'Guardar perfil y criterios'}</span>
        </button>
      </div>

      {/* Mensajes de feedback */}
      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 stroke-[1.75]" />
          <span>
            Perfil y criterios guardados con éxito. La IA utilizará esta información en el matching de ofertas y optimización de CVs.
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* BLOQUE 1: TRAYECTORIA Y BIO */}
        <div
          id="section-bio"
          className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
                <Briefcase className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                  1. Tu Trayectoria & Resumen Profesional
                </h2>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                  Pega tu LinkedIn About, trayectoria laboral o resumen de CV.
                </p>
              </div>
            </div>

            {bio.trim().length > 30 && (
              <button
                type="button"
                onClick={handlePolishBio}
                disabled={polishingBio}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8B5CF6] hover:text-[#6D28D9] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 px-3 py-1 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                title="Reescribe tu resumen en formato técnico de alto impacto"
              >
                {polishingBio ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                )}
                <span>Pulir con IA</span>
              </button>
            )}
          </div>

          <DictationTextarea
            id="career-bio"
            label="Quién eres, qué has hecho y con qué tecnologías"
            value={bio}
            onChange={setBio}
            rows={6}
            placeholder="Ejemplo: Full Stack & AI Engineer con 3 años de experiencia en TypeScript, Next.js, Node y PostgreSQL. He desarrollado y lanzado el SaaS Matchply integrando modelos de Gemini y OpenRouter para automatizar CVs y curación de ofertas de LinkedIn..."
          />
        </div>

        {/* BLOQUE 2: PROYECTOS ESTRELLA & LOGROS TÉCNICOS */}
        <div
          id="section-projects"
          className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Layers className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                  2. Proyectos Estrella & Logros Clave
                </h2>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                  Añade proyectos destacados (SaaS propios, clientes, empresas). La IA extraerá estos logros para enriquecer tus CVs.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addProject}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Añadir Proyecto</span>
            </button>
          </div>

          <div className="space-y-4">
            {keyProjects.map((project, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 space-y-3 relative group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase text-[#8B5CF6] tracking-wider">
                    Proyecto {index + 1}
                  </span>
                  {keyProjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProject(index)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#1e1b4b] dark:text-white mb-1 font-display">
                      Nombre del Proyecto / Empresa
                    </label>
                    <input
                      type="text"
                      value={project.title}
                      onChange={(e) => updateProject(index, 'title', e.target.value)}
                      placeholder="Ej: Matchply SaaS o ENAE Business School"
                      className="w-full rounded-lg bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 px-3 py-2 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#1e1b4b] dark:text-white mb-1 font-display">
                      Tech Stack Principal
                    </label>
                    <input
                      type="text"
                      value={project.techStack || ''}
                      onChange={(e) => updateProject(index, 'techStack', e.target.value)}
                      placeholder="Ej: Next.js 14, TypeScript, OpenRouter, Gemini, PostgreSQL"
                      className="w-full rounded-lg bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 px-3 py-2 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1e1b4b] dark:text-white mb-1 font-display">
                    Descripción del Reto Técnico & Arquitectura
                  </label>
                  <textarea
                    rows={2}
                    value={project.description}
                    onChange={(e) => updateProject(index, 'description', e.target.value)}
                    placeholder="Qué construiste, qué problema resolviste y cómo funciona..."
                    className="w-full rounded-lg bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 px-3 py-2 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] resize-y"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1e1b4b] dark:text-white mb-1 font-display">
                    Métricas de Impacto o Automatización (Opcional)
                  </label>
                  <input
                    type="text"
                    value={project.impact || ''}
                    onChange={(e) => updateProject(index, 'impact', e.target.value)}
                    placeholder="Ej: Curación automatizada de 50+ ofertas/día, reducción del tiempo de creación de CVs un 80%"
                    className="w-full rounded-lg bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 px-3 py-2 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BLOQUE 3: TECH STACK & ESPECIALIZACIÓN */}
        <div
          id="section-tech_stack"
          className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Code className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                3. Tech Stack & Habilidades Técnicas
              </h2>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                Etiquetas organizadas por categoría para matching de palabras clave.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'ai_ml', label: '🤖 Inteligencia Artificial & LLMs' },
              { key: 'backend', label: '⚙️ Backend & APIs' },
              { key: 'frontend', label: '🎨 Frontend & UI' },
              { key: 'cloud_devops', label: '☁️ Cloud, Docker & DevOps' },
            ].map(({ key, label }) => {
              const currentTags = techStack[key as keyof TechStackCategories] || [];
              return (
                <div
                  key={key}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 space-y-2"
                >
                  <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white font-display">
                    {label}
                  </label>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {currentTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 px-2.5 py-1 text-[11px] font-bold text-[#1e1b4b] dark:text-white shadow-2xs"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTechTag(key as keyof TechStackCategories, tag)}
                          className="text-slate-400 hover:text-rose-500 ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add Tag Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newSkillInput[key] || ''}
                      onChange={(e) =>
                        setNewSkillInput((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTechTag(key as keyof TechStackCategories);
                        }
                      }}
                      placeholder="Añadir (ej: Python) y Enter"
                      className="flex-1 rounded-lg bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 px-2.5 py-1.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
                    />
                    <button
                      type="button"
                      onClick={() => addTechTag(key as keyof TechStackCategories)}
                      className="p-1.5 rounded-lg bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BLOQUE 4: OBJETIVO PROFESIONAL & TRANSICIÓN */}
        <div
          id="section-target"
          className="bg-white dark:bg-[#111827] border border-[#1e1b4b]/10 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Target className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                4. Objetivo Profesional & Transición de Carrera
              </h2>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                Indica hacia qué puesto quieres evolucionar (ej. AI Engineer, Lead) para que la IA priorice ofertas de ese calibre.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
                Puestos / Roles Objetivo
              </label>
              <input
                type="text"
                value={targetRolesText}
                onChange={(e) => setTargetRolesText(e.target.value)}
                placeholder="AI Engineer, Full Stack Engineer, Prompt Engineer"
                className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
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
                className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
                Sectores / Industrias Preferidas
              </label>
              <input
                type="text"
                value={targetIndustries}
                onChange={(e) => setTargetIndustries(e.target.value)}
                placeholder="Fintech, SaaS de IA, Startups de Producto"
                className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
                Mercados Geográficos Preferidos
              </label>
              <input
                type="text"
                value={targetGeography}
                onChange={(e) => setTargetGeography(e.target.value)}
                placeholder="Londres, Remoto Internacional, Madrid"
                className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
              />
            </div>
          </div>
        </div>

        {/* BLOQUE 5: CRITERIOS DE CURACIÓN PARA LINKEDIN */}
        <div
          id="section-criteria"
          className="bg-white dark:bg-[#111827] border border-[#8B5CF6]/30 rounded-2xl p-6 shadow-md shadow-[#8B5CF6]/5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1e1b4b]/10 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#7c3aed] text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display">
                  5. Reglas de Puntuación & Matching para LinkedIn
                </h2>
                <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                  Define cómo debe calificar la IA las ofertas capturadas.
                </p>
              </div>
            </div>

            {curationCriteria.trim().length > 20 && (
              <button
                type="button"
                onClick={handlePolishCriteria}
                disabled={polishingCriteria}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8B5CF6] hover:text-[#6D28D9] bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 px-3 py-1 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                title="Optimiza la redacción de tus reglas para mayor precisión"
              >
                {polishingCriteria ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                )}
                <span>Pulir reglas</span>
              </button>
            )}
          </div>

          <DictationTextarea
            id="career-criteria"
            label="Reglas de búsqueda, prioridades y deal-breakers"
            value={curationCriteria}
            onChange={setCurationCriteria}
            rows={5}
            placeholder="Ej: Prioriza TypeScript, Next.js, Node y proyectos con LLMs/Gemini. Si pide más años de experiencia pero el stack encaja al 100%, dale buena puntuación. Penaliza ofertas presenciales fuera de mi ubicación y descarta consultoras cárnicas."
          />

          {constraintChips.length > 0 && (
            <div className="space-y-2 bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 rounded-xl p-3.5">
              <p className="text-[11px] font-bold text-[#8B5CF6] font-display">
                🛡️ Restricciones duras detectadas en código:
              </p>
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
            </div>
          )}

          {/* Modalidades y Salarios */}
          <div className="pt-3 border-t border-[#1e1b4b]/10 dark:border-white/10 space-y-4">
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
                      className={`text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 shadow-2xs'
                          : 'bg-[#fafafa] dark:bg-[#0b0f19] text-slate-500 border-[#1e1b4b]/10 dark:border-white/10 hover:border-slate-300'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5 inline mr-1 stroke-[2]" />}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

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
                  className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#1e1b4b] dark:text-white mb-1.5 font-display">
                  Salario Objetivo (€/año)
                </label>
                <input
                  type="number"
                  step={1000}
                  value={salaryTarget}
                  onChange={(e) => setSalaryTarget(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="45000"
                  className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Botón inferior de guardar */}
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 rounded-xl bg-[#2ECC71] hover:bg-[#27AE60] text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-98"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin stroke-[1.75]" />
            ) : (
              <Save className="w-4 h-4 stroke-[1.75]" />
            )}
            <span>{saving ? 'Guardando…' : 'Guardar perfil y criterios'}</span>
          </button>
        </div>
      </form>

      {/* Modales */}
      <AiProfileInterviewModal
        isOpen={isInterviewOpen}
        onClose={() => setIsInterviewOpen(false)}
        currentProfile={{
          bio,
          curationCriteria,
          targetRoles: targetRolesArray,
          experienceYears,
          techStack,
          keyProjects,
          targetTransition: { targetRole: targetRoleTransition, targetIndustries, targetGeography },
        }}
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
          targetTransition: { targetRole: targetRoleTransition, targetIndustries, targetGeography },
          preferredWorkplaces,
          preferredLocations,
          companyPreferences,
          salaryMin,
          salaryTarget,
          curationCriteria,
        }}
        constraintChips={constraintChips}
      />
    </div>
  );
}
