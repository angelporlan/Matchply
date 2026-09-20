"use client";

import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code2,
  Database,
  Plus,
  Server,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  SKILL_CATEGORY_LABELS,
  SKILL_PROFICIENCY_LABELS,
  addUniqueSkill,
  type ProfileSkill,
  type SkillCategory,
  type SkillProficiency,
} from '@/lib/career-profile';

const CATEGORIES = Object.keys(SKILL_CATEGORY_LABELS) as SkillCategory[];
const PROFICIENCIES = Object.keys(SKILL_PROFICIENCY_LABELS) as SkillProficiency[];

const CATEGORY_ICONS: Record<SkillCategory, React.ComponentType<{ className?: string }>> = {
  frontend: Code2,
  backend: Server,
  ai_ml: Sparkles,
  cloud_devops: Cloud,
  database: Database,
  other: Terminal,
};

type SkillsEvidenceEditorProps = {
  skills: ProfileSkill[];
  evidenceOptions: string[];
  suggestions?: ProfileSkill[];
  onChange: (skills: ProfileSkill[]) => void;
};

export default function SkillsEvidenceEditor({
  skills,
  evidenceOptions,
  suggestions = [],
  onChange,
}: SkillsEvidenceEditorProps) {
  const update = (index: number, patch: Partial<ProfileSkill>) => {
    onChange(skills.map((skill, i) => (i === index ? { ...skill, ...patch } : skill)));
  };

  const remove = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  const add = (category: SkillCategory = 'other') => {
    onChange([
      ...skills,
      { name: '', category, proficiency: 'solid', evidence: '' },
    ]);
    setExpandedCats((prev) => ({ ...prev, [category]: true }));
  };

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const map = new Map<SkillCategory, Array<{ skill: ProfileSkill; index: number }>>();
    CATEGORIES.forEach((cat) => map.set(cat, []));
    skills.forEach((skill, index) => {
      const list = map.get(skill.category) || [];
      list.push({ skill, index });
      map.set(skill.category, list);
    });
    return map;
  }, [skills]);

  // Initial state: todas las categorías plegadas por defecto
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CATEGORIES.forEach((cat) => {
      initial[cat] = false;
    });
    return initial;
  });

  const toggleCategory = (cat: SkillCategory) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const allOpen = CATEGORIES.length > 0 && CATEGORIES.every((c) => Boolean(expandedCats[c]));

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => (next[c] = !allOpen));
    setExpandedCats(next);
  };

  const totalWithEvidence = skills.filter((s) => s.evidence && s.evidence.trim().length > 0).length;

  return (
    <div className="space-y-4 font-sans">
      {/* Barra superior de métricas y acción de expandir/colapsar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 text-xs">
        <span className="text-text-muted font-medium">
          <strong className="font-bold text-text">{skills.length}</strong> tecnologías registradas ·{' '}
          <strong className="font-bold text-emerald-600 dark:text-emerald-400">{totalWithEvidence}</strong> con prueba vinculada
        </span>

        <button
          type="button"
          onClick={toggleAll}
          className="text-ai hover:underline font-semibold self-start sm:self-auto font-display text-xs"
        >
          {allOpen ? 'Colapsar todas' : 'Expandir todas'}
        </button>
      </div>

      {skills.length === 0 && (
        <div className="p-6 rounded-[12px] border border-dashed border-subtle bg-canvas/40 text-center space-y-1">
          <p className="text-sm font-bold text-text font-display">Aún no has añadido tecnologías</p>
          <p className="text-xs text-text-muted">
            Detecta tu stack desde tu CV con el botón superior o despliega una categoría para añadirla manualmente.
          </p>
        </div>
      )}

      {/* Lista de Acordeones por Categoría */}
      <div className="space-y-2.5">
        {CATEGORIES.map((category) => {
          const catSkills = skillsByCategory.get(category) || [];
          const isExpanded = !!expandedCats[category];
          const Icon = CATEGORY_ICONS[category] || Terminal;
          const evidenceCount = catSkills.filter(
            (s) => s.skill.evidence && s.skill.evidence.trim().length > 0
          ).length;

          return (
            <div
              key={category}
              className="rounded-xl border border-subtle bg-canvas/30 overflow-hidden transition-all shadow-2xs"
            >
              {/* Cabecera del Acordeón */}
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between gap-3 p-3.5 bg-surface hover:bg-canvas/50 transition-colors text-left select-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-ai/10 text-ai flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text font-display">
                        {SKILL_CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-canvas border border-subtle text-text-muted font-sans">
                        {catSkills.length}
                      </span>
                      {catSkills.length > 0 && evidenceCount === catSkills.length && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-sans">
                          <Check className="w-3 h-3 stroke-[2]" /> Todas probadas
                        </span>
                      )}
                    </div>

                    {/* Mini preview de nombres cuando está colapsado */}
                    {!isExpanded && catSkills.length > 0 && (
                      <p className="text-[11px] text-text-muted truncate mt-0.5 font-sans">
                        {catSkills.map((s) => s.skill.name).filter(Boolean).slice(0, 6).join(' · ')}
                        {catSkills.length > 6 ? ` y ${catSkills.length - 6} más` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-text-muted font-sans hidden sm:inline">
                    {evidenceCount}/{catSkills.length} probadas
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-muted stroke-[2]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted stroke-[2]" />
                  )}
                </div>
              </button>

              {/* Contenido Expandido */}
              {isExpanded && (
                <div className="p-3.5 border-t border-subtle space-y-2 bg-canvas/15">
                  {catSkills.length === 0 ? (
                    <p className="text-xs text-text-muted italic py-1">
                      No hay tecnologías registradas en {SKILL_CATEGORY_LABELS[category]}.
                    </p>
                  ) : (
                    catSkills.map(({ skill, index }) => (
                      <div
                        key={`${category}-${index}`}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 rounded-lg bg-surface border border-subtle hover:border-ai/30 transition-colors shadow-2xs items-center"
                      >
                        {/* Nombre */}
                        <div className="sm:col-span-4">
                          <input
                            value={skill.name}
                            onChange={(e) => update(index, { name: e.target.value })}
                            placeholder="Nombre (ej: TypeScript)"
                            className="w-full px-2.5 py-1.5 rounded-md bg-canvas border border-control text-xs font-bold text-text focus:outline-none focus:border-ai"
                          />
                        </div>

                        {/* Nivel de Dominio */}
                        <div className="sm:col-span-3 flex items-center gap-0.5 bg-canvas p-0.5 rounded-md border border-subtle justify-center">
                          {PROFICIENCIES.map((lvl) => {
                            const active = skill.proficiency === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => update(index, { proficiency: lvl })}
                                className={`px-2 py-1 rounded text-[10.5px] font-semibold flex-1 text-center transition-all ${
                                  active
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30'
                                    : 'text-text-muted hover:text-text'
                                }`}
                              >
                                {SKILL_PROFICIENCY_LABELS[lvl]}
                              </button>
                            );
                          })}
                        </div>

                        {/* Prueba o Proyecto de Uso */}
                        <div className="sm:col-span-4">
                          <input
                            list={`evidence-cat-${index}`}
                            value={skill.evidence || ''}
                            onChange={(e) => update(index, { evidence: e.target.value })}
                            placeholder="Proyecto o prueba de uso..."
                            className="w-full px-2.5 py-1.5 rounded-md bg-canvas border border-control text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai"
                          />
                          <datalist id={`evidence-cat-${index}`}>
                            {evidenceOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </div>

                        {/* Eliminar */}
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            title={`Eliminar ${skill.name || 'tecnología'}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 stroke-[1.75]" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={() => add(category)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-ai hover:underline pt-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Añadir a {SKILL_CATEGORY_LABELS[category]}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sugerencias detectadas desde el texto libre */}
      {suggestions.length > 0 && (
        <div className="p-4 rounded-xl border border-dashed border-ai/30 bg-ai/5 space-y-2">
          <p className="text-xs font-bold text-ai uppercase tracking-wider font-display">
            Sugerencias detectadas en tu texto:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((skill) => (
              <button
                key={skill.name}
                type="button"
                onClick={() => onChange(addUniqueSkill(skills, skill))}
                className="px-2.5 py-1 rounded-lg border border-ai/25 bg-surface text-ai-text text-xs font-semibold hover:border-ai hover:bg-ai/10 transition-colors"
              >
                + {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
