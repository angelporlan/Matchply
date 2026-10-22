export type ProfileFamily =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'mobile'
  | 'data'
  | 'ai'
  | 'software_other'
  | 'non_software'
  | 'unknown';

export type ProfileSeniority = 'junior' | 'mid' | 'senior' | 'unknown';

export type ProfileClassification = {
  family: ProfileFamily;
  seniority: ProfileSeniority;
  inferredTargetRole: string | null;
  stackHints: string[];
  summary: string;
};

export type InterviewQuestion = {
  id: string;
  category: string;
  question: string;
  hint: string;
  suggestedAnswers: string[];
};

const FAMILIES: ProfileFamily[] = [
  'frontend',
  'backend',
  'fullstack',
  'mobile',
  'data',
  'ai',
  'software_other',
  'non_software',
  'unknown',
];

const SENIORITIES: ProfileSeniority[] = ['junior', 'mid', 'senior', 'unknown'];

const FRONTEND_HINTS = /\b(react|vue|angular|svelte|next\.?js|nuxt|css|html|tailwind|frontend|front-end|ui\/ux|figma)\b/i;
const BACKEND_HINTS = /\b(node\.?js|express|nestjs|django|flask|spring|laravel|rails|api\b|backend|back-end|postgresql|mysql|mongodb|graphql)\b/i;
const MOBILE_HINTS = /\b(android|ios|swift|kotlin|flutter|react native|mobile)\b/i;
const DATA_HINTS = /\b(pandas|spark|airflow|etl|tableau|power bi|data engineer|data analyst|warehouse|dbt)\b/i;
const AI_HINTS = /\b(llm|rag|openai|gemini|langchain|machine learning|deep learning|tensorflow|pytorch|nlp|prompt engineering|ai engineer)\b/i;
const SOFTWARE_HINTS = /\b(javascript|typescript|python|java|php|c\+\+|c#|golang|rust|docker|git|software|desarrollador|developer|programmer)\b/i;
const NON_SOFTWARE_HINTS = /\b(marketing|seo|sem|campaign|copywriting|social media|community manager|sales|comercial|rrhh|recursos humanos|administrativ[oa]|administration|enfermer[oa]|nurse|sanidad|healthcare|docente|teacher|teaching|electricista|electrician|fontaner[oa]|plumber)\b/i;

export function heuristicClassifyCareerProfile(text: string): ProfileClassification {
  const dump = (text || '').trim();
  const frontend = FRONTEND_HINTS.test(dump);
  const backend = BACKEND_HINTS.test(dump);
  const mobile = MOBILE_HINTS.test(dump);
  const data = DATA_HINTS.test(dump);
  const ai = AI_HINTS.test(dump);
  const software = SOFTWARE_HINTS.test(dump) || frontend || backend || mobile || data || ai;
  const nonSoftware = NON_SOFTWARE_HINTS.test(dump);
  const softwareRole = /\b(desarrollador|developer|programmer|ingenier[oa] de software|software engineer|frontend|backend|full[ -]?stack|data analyst|data engineer|ai engineer|mobile developer|mobile engineer)\b/i.test(dump);

  let family: ProfileFamily = 'unknown';
  if (nonSoftware && !softwareRole) {
    family = 'non_software';
  } else if (software && softwareRole) {
    if (ai && !frontend && !backend && !mobile) family = 'ai';
    else if (mobile && !frontend && !backend) family = 'mobile';
    else if (data && !frontend && !backend) family = 'data';
    else if (frontend && backend) family = 'fullstack';
    else if (frontend) family = 'frontend';
    else if (backend) family = 'backend';
    else family = 'software_other';
  } else if (nonSoftware) {
    family = 'non_software';
  }

  let seniority: ProfileSeniority = 'unknown';
  if (/\b(pr[aá]ctic[ao]s|becari[oa]| intern\b|junior|jr\.?|sin experiencia|bootcamp)\b/i.test(dump)) {
    seniority = 'junior';
  } else if (/\b(senior|staff|principal|lead|tech lead|10\+?\s*a[nñ]os|15\s*a[nñ]os)\b/i.test(dump)) {
    seniority = 'senior';
  } else if (/\b([3-9]\s*a[nñ]os|mid[- ]?level|intermedio)\b/i.test(dump)) {
    seniority = 'mid';
  }

  const stackHints = Array.from(
    dump.matchAll(/\b(TypeScript|JavaScript|Python|Java|PHP|Go|Rust|React|Vue|Angular|Next\.js|Node\.js|Laravel|Django|Spring|Docker|PostgreSQL|MySQL|AWS|GCP|Azure|Swift|Kotlin|Flutter)\b/gi),
  ).map((match) => match[0]);

  const uniqueStack = Array.from(new Set(stackHints)).slice(0, 8);

  return {
    family,
    seniority,
    inferredTargetRole: null,
    stackHints: uniqueStack,
    summary: summarizeClassification({ family, seniority, inferredTargetRole: null, stackHints: uniqueStack, summary: '' }),
  };
}

export function normalizeClassification(
  raw: Partial<ProfileClassification> | null | undefined,
  fallbackText = '',
): ProfileClassification {
  const heuristic = heuristicClassifyCareerProfile(fallbackText);
  const family = FAMILIES.includes(raw?.family as ProfileFamily)
    ? (raw!.family as ProfileFamily)
    : heuristic.family;
  const seniority = SENIORITIES.includes(raw?.seniority as ProfileSeniority)
    ? (raw!.seniority as ProfileSeniority)
    : heuristic.seniority;
  const inferredTargetRole =
    typeof raw?.inferredTargetRole === 'string' && raw.inferredTargetRole.trim()
      ? raw.inferredTargetRole.trim()
      : null;
  const stackHints = Array.isArray(raw?.stackHints) && raw.stackHints.length
    ? raw.stackHints.map(String).slice(0, 8)
    : heuristic.stackHints;

  const classification: ProfileClassification = {
    family,
    seniority,
    inferredTargetRole,
    stackHints,
    summary: '',
  };
  classification.summary = typeof raw?.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : summarizeClassification(classification);
  return classification;
}

function summarizeClassification(classification: ProfileClassification): string {
  const familyLabel: Record<ProfileFamily, string> = {
    frontend: 'Frontend',
    backend: 'Backend',
    fullstack: 'Full Stack',
    mobile: 'Mobile',
    data: 'Datos',
    ai: 'IA / ML',
    software_other: 'Software',
    non_software: 'Perfil profesional',
    unknown: 'Por determinar',
  };
  const seniorityLabel: Record<ProfileSeniority, string> = {
    junior: 'junior',
    mid: 'mid',
    senior: 'senior',
    unknown: '',
  };
  const bits = [familyLabel[classification.family]];
  if (seniorityLabel[classification.seniority]) bits.push(seniorityLabel[classification.seniority]);
  if (classification.inferredTargetRole) bits.push(`objetivo: ${classification.inferredTargetRole}`);
  return bits.join(' · ');
}

export function genericSoftwareInterviewQuestions(
  classification: ProfileClassification,
  language: 'es' | 'en' = 'es',
): InterviewQuestion[] {
  const es = language === 'es';
  return [
    { id: 'q1', category: 'skills', question: es ? '¿Qué competencias o métodos has utilizado realmente y en qué contexto?' : 'Which skills or methods have you actually used, and in what context?', hint: es ? 'Puedes incluir trabajo, formación, prácticas o voluntariado. Las herramientas son opcionales.' : 'Include employment, training, placements or volunteering. Tools are optional.', suggestedAnswers: [] },
    { id: 'q2', category: 'experience', question: es ? 'Describe una situación concreta: qué necesitaba resolverse, qué hiciste tú y cuál fue el resultado conocido.' : 'Describe a specific situation: what was needed, what you did and the known outcome.', hint: es ? 'No necesitas una cifra si no se midió. Distingue tu contribución de la del equipo.' : 'No number is needed if none was measured. Separate your contribution from the team’s.', suggestedAnswers: [] },
    { id: 'q3', category: 'target', question: es ? 'Si tienes un objetivo profesional o condiciones preferidas, puedes indicarlos. Es opcional.' : 'If you have a career goal or preferred conditions, you may add them. This is optional.', hint: es ? 'Un objetivo no acredita experiencia.' : 'A goal does not establish experience.', suggestedAnswers: [] },
  ];
}

export { formatCareerProfileContext } from './career-profile';
