"use client";
import { CheckCircle2, Circle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { profileInformationProgress, type ProfileSkill, type KeyProject } from '@/lib/career-profile';
type Props = { dumpText: string; masterDocument: string; curationCriteria: string; skills?: ProfileSkill[]; keyProjects?: KeyProject[]; preferredLocations?: string; companyPreferences?: string; salaryMin?: number | '' | null; preferredWorkplaces?: string[]; onActionClick?: (section: string) => void };
export default function ProfileCompletenessBar(props: Props) {
  const { language } = useLanguage(); const es = language === 'es';
  const labels: Record<string, string> = {
    dump: es ? 'Trayectoria, formación o actividades' : 'Background, education or activities',
    skills: es ? 'Ejemplos de tu contribución' : 'Examples of your contribution',
    criteria: es ? 'Preferencias para elegir ofertas (opcional)' : 'Preferences for choosing roles (optional)',
  };
  const { items, completed, total, percent } = profileInformationProgress({ ...props, bio: props.dumpText });
  const coverage = es ? `${completed} de ${total} áreas del perfil con información` : `${completed} of ${total} profile areas have information`;
  return <section className="space-y-3 rounded-xl border border-subtle bg-surface p-5">
    <div className="flex items-start justify-between gap-3">
      <div><h3 id="profile-progress-title" className="font-display font-semibold text-text">{es ? 'Completitud del perfil' : 'Profile completeness'}</h3><p className="mt-1 text-sm text-text-muted">{coverage}</p></div>
      <span className="rounded-lg bg-surface-muted px-3 py-2 text-lg font-bold tabular-nums text-text">{percent}%</span>
    </div>
    <progress value={completed} max={total} aria-labelledby="profile-progress-title" aria-describedby="profile-progress-description" aria-valuetext={coverage} className="block h-2.5 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-surface-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-text [&::-moz-progress-bar]:bg-text">{percent}%</progress>
    <p id="profile-progress-description" className="text-sm text-text-muted">{es ? 'Muestra qué secciones tienen información. Las preferencias de búsqueda son opcionales.' : 'Shows which sections have information. Job search preferences are optional.'}</p>
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer content-center font-semibold text-text focus-visible:ring-2 focus-visible:ring-focus">{es ? 'Revisar secciones' : 'Review sections'}</summary>
      <p className="mb-2 text-text-muted">{es ? 'Añade lo que ayude a entender tu experiencia, sin un mínimo de competencias, herramientas o años.' : 'Add what helps explain your experience, with no minimum number of skills, tools or years.'}</p>
      <ul className="space-y-2">{items.map(item => <li key={item.section} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2 text-text">{item.present ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" aria-hidden="true" /> : <Circle className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />}{labels[item.section]}</span><button type="button" onClick={() => props.onActionClick?.(item.section)} className="min-h-11 shrink-0 font-semibold text-text underline underline-offset-4">{item.present ? es ? 'Revisar' : 'Review' : es ? 'Añadir' : 'Add'}</button></li>)}</ul>
    </details>
  </section>;
}
