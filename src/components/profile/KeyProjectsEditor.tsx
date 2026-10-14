"use client";

import { useState } from 'react';
import { ArrowRightLeft, Pencil, Plus, Trash2 } from 'lucide-react';
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

function stackTags(value?: string) {
  return (value || '').split(/[,;·]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
}

function isBlank(project: KeyProject) {
  return ![project.title, project.role, project.period, project.techStack, project.description, project.impact]
    .some((value) => (value || '').trim());
}

export default function KeyProjectsEditor({ kind = 'project', projects, onChange }: KeyProjectsEditorProps) {
  const copy = COPY[kind] || COPY.project;
  const otherKind: ProfileEntryKind = kind === 'experience' ? 'project' : 'experience';
  const [editing, setEditing] = useState<number | null>(null);
  const openIndex = editing !== null && projects[editing] ? editing : null;

  const update = (index: number, patch: Partial<KeyProject>) => {
    onChange(projects.map((project, i) => (i === index ? { ...project, kind, ...patch } : project)));
  };

  const closeEditor = (index: number) => {
    if (isBlank(projects[index])) onChange(projects.filter((_, i) => i !== index));
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      {projects.length === 0 && (
        <p className="text-sm text-text-muted">{copy.empty}</p>
      )}

      {projects.map((project, index) => {
        const title = project.title.trim() || `Sin ${copy.title.toLowerCase()}`;
        const summary = (project.description || project.impact || '').trim();
        const tags = stackTags(project.techStack);
        if (openIndex !== index) {
          return (
            <article key={`${kind}-${index}`} className="rounded-[12px] border border-subtle bg-canvas/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text">
                    <span className="font-semibold">{title}</span>
                    {project.role?.trim() && (
                      <span className="text-text-muted"> — <span className="italic">{project.role.trim()}</span></span>
                    )}
                  </p>
                  {project.period?.trim() && (
                    <p className="mt-0.5 text-xs text-text-muted">{project.period.trim()}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(index)}
                  aria-label={`Editar ${title}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-text-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <Pencil className="h-4 w-4 stroke-[1.75]" />
                </button>
              </div>
              {summary && <p className="mt-2 line-clamp-2 text-sm text-text-muted">{summary}</p>}
              {tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <li key={tag} className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text">{tag}</li>
                  ))}
                </ul>
              )}
            </article>
          );
        }

        return (
          <div key={`${kind}-${index}`} className="rounded-[12px] border border-ai/30 bg-canvas/40 p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-xs font-bold text-text">{copy.item} {index + 1}</p>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    update(index, { kind: otherKind });
                    setEditing(null);
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 px-3 rounded-[8px] text-sm font-semibold text-text-muted"
                >
                  <ArrowRightLeft className="w-4 h-4 stroke-[1.75]" />
                  {copy.move}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(projects.filter((_, i) => i !== index));
                    setEditing(null);
                  }}
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
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => closeEditor(index)}
                className="inline-flex min-h-11 items-center px-4 rounded-[8px] border border-control bg-surface text-sm font-semibold text-text"
              >
                Listo
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => {
          onChange([...projects, { ...(kind === 'experience' ? EMPTY_EXPERIENCE : EMPTY_PROJECT) }]);
          setEditing(projects.length);
        }}
        className="inline-flex min-h-11 items-center gap-2 px-4 rounded-[8px] border border-control bg-surface text-sm font-semibold text-text"
      >
        <Plus className="w-4 h-4 stroke-[1.75]" />
        {copy.add}
      </button>
    </div>
  );
}
