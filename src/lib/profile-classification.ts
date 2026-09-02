export type ProfileFamily =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'mobile'
  | 'data'
  | 'ai'
  | 'software_other'
  | 'non_software';

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
];

const SENIORITIES: ProfileSeniority[] = ['junior', 'mid', 'senior', 'unknown'];

const FRONTEND_HINTS = /\b(react|vue|angular|svelte|next\.?js|nuxt|css|html|tailwind|frontend|front-end|ui\/ux|figma)\b/i;
const BACKEND_HINTS = /\b(node\.?js|express|nestjs|django|flask|spring|laravel|rails|api\b|backend|back-end|postgresql|mysql|mongodb|graphql)\b/i;
const MOBILE_HINTS = /\b(android|ios|swift|kotlin|flutter|react native|mobile)\b/i;
const DATA_HINTS = /\b(pandas|spark|airflow|etl|tableau|power bi|data engineer|data analyst|warehouse|dbt)\b/i;
const AI_HINTS = /\b(llm|rag|openai|gemini|langchain|machine learning|deep learning|tensorflow|pytorch|nlp|prompt engineering|ai engineer)\b/i;
const SOFTWARE_HINTS = /\b(javascript|typescript|python|java|php|c\+\+|c#|golang|rust|docker|git|software|desarrollador|developer|programmer|ingenier[oa])\b/i;
const NON_SOFTWARE_HINTS = /\b(marketing|seo|sem|campaign|copywriting|social media|community manager|sales|comercial|rrhh|recursos humanos)\b/i;

export function heuristicClassifyCareerProfile(text: string): ProfileClassification {
  const dump = (text || '').trim();
  const frontend = FRONTEND_HINTS.test(dump);
  const backend = BACKEND_HINTS.test(dump);
  const mobile = MOBILE_HINTS.test(dump);
  const data = DATA_HINTS.test(dump);
  const ai = AI_HINTS.test(dump);
  const software = SOFTWARE_HINTS.test(dump) || frontend || backend || mobile || data || ai;
  const nonSoftware = NON_SOFTWARE_HINTS.test(dump);

  let family: ProfileFamily = 'software_other';
  if (software || frontend || backend || mobile || data || ai) {
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
    non_software: 'Otro perfil',
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
): InterviewQuestion[] {
  const stackHint = classification.stackHints.length
    ? classification.stackHints.slice(0, 3).join(', ')
    : 'las tecnologías que realmente usas';

  const projectQuestion =
    classification.seniority === 'junior'
      ? 'Cuéntame un proyecto (prácticas, freelance, bootcamp o personal) que mejor muestre cómo construyes software. ¿Qué hiciste tú y con qué herramientas?'
      : 'Describe un proyecto reciente del que estés orgulloso: qué problema resolviste, qué stack usaste y qué impacto tuvo (usuarios, tiempo, dinero, calidad).';

  const stackQuestion =
    classification.family === 'frontend'
      ? `¿Con qué stack de interfaz trabajas día a día (frameworks, CSS, testing)? No listes de oído: solo lo que has usado de verdad${classification.stackHints.length ? `, además de ${stackHint}` : ''}.`
      : classification.family === 'backend'
        ? `¿Con qué lenguajes, APIs y bases de datos has trabajado de verdad${classification.stackHints.length ? ` (además de ${stackHint})` : ''}?`
        : `¿Cuál es tu stack real de trabajo (lenguajes, frameworks, bases de datos, cloud)? Quédate en lo que has usado, no en lo que te gustaría ${classification.stackHints.length ? `— ya he visto indicios de ${stackHint}` : ''}.`;

  const targetQuestion =
    'Si tienes un norte profesional (rol, sector, remoto/ciudad), escríbelo. Si no, déjalo en blanco: usaremos tu experiencia actual tal cual.';

  return [
    {
      id: 'q1',
      category: 'stack',
      question: stackQuestion,
      hint: 'La IA solo podrá afirmar tecnologías que tú confirmes. Mejor poco y cierto que una lista inflada.',
      suggestedAnswers: [],
    },
    {
      id: 'q2',
      category: 'projects',
      question: projectQuestion,
      hint: 'Un caso concreto (qué hiciste + con qué + resultado) vale más que diez títulos de puesto.',
      suggestedAnswers: [],
    },
    {
      id: 'q3',
      category: 'target',
      question: targetQuestion,
      hint: 'Opcional. Si lo rellenas, el documento y el matching se orientan a ese objetivo sin inventar experiencia.',
      suggestedAnswers: [],
    },
  ];
}

export function formatCareerProfileContext(profile: any, maxChars = 3200): string {
  if (!profile || typeof profile !== 'object') return '';
  const chunks: string[] = [];
  const master = typeof profile.masterDocument === 'string' ? profile.masterDocument.trim() : '';
  const bio = typeof profile.bio === 'string' ? profile.bio.trim() : '';
  if (master) chunks.push(master.slice(0, maxChars));
  else if (bio) chunks.push(bio.slice(0, Math.min(2000, maxChars)));
  if (typeof profile.curationCriteria === 'string' && profile.curationCriteria.trim()) {
    chunks.push(`Criterios de puntuación:\n${profile.curationCriteria.trim().slice(0, 1500)}`);
  }
  return chunks.join('\n\n').trim();
}
