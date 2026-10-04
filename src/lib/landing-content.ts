import type { Language } from '@/lib/i18n/types';

const es = {
  metadata: { title: 'Matchply | Adapta tu CV a cada oferta', description: 'Importa tu CV, añade una oferta y revisa la adaptación antes de descargar tu PDF. Prueba gratis sin cuenta. Compara las opciones de PRO.' },
  nav: { how: 'Cómo funciona', pricing: 'Precios', faq: 'Preguntas', login: 'Entrar', workspace: 'Mi espacio', menu: 'Abrir navegación', close: 'Cerrar navegación', label: 'Navegación principal', skip: 'Ir al contenido', home: 'Matchply, inicio' },
  hero: {
    eyebrow: 'Una oferta concreta. Tu experiencia real.',
    headlines: { A: 'Adapta tu CV a cada oferta sin empezar de cero.', B: 'Presenta tu experiencia con un CV adaptado a cada oferta.' },
    description: 'Importa tu CV, pega una oferta y revisa la propuesta de la IA antes de descargar tu PDF. Tú decides qué cambios conservar.',
    cta: 'Probar gratis con mi oferta', workspaceCta: 'Abrir mi espacio', reassurance: 'Sin cuenta · sin tarjeta · 1 PDF de prueba', accountReassurance: 'Tu CV y tus candidaturas, en un mismo lugar',
    priceStart: 'Empieza gratis.', pricePro: 'PRO por', pricePeriod: '/mes',
  },
  how: {
    eyebrow: 'Del CV que tienes al que quieres enviar', title: 'Una candidatura, tres pasos claros.', description: 'La IA propone. Tú revisas. El resultado sigue siendo tuyo.',
    steps: [
      { title: 'Trae tu CV y tu oferta', description: 'Importa tu CV en PDF o pega el texto. Añade la vacante para trabajar con sus requisitos y tu trayectoria.' },
      { title: 'Revisa los cambios', description: 'Compara el original con la propuesta. Mejora cómo cuentas tu experiencia sin añadir habilidades ni logros que no has aportado.' },
      { title: 'Descarga y sigue tu candidatura', description: 'Obtén un PDF Harvard profesional. Conserva la oferta, el CV y el estado de la candidatura para saber qué enviaste a cada empresa.' },
    ],
    note: 'Tu experiencia es el punto de partida. El original permanece disponible para revisar los cambios.',
  },
  pricing: {
    eyebrow: 'Un precio claro, cuando lo necesites', title: 'Empieza gratis. Adapta más con PRO.', description: 'Prueba el flujo antes de decidir. Amplía tu espacio y las funciones de IA cuando tu búsqueda lo necesite.',
    free: 'Cuenta gratuita', freePrice: '0 €', freePeriod: 'sin suscripción', trial: 'La prueba sin cuenta permite hasta {cvs} CV y {pdfs} PDF. La cuenta gratuita permite {freeCvs} CV: {freeBaseCvs} base y {freeAdaptedCvs} versiones adaptadas.',
    capability: 'Qué incluye', pro: 'PRO', monthly: 'al mes',
    rows: [
      { label: 'CV guardados', free: '{freeCvs}', pro: '{proCvs}' },
      { label: 'Acciones de IA', free: '{freeAi}/mes', pro: '{proAi}/mes' },
      { label: 'Análisis de encaje', free: '{freeMatching}/mes', pro: '{proMatching}/mes' },
      { label: 'Editor y PDF Harvard', free: 'Incluidos', pro: 'Incluidos' },
      { label: 'Seguimiento de candidaturas', free: 'Incluido', pro: 'Incluido' },
      { label: 'Investigaciones profundas', free: '{freeResearch}/mes', pro: '{proResearch}/mes' },
    ],
    proDescription: 'Para preparar distintas versiones del CV y profundizar en cada oferta.',
    proFeatures: ['CV guardados: {proCvs}', '{proAi} acciones de IA al mes', '{proMatching} análisis de encaje al mes', '{proResearch} investigaciones profundas al mes'],
    cta: 'Elegir PRO · 10 €/mes', manage: 'Gestionar PRO', note: 'Suscripción mensual. Gestiona la cancelación desde tu cuenta. Pago a través de Stripe.',
  },
  faq: {
    eyebrow: 'Antes de empezar', title: 'Las dudas que conviene resolver.',
    items: [
      { question: '¿Qué puedo hacer gratis y sin registrarme?', answer: 'Puedes importar o crear tu CV, añadir una oferta, revisar la adaptación y descargar {pdfs} PDF. La prueba admite hasta {cvs} CV y dura siete días. Puedes crear una cuenta para conservar tu trabajo; la cuenta gratuita permite {freeCvs} CV: {freeBaseCvs} base y {freeAdaptedCvs} versiones adaptadas.' },
      { question: '¿Qué añade PRO por 10 €/mes?', answer: 'CV guardados: {proCvs}. PRO incluye {proAi} acciones de IA, {proMatching} análisis de encaje y {proResearch} investigaciones profundas al mes. Ambos planes usan el mismo modelo de IA. El editor, la plantilla Harvard y el seguimiento de candidaturas también están disponibles gratis.' },
      { question: '¿Puedo cancelar PRO cuando quiera?', answer: 'PRO ofrece una suscripción mensual o anual. Puedes gestionar su cancelación desde el apartado de suscripción de tu cuenta.' },
      { question: '¿La IA inventa experiencia o habilidades?', answer: 'La adaptación trabaja con la información que aportas. Puedes comparar la propuesta con tu CV original y debes revisar los cambios antes de utilizarlos. No añadas logros o habilidades que no puedas respaldar.' },
      { question: '¿Voy a superar todos los filtros ATS?', answer: 'No hay una garantía de superar un ATS, conseguir entrevistas o ser contratado. Matchply te ayuda a presentar tu experiencia con claridad y a revisar cómo encaja con los requisitos de una oferta.' },
      { question: '¿Qué ocurre con los datos de mi CV?', answer: 'Tu CV y la oferta se utilizan para la adaptación que solicitas, mediante los proveedores de IA configurados en Matchply. Revisa la política de privacidad para conocer el tratamiento de datos y tus opciones de acceso o eliminación.', linkLabel: 'Consultar privacidad' },
    ],
  },
  closing: { eyebrow: 'Tu próxima oferta, con más claridad', title: 'Compruébalo con tu propio CV.', description: 'Trae una oferta que te interese y revisa una adaptación basada en tu experiencia. Empieza por una candidatura.' },
  footer: { tagline: 'Tu experiencia, bien presentada. Cada candidatura, bajo control.', privacy: 'Privacidad', terms: 'Términos', cookies: 'Cookies', support: 'Contacto y soporte', rights: 'Todos los derechos reservados.', label: 'Información y soporte' },
};

const en: typeof es = {
  metadata: { title: 'Matchply | Tailor your resume to each job', description: 'Import your resume, add a job and review the changes before downloading your PDF. Try free without an account. Compare PRO options.' },
  nav: { how: 'How it works', pricing: 'Pricing', faq: 'Questions', login: 'Log in', workspace: 'My workspace', menu: 'Open navigation', close: 'Close navigation', label: 'Main navigation', skip: 'Skip to content', home: 'Matchply, home' },
  hero: {
    eyebrow: 'A specific job. Your real experience.',
    headlines: { A: 'Tailor your resume to each job without starting over.', B: 'Present your experience with a resume tailored to each job.' },
    description: 'Import your resume, paste a job and review the AI suggestions before downloading your PDF. You decide which changes to keep.',
    cta: 'Try free with my job', workspaceCta: 'Open my workspace', reassurance: 'No account · no card · 1 trial PDF', accountReassurance: 'Your resumes and applications, in one place',
    priceStart: 'Start free.', pricePro: 'PRO for', pricePeriod: '/month',
  },
  how: {
    eyebrow: 'From your current resume to your next application', title: 'One application, three clear steps.', description: 'AI suggests. You review. The result is still yours.',
    steps: [
      { title: 'Bring your resume and a job', description: 'Import your resume as a PDF or paste its text. Add a job to work with its requirements and your experience.' },
      { title: 'Review the changes', description: 'Compare your original with the suggestions. Improve how you describe your experience without adding skills or achievements you did not provide.' },
      { title: 'Download and track your application', description: 'Get a professional Harvard PDF. Keep the job, resume and application status together so you know what you sent to each company.' },
    ],
    note: 'Your experience is the starting point. Your original stays available to review the changes.',
  },
  pricing: {
    eyebrow: 'A clear price, when you need it', title: 'Start free. Tailor more with PRO.', description: 'Try the flow before deciding. Expand your workspace and AI tools when your search needs it.',
    free: 'Free account', freePrice: '€0', freePeriod: 'no subscription', trial: 'The trial without an account allows up to {cvs} resumes and {pdfs} PDF. Saved resumes with a free account: {freeCvs} ({freeBaseCvs} base and {freeAdaptedCvs} tailored versions).',
    capability: 'What is included', pro: 'PRO', monthly: 'per month',
    rows: [
      { label: 'Saved resumes', free: '{freeCvs}', pro: '{proCvs}' },
      { label: 'AI actions', free: '{freeAi}/month', pro: '{proAi}/month' },
      { label: 'Job matches', free: '{freeMatching}/month', pro: '{proMatching}/month' },
      { label: 'Editor and Harvard PDF', free: 'Included', pro: 'Included' },
      { label: 'Application tracking', free: 'Included', pro: 'Included' },
      { label: 'Deep research reports', free: '{freeResearch}/month', pro: '{proResearch}/month' },
    ],
    proDescription: 'For preparing different resume versions and taking a closer look at each job.',
    proFeatures: ['Saved resumes: {proCvs}', '{proAi} AI actions per month', '{proMatching} job matches per month', '{proResearch} deep research reports per month'],
    cta: 'Choose PRO · €10/month', manage: 'Manage PRO', note: 'Monthly subscription. Manage cancellation from your account. Payments through Stripe.',
  },
  faq: {
    eyebrow: 'Before you start', title: 'Questions worth answering.',
    items: [
      { question: 'What can I do free without an account?', answer: 'Import or create your resume, add a job, review the tailored version and download {pdfs} PDF. The trial allows up to {cvs} resumes and lasts seven days. Create an account to keep your work. Saved resumes with a free account: {freeCvs} ({freeBaseCvs} base and {freeAdaptedCvs} tailored versions).' },
      { question: 'What does PRO add for €10/month?', answer: 'PRO includes {proCvs} saved resumes, {proAi} AI actions, {proMatching} job matches and {proResearch} deep research reports per month. Both plans use the same AI model. The editor, Harvard template and application tracking are also available free.' },
      { question: 'Can I cancel PRO whenever I want?', answer: 'PRO offers a monthly or annual subscription. You can manage cancellation from the subscription section of your account.' },
      { question: 'Does AI invent experience or skills?', answer: 'Tailoring uses the information you provide. You can compare the suggestions with your original resume and should review changes before using them. Do not add achievements or skills you cannot support.' },
      { question: 'Will I pass every ATS filter?', answer: 'There is no guarantee of passing an ATS, getting interviews or being hired. Matchply helps you present your experience clearly and review how it fits a job’s requirements.' },
      { question: 'What happens to my resume data?', answer: 'Your resume and job description are used for the tailoring you request, through the AI providers configured in Matchply. Check the privacy policy for data handling and your access or deletion options.', linkLabel: 'Read the privacy policy' },
    ],
  },
  closing: { eyebrow: 'Your next job, with more clarity', title: 'See it with your own resume.', description: 'Bring a job you are interested in and review suggestions based on your experience. Start with one application.' },
  footer: { tagline: 'Your experience, well presented. Every application, under control.', privacy: 'Privacy', terms: 'Terms', cookies: 'Cookies', support: 'Contact and support', rights: 'All rights reserved.', label: 'Information and support' },
};

export type LandingContent = typeof es;
export const landingContent: Record<Language, LandingContent> = { es, en };

export function landingLimitText(text: string, limits: Record<string, string | number>) {
  return text.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, key: string) => key in limits ? String(limits[key]) : placeholder);
}
