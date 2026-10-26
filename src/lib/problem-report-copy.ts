import type { ErrorStep } from '@/lib/diagnostics-schema';
export const reportSteps: Record<ErrorStep, [string, string]> = {
  page: ['Navegación', 'Navigation'], 'cv-import': ['Añadir CV', 'Add resume'], 'offer-import': ['Añadir oferta', 'Add job offer'],
  optimization: ['Adaptar CV', 'Tailor resume'], 'pdf-download': ['Descargar PDF', 'Download PDF'],
  registration: ['Crear cuenta', 'Create account'], editor: ['Editar CV', 'Edit resume'], unknown: ['Otro paso', 'Other step'],
};
export const reportStepLabel = (step: string, language: string) => reportSteps[step as ErrorStep]?.[language === 'en' ? 1 : 0] || reportSteps.unknown[language === 'en' ? 1 : 0];
