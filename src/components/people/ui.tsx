'use client';
import type { ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export const control = 'w-full min-w-0 rounded-[8px] border border-subtle bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai';
export const panel = 'rounded-[12px] border border-subtle bg-surface p-4 sm:p-6';
export function usePeopleText() { const { language } = useLanguage(); return (es: string, en: string) => language === 'es' ? es : en; }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm text-text-muted">{label}{children}</label>; }
export function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
export function statusLabel(value: string, en = false) { const pairs: Record<string, [string, string]> = { pending: ['Pendiente', 'Pending'], contacted: ['Contactado', 'Contacted'], conversation: ['En conversación', 'In conversation'], keep_in_touch: ['Mantener contacto', 'Keep in touch'], closed: ['Cerrado', 'Closed'] }; return pairs[value]?.[en ? 1 : 0] || value; }
export function kindLabel(value: string, en = false) { const pairs: Record<string, [string, string]> = { recruiter: ['Reclutador', 'Recruiter'], hiring_manager: ['Responsable de contratación', 'Hiring manager'], employee: ['Empleado', 'Employee'], executive: ['Directivo', 'Executive'], other: ['Otro', 'Other'] }; return pairs[value]?.[en ? 1 : 0] || value; }
export function relationLabel(value: string, en = false) { const pairs: Record<string, [string, string]> = { works_at: ['Trabaja en', 'Works at'], recruits_for: ['Recluta para', 'Recruits for'], unconfirmed: ['Relación sin confirmar', 'Unconfirmed relationship'] }; return pairs[value]?.[en ? 1 : 0] || value; }
export function errorLabel(code: string, en = false) {
  const pairs: Record<string, [string, string]> = {
    PEOPLE_PROFILE_EXISTS: ['Este perfil de LinkedIn ya está en Personas.', 'This LinkedIn profile is already in People.'],
    PEOPLE_REQUIRED: ['Completa los campos obligatorios.', 'Complete the required fields.'],
    PEOPLE_INVALID_LINKEDIN: ['Introduce una URL de perfil de LinkedIn válida (https://…/in/…).', 'Enter a valid LinkedIn profile URL (https://…/in/…).'],
    PEOPLE_INVALID_DATE: ['Revisa la fecha.', 'Check the date.'],
    PEOPLE_INVALID_EMAIL: ['Revisa el email profesional.', 'Check the professional email.'],
    PEOPLE_CONVERSATION_SIZE: ['El límite por importación es de 120.000 caracteres.', 'The import limit is 120,000 characters.'],
    PEOPLE_STALE_RESULT: ['El contexto ha cambiado. Genera una recomendación nueva.', 'The context changed. Generate a new recommendation.'],
    NETWORKING_CONTEXT_TOO_LARGE: ['El contexto es demasiado largo. Selecciona un hilo más corto o desmarca el CV.', 'The context is too long. Select a shorter thread or deselect the CV.'],
    NETWORKING_BUSY: ['Ya hay un trabajo en curso para esta persona.', 'A job is already running for this person.'],
    NETWORKING_NOT_CONFIGURED: ['La IA no está configurada. El original y el historial siguen guardados.', 'AI is not configured. Your original and history are still saved.'],
    NETWORKING_OPENAI_REQUIRED: ['Networking necesita un modelo OpenAI en Ajustes de IA.', 'Networking needs an OpenAI model in AI settings.'],
    NETWORKING_INVALID_RESPONSE: ['La IA devolvió una respuesta inválida. Puedes reintentarlo; los datos siguen guardados.', 'AI returned an invalid response. Retry; your data is still saved.'],
    NETWORKING_REFUSED: ['No se pudo generar esta respuesta. El historial sigue guardado.', 'This response could not be generated. Your history is still saved.'],
    TOO_MANY_REQUESTS: ['Espera un minuto antes de volver a generar.', 'Wait a minute before generating again.'],
    PEOPLE_IMPORT_ALREADY_PARSED: ['Esta importación ya está preparada. Ábrela para revisarla.', 'This import is already prepared. Open it to review.'],
  };
  return pairs[code]?.[en ? 1 : 0] || (en ? 'Could not complete the action. Your saved data is preserved; retry.' : 'No se pudo completar la acción. Los datos guardados se conservan; vuelve a intentarlo.');
}
