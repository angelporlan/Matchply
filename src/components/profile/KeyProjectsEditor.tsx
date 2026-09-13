"use client";

import { Plus, Trash2 } from 'lucide-react';
import { EMPTY_PROJECT, type KeyProject } from '@/lib/career-profile';

const inputClass =
  'w-full rounded-[8px] bg-canvas border border-control px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai min-h-11';

type KeyProjectsEditorProps = {
  projects: KeyProject[];
  onChange: (projects: KeyProject[]) => void;
};

export default function KeyProjectsEditor({ projects, onChange }: KeyProjectsEditorProps) {
  const update = (index: number, patch: Partial<KeyProject>) => {
    onChange(projects.map((project, i) => (i === index ? { ...project, ...patch } : project)));
  };

  return (
    <div className="space-y-4">
      {projects.length === 0 && (
        <p className="text-sm text-text-muted">
          Añade 1–3 casos con resultado. Sirven para el match, el CV adaptado y las entrevistas.
        </p>
      )}

      {projects.map((project, index) => (
        <div key={`${project.title}-${index}`} className="rounded-[12px] border border-subtle bg-canvas/40 p-3 sm:p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-bold text-text">Proyecto {index + 1}</p>
            <button
              type="button"
              onClick={() => onChange(projects.filter((_, i) => i !== index))}
              className="inline-flex min-h-11 items-center gap-1.5 px-3 rounded-[8px] text-sm font-semibold text-danger-text"
              aria-label={`Quitar ${project.title || `proyecto ${index + 1}`}`}
            >
              <Trash2 className="w-4 h-4 stroke-[1.75]" />
              Quitar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">Nombre</label>
              <input
                value={project.title}
                onChange={(event) => update(index, { title: event.target.value })}
                className={inputClass}
                placeholder="Matchply"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">Rol</label>
              <input
                value={project.role || ''}
                onChange={(event) => update(index, { role: event.target.value })}
                className={inputClass}
                placeholder="Full Stack, fundador…"
              />
            </div>
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
              placeholder="Problema, qué construiste tú y con qué."
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
        onClick={() => onChange([...projects, { ...EMPTY_PROJECT }])}
        className="inline-flex min-h-11 items-center gap-2 px-4 rounded-[8px] border border-control bg-surface text-sm font-semibold text-text"
      >
        <Plus className="w-4 h-4 stroke-[1.75]" />
        Añadir proyecto
      </button>
    </div>
  );
}
