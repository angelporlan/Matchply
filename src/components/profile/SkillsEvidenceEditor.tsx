"use client";

import { Plus, Trash2 } from 'lucide-react';
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

const inputClass =
  'w-full rounded-[8px] bg-canvas border border-control px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai min-h-11';

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

  return (
    <div className="space-y-4">
      {skills.length === 0 && (
        <p className="text-sm text-text-muted">
          Aún no hay stack. Detecta tecnologías desde tu CV o añade las que puedas defender en una entrevista.
        </p>
      )}

      <div className="space-y-3">
        {skills.map((skill, index) => (
          <div
            key={`${skill.name}-${index}`}
            className="rounded-[12px] border border-subtle bg-canvas/40 p-3 sm:p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-text mb-1.5">Tecnología</label>
                <input
                  value={skill.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  className={inputClass}
                  placeholder="TypeScript"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-text mb-1.5">Categoría</label>
                <select
                  value={skill.category}
                  onChange={(event) => update(index, { category: event.target.value as SkillCategory })}
                  className={inputClass}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {SKILL_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-text mb-1.5">Prueba</label>
                <input
                  list={`skill-evidence-${index}`}
                  value={skill.evidence || ''}
                  onChange={(event) => update(index, { evidence: event.target.value })}
                  className={inputClass}
                  placeholder="Proyecto o logro donde la usaste"
                />
                <datalist id={`skill-evidence-${index}`}>
                  {evidenceOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Nivel de ${skill.name || 'la tecnología'}`}>
                {PROFICIENCIES.map((level) => {
                  const active = skill.proficiency === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => update(index, { proficiency: level })}
                      className={`min-h-11 px-3 rounded-[8px] border text-xs font-semibold ${
                        active
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-surface text-text-muted border-subtle'
                      }`}
                    >
                      {SKILL_PROFICIENCY_LABELS[level]}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => onChange(skills.filter((_, i) => i !== index))}
                className="inline-flex min-h-11 items-center gap-1.5 px-3 rounded-[8px] text-sm font-semibold text-danger-text border border-transparent hover:border-danger-text/20"
                aria-label={`Quitar ${skill.name || 'tecnología'}`}
              >
                <Trash2 className="w-4 h-4 stroke-[1.75]" />
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text">Sugeridas desde tu texto</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((skill) => (
              <button
                key={skill.name}
                type="button"
                onClick={() => onChange(addUniqueSkill(skills, skill))}
                className="min-h-11 px-3 rounded-[8px] border border-ai/25 bg-ai/5 text-ai-text text-xs font-semibold"
              >
                + {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...skills, { name: '', category: 'other', proficiency: 'solid', evidence: '' }])}
        className="inline-flex min-h-11 items-center gap-2 px-4 rounded-[8px] border border-control bg-surface text-sm font-semibold text-text"
      >
        <Plus className="w-4 h-4 stroke-[1.75]" />
        Añadir tecnología
      </button>
    </div>
  );
}
