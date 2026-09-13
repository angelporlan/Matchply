"use client";

import { ArrowRightLeft, Plus, Trash2 } from 'lucide-react';
import {
  EMPTY_EXPERIENCE,
  EMPTY_PROJECT,
  type KeyProject,
  type ProfileEntryKind,
} from '@/lib/career-profile';

const inputClass =
  'w-full rounded-[8px] bg-canvas border border-control px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai min-h-11';

const COPY: Record<ProfileEntryKind, {
  empty: string;
  add: string;
  item: string;
  title: string;
  titlePlaceholder: string;
  rolePlaceholder: string;
  descriptionPlaceholder: string;
  move: string;
}> = {
  experience: {
    empty: 'Añade las empresas donde has trabajado: puesto, stack y un resultado concreto.',
    add: 'Añadir puesto',
    item: 'Puesto',
    title: 'Empresa',
    titlePlaceholder: 'Acme Corp',
    rolePlaceholder: 'Full Stack Developer',
    descriptionPlaceholder: 'Qué hiciste en el día a día y con qué tecnologías.',
    move: 'Mover a proyectos',
  },
  project: {
    empty: 'Añade proyectos propios o freelance: qué construiste, con qué y qué cambió.',
    add: 'Añadir proyecto',
    item: 'Proyecto',
    title: 'Nombre',
    titlePlaceholder: 'Matchply',
    rolePlaceholder: 'Fundador, Full Stack…',
    descriptionPlaceholder: 'Problema, qué construiste tú y con qué.',
    move: 'Mover a experiencia',
  },
};

type KeyProjectsEditorProps = {
  kind: ProfileEntryKind;
  projects: KeyProject[];
  onChange: (projects: KeyProject[]) => void;
};

export default function KeyProjectsEditor({ kind = 'project', projects, onChange }: KeyProjectsEditorProps) {
  const copy = COPY[kind] || COPY.project;
  const otherKind: ProfileEntryKind = kind === 'experience' ? 'project' : 'experience';

  const update = (index: number, patch: Partial<KeyProject>) => {
    onChange(projects.map((project, i) => (i === index ? { ...project, kind, ...patch } : project)));
  };

  return (
    <div className="space-y-4">
      {projects.length === 0 && (
        <p className="text-sm text-text-muted">{copy.empty}</p>
      )}

      {projects.map((project, index) => (
        <div key={`${project.title}-${index}`} className="rounded-[12px] border border-subtle bg-canvas/40 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs font-bold text-text">{copy.item} {index + 1}</p>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => update(index, { kind: otherKind })}
                className="inline-flex min-h-11 items-center gap-1.5 px-3 rounded-[8px] text-sm font-semibold text-text-muted"
              >
                <ArrowRightLeft className="w-4 h-4 stroke-[1.75]" />
                {copy.move}
              </button>
              <button
                type="button"
                onClick={() => onChange(projects.filter((_, i) => i !== index))}
                className="inline-flex min-h-11 items-center gap-1.5 px-3 rounded-[8px] text-sm font-semibold text-danger-text"
                aria-label={`Quitar ${project.title || `${copy.item} ${index + 1}`}`}
              >
                <Trash2 className="w-4 h-4 stroke-[1.75]" />
                Quitar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">{copy.title}</label>
              <input
                value={project.title}
                onChange={(event) => update(index, { title: event.target.value })}
                className={inputClass}
                placeholder={copy.titlePlaceholder}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">Puesto / rol</label>
              <input
                value={project.role || ''}
                onChange={(event) => update(index, { role: event.target.value })}
                className={inputClass}
                placeholder={copy.rolePlaceholder}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Periodo</label>
            <input
              value={project.period || ''}
              onChange={(event) => update(index, { period: event.target.value })}
              className={inputClass}
              placeholder={kind === 'experience' ? 'Abril 2025 – Presente' : '2025 – Presente'}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Stack usado</label>
            <input
              value={project.techStack || ''}
              onChange={(event) => update(index, { techStack: event.target.value })}
              className={inputClass}
              placeholder="TypeScript, Node.js, Docker…"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Qué hiciste</label>
            <textarea
              value={project.description}
              onChange={(event) => update(index, { description: event.target.value })}
              rows={3}
              className={`${inputClass} min-h-[5.5rem]`}
              placeholder={copy.descriptionPlaceholder}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text mb-1.5">Impacto</label>
            <input
              value={project.impact || ''}
              onChange={(event) => update(index, { impact: event.target.value })}
              className={inputClass}
              placeholder="Ej: 15 h/semana menos, usuarios de pago, 50% menos latencia"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...projects, { ...(kind === 'experience' ? EMPTY_EXPERIENCE : EMPTY_PROJECT) }])}
        className="inline-flex min-h-11 items-center gap-2 px-4 rounded-[8px] border border-control bg-surface text-sm font-semibold text-text"
      >
        <Plus className="w-4 h-4 stroke-[1.75]" />
        {copy.add}
      </button>
    </div>
  );
}
