"use client";
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { profileInformationChecklist, type ProfileSkill, type KeyProject } from '@/lib/career-profile';
type Props = { dumpText: string; masterDocument: string; curationCriteria: string; skills?: ProfileSkill[]; keyProjects?: KeyProject[]; preferredLocations?: string; companyPreferences?: string; salaryMin?: number | '' | null; preferredWorkplaces?: string[]; onActionClick?: (section: string) => void };
export default function ProfileCompletenessBar(props: Props) {
  const { language } = useLanguage(); const es = language === 'es';
  const labels: Record<string, string> = {
    dump: es ? 'Trayectoria, formación o actividades' : 'Background, education or activities',
    skills: es ? 'Ejemplos de tu contribución' : 'Examples of your contribution',
    criteria: es ? 'Preferencias para elegir ofertas (opcional)' : 'Preferences for choosing roles (optional)',
  };
  const items = profileInformationChecklist({ ...props, bio: props.dumpText });
  return <section className="space-y-3 rounded-xl border border-subtle bg-surface p-5"><h3 className="font-display font-semibold">{es ? 'Información de tu perfil' : 'Your profile information'}</h3><p className="text-sm text-text-muted">{es ? 'Añade lo que permita entender tu experiencia. No necesitas un número de competencias, herramientas ni años de empleo.' : 'Add what helps explain your experience. No fixed number of skills, tools or years of employment is required.'}</p><ul className="space-y-2">{items.map(item => <li key={item.section} className="flex items-center justify-between gap-3 text-sm"><span>{labels[item.section]}</span><button type="button" onClick={() => props.onActionClick?.(item.section)} className="min-h-11 shrink-0 font-semibold underline underline-offset-4">{item.present ? es ? 'Disponible · revisar' : 'Available · review' : es ? 'Añadir' : 'Add'}</button></li>)}</ul></section>;
}
