export type OfferLanguage = 'en' | 'es' | 'mixed' | 'unknown';
export type ConstraintLanguage = 'en' | 'es';
export type LanguagePolicy = 'reject' | 'penalize';

export type HardConstraints = {
  language?: {
    rejectOfferLanguage?: ConstraintLanguage[];
    penalizeOfferLanguage?: Array<{ lang: ConstraintLanguage; maxScore: number }>;
  };
  dealBreakers?: string[];
};

export const LANGUAGE_REJECT_MAX_SCORE = 30;
export const LANGUAGE_PENALIZE_MAX_SCORE = 40;

const EN_STOPWORDS = new Set([
  'the', 'and', 'with', 'this', 'that', 'from', 'your', 'our', 'will', 'are',
  'have', 'been', 'for', 'not', 'you', 'they', 'their', 'about', 'into', 'more',
  'we', 'is', 'on', 'to', 'of', 'in', 'or', 'as', 'be', 'by', 'an', 'at',
  'role', 'team', 'work', 'experience', 'requirements', 'responsibilities',
  'looking', 'join', 'skills', 'must', 'should', 'ability',
]);

const ES_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'una', 'un', 'para', 'con', 'por',
  'que', 'se', 'su', 'es', 'en', 'al', 'lo', 'como', 'más', 'mas', 'una',
  'tus', 'nuestra', 'nuestro', 'buscamos', 'experiencia', 'requisitos',
  'responsabilidades', 'equipo', 'puesto', 'oferta', 'jornada', 'contrato',
]);

const EN_TITLE_HINT =
  /\b(software engineer|staff engineer|engineering manager|backend engineer|frontend engineer|full[-\s]?stack engineer|product manager|data scientist|machine learning engineer|internship|intern\b|research intern)\b/i;

const EN_TITLE_WEAK = /\b(engineer|developers?|scientist|internship|intern)\b/i;

const ES_TITLE_HINT =
  /\b(ingenier[oa]|desarrollador(?:a)?|pr[aá]cticas|becari[oa]|analista|oferta de empleo)\b/i;

const SPANISH_AS_PLUS =
  /\b(spanish\s+(?:is\s+)?(?:a\s+)?plus|spanish\s+(?:nice|good)\s+to\s+have|se\s+valorar[aá](?:n)?\s+(?:el\s+)?espa[nñ]ol|espa[nñ]ol\s+ser[aá]\s+un\s+plus)\b/i;

const EN_LANGUAGE_WORD = /\b(ingl[eé]s|english)\b/i;
const ES_LANGUAGE_WORD = /\b(espa[nñ]ol|spanish|castellano)\b/i;

const REJECT_VERB =
  /\b(descarta(?:r)?|rechaza(?:r)?|elimina(?:r)?|reject|discard|exclude|evita(?:r)?|no\s+quiero|no\s+consideres|no\s+me\s+interesa)\b/i;

const PENALIZE_HINT =
  /\b(penaliz[aeá]|penalize|penalise|puntuaciones?\s+(?:muy\s+)?altas|high\s+scores?)\b|\bno\s+.{0,80}\b(?:muy\s+)?(?:alt[oa]s?|high)\b/i;

const SOLO_SPANISH =
  /\b(?:solo|s[oó]lo|solamente|unicamente|únicamente|only)\s+(?:en\s+)?(?:espa[nñ]ol|spanish|castellano)\b/i;

const SOLO_ENGLISH =
  /\b(?:only|solo|s[oó]lo)\s+(?:in\s+)?(?:english|ingl[eé]s)\b/i;

const LANGUAGE_RULE_LINE =
  /ingl[eé]s|english|espa[nñ]ol|spanish|castellano|idioma|language/i;

function uniquePush<T>(list: T[], value: T, equals: (a: T, b: T) => boolean) {
  if (!list.some((item) => equals(item, value))) {
    list.push(value);
  }
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n;]+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[\s\-*$•\d.)]+/, '').trim())
    .filter((line) => line.length >= 8);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z]{2,}/g) || [];
}

function countStopwords(tokens: string[], lexicon: Set<string>): number {
  let count = 0;
  for (const token of tokens) {
    if (lexicon.has(token)) count += 1;
  }
  return count;
}

function metadataText(sourceMetadata: unknown): string {
  if (!sourceMetadata || typeof sourceMetadata !== 'object') return '';
  const meta = sourceMetadata as Record<string, unknown>;
  return [meta.location, meta.workplaceType, meta.employmentType]
    .filter((value) => typeof value === 'string')
    .join(' ');
}

export function parseHardConstraints(input: {
  curationCriteria?: string | null;
  bio?: string | null;
}): HardConstraints {
  const text = (input.curationCriteria || '').trim();
  if (!text) return {};

  const rejectOfferLanguage: ConstraintLanguage[] = [];
  const penalizeOfferLanguage: Array<{ lang: ConstraintLanguage; maxScore: number }> = [];
  const dealBreakers: string[] = [];

  const applyLanguagePolicy = (lang: ConstraintLanguage, policy: LanguagePolicy) => {
    if (policy === 'reject') {
      uniquePush(rejectOfferLanguage, lang, (a, b) => a === b);
      const idx = penalizeOfferLanguage.findIndex((item) => item.lang === lang);
      if (idx >= 0) penalizeOfferLanguage.splice(idx, 1);
      return;
    }
    if (rejectOfferLanguage.includes(lang)) return;
    uniquePush(
      penalizeOfferLanguage,
      { lang, maxScore: LANGUAGE_PENALIZE_MAX_SCORE },
      (a, b) => a.lang === b.lang,
    );
  };

  const considerSentence = (sentence: string) => {
    const mentionsEn = EN_LANGUAGE_WORD.test(sentence);
    const mentionsEs = ES_LANGUAGE_WORD.test(sentence);
    const hasPenalize = PENALIZE_HINT.test(sentence);
    const hasReject = REJECT_VERB.test(sentence);
    const noPlusLanguage = /\bno\b.{0,100}\b(ingl[eé]s|english|espa[nñ]ol|spanish|castellano)\b/i.test(sentence);

    if (SOLO_SPANISH.test(sentence)) {
      applyLanguagePolicy('en', 'reject');
      return;
    }
    if (SOLO_ENGLISH.test(sentence)) {
      applyLanguagePolicy('es', 'reject');
      return;
    }

    const policyForMention = (): LanguagePolicy | null => {
      if (hasPenalize) return 'penalize';
      if (hasReject || noPlusLanguage) return 'reject';
      return null;
    };

    const policy = policyForMention();
    if (policy && mentionsEn) applyLanguagePolicy('en', policy);
    if (policy && mentionsEs && !mentionsEn) applyLanguagePolicy('es', policy);

    if (!mentionsEn && !mentionsEs && hasReject) {
      uniquePush(dealBreakers, sentence.slice(0, 180), (a, b) => a.toLowerCase() === b.toLowerCase());
    }
  };

  for (const sentence of splitSentences(text)) {
    considerSentence(sentence);
  }
  considerSentence(text.replace(/\s+/g, ' '));

  const constraints: HardConstraints = {};
  if (rejectOfferLanguage.length || penalizeOfferLanguage.length) {
    constraints.language = {
      ...(rejectOfferLanguage.length ? { rejectOfferLanguage } : {}),
      ...(penalizeOfferLanguage.length ? { penalizeOfferLanguage } : {}),
    };
  }
  if (dealBreakers.length) {
    constraints.dealBreakers = dealBreakers.slice(0, 8);
  }
  return constraints;
}

export function detectOfferLanguage(input: {
  title?: string | null;
  description?: string | null;
  sourceMetadata?: unknown;
}): OfferLanguage {
  const title = (input.title || '').trim();
  const description = (input.description || '').replace(SPANISH_AS_PLUS, ' ').trim();
  const meta = metadataText(input.sourceMetadata);
  const combined = `${title} ${title} ${title} ${description} ${meta}`.trim();

  if (!combined) return 'unknown';

  const tokens = tokenize(combined);
  let en = countStopwords(tokens, EN_STOPWORDS);
  let es = countStopwords(tokens, ES_STOPWORDS);

  if (EN_TITLE_HINT.test(title)) en += 8;
  if (ES_TITLE_HINT.test(title)) es += 8;
  else if (EN_TITLE_WEAK.test(title)) en += 4;

  const total = en + es;
  if (total < 3) {
    if (EN_TITLE_HINT.test(title)) return 'en';
    if (ES_TITLE_HINT.test(title)) return 'es';
    return 'unknown';
  }

  const enRatio = en / total;
  if (enRatio >= 0.62) return 'en';
  if (enRatio <= 0.38) return 'es';
  return 'mixed';
}

export function extractLanguageSentences(description: string | null | undefined, maxChars = 280): string {
  if (!description) return '';
  const hits = splitSentences(description)
    .filter((sentence) => LANGUAGE_RULE_LINE.test(sentence) || SPANISH_AS_PLUS.test(sentence))
    .slice(0, 3);
  if (hits.length === 0) return '';
  return hits.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function workplaceSignals(text: string, sourceMetadata: unknown): string[] {
  const signals: string[] = [];
  const meta = sourceMetadata && typeof sourceMetadata === 'object'
    ? sourceMetadata as Record<string, unknown>
    : {};

  const workplaceMeta = typeof meta.workplaceType === 'string' ? meta.workplaceType : '';
  const locationMeta = typeof meta.location === 'string' ? meta.location : '';

  if (workplaceMeta) signals.push(`modalidad_meta:${workplaceMeta.slice(0, 40)}`);
  if (locationMeta) signals.push(`ubicacion_meta:${locationMeta.slice(0, 60)}`);

  if (/\b(remote|remoto|teletrabajo|100%\s*remote)\b/i.test(text)) signals.push('modalidad:remoto');
  else if (/\b(hybrid|h[ií]brido)\b/i.test(text)) signals.push('modalidad:hibrido');
  else if (/\b(onsite|on-site|presencial|oficina)\b/i.test(text)) signals.push('modalidad:presencial');

  const salary = text.match(/(\d{2,3}[.\s]?\d{3}\s*(?:€|eur|euros?)|€\s*\d{2,3}[.\s]?\d{3}|\d{2,3}k\s*(?:€|eur)?)/i);
  if (salary) signals.push(`salario_señal:${salary[0].replace(/\s+/g, '')}`);

  return signals;
}

export function buildOfferSignalPrefix(input: {
  title?: string | null;
  description?: string | null;
  sourceMetadata?: unknown;
}): string {
  const language = detectOfferLanguage(input);
  const text = `${input.title || ''} ${input.description || ''}`;
  const signals = workplaceSignals(text, input.sourceMetadata);

  if (language === 'en') signals.unshift('idioma_oferta:ingles');
  else if (language === 'es') signals.unshift('idioma_oferta:espanol');
  else if (language === 'mixed') signals.unshift('idioma_oferta:mixto');

  return signals.length ? `[señales: ${signals.join(', ')}]` : '';
}

type LanguageCap = {
  mode: LanguagePolicy;
  maxScore: number;
  reason: string;
};

export function getLanguageScoreCap(
  offerLanguage: OfferLanguage,
  constraints: HardConstraints | null | undefined,
): LanguageCap | null {
  if (!constraints?.language) return null;
  if (offerLanguage !== 'en' && offerLanguage !== 'mixed' && offerLanguage !== 'es') return null;

  const langsToCheck: ConstraintLanguage[] =
    offerLanguage === 'mixed' ? ['en', 'es'] : [offerLanguage];

  const reject = constraints.language.rejectOfferLanguage || [];
  const penalize = constraints.language.penalizeOfferLanguage || [];

  for (const lang of langsToCheck) {
    if (reject.includes(lang)) {
      const label = lang === 'en' ? 'inglés' : 'español';
      return {
        mode: 'reject',
        maxScore: LANGUAGE_REJECT_MAX_SCORE,
        reason: `Oferta en ${label}: tope por tus criterios.`,
      };
    }
  }

  for (const lang of langsToCheck) {
    const rule = penalize.find((item) => item.lang === lang);
    if (rule) {
      const label = lang === 'en' ? 'inglés' : 'español';
      return {
        mode: 'penalize',
        maxScore: rule.maxScore,
        reason: `Oferta en ${label}: puntuación limitada por tus criterios.`,
      };
    }
  }

  return null;
}

export function enforceCurationConstraints(input: {
  score: number;
  decision?: 'keep' | 'archive';
  fitReason?: string;
  violatedRules?: string[];
  offerLanguage: OfferLanguage;
  constraints: HardConstraints | null | undefined;
  targetThreshold: number;
}): {
  score: number;
  decision: 'keep' | 'archive';
  fitReason: string;
} {
  let score = Number.isFinite(input.score)
    ? Math.round(Math.max(0, Math.min(100, input.score)))
    : 50;

  const violatedRules = (input.violatedRules || []).map((rule) => rule.trim()).filter(Boolean);
  let fitReason = (input.fitReason || '').trim();

  if (violatedRules.length > 0) {
    score = Math.min(score, LANGUAGE_REJECT_MAX_SCORE);
    if (!/penaliz|regla|viol|tope|criterio/i.test(fitReason)) {
      fitReason = `Penalizada: ${violatedRules.slice(0, 2).join('; ')}`.slice(0, 160);
    }
  }

  const languageCap = getLanguageScoreCap(input.offerLanguage, input.constraints);
  if (languageCap) {
    if (score > languageCap.maxScore) {
      score = languageCap.maxScore;
      fitReason = languageCap.reason;
    } else if (!fitReason || !/ingl[eé]s|espa[nñ]ol|idioma|criterio/i.test(fitReason)) {
      fitReason = languageCap.reason;
    }
  }

  let decision: 'keep' | 'archive' =
    input.decision === 'keep' || input.decision === 'archive'
      ? input.decision
      : (score >= input.targetThreshold ? 'keep' : 'archive');

  if (violatedRules.length > 0 || languageCap?.mode === 'reject' || score < input.targetThreshold) {
    decision = 'archive';
  } else if (score >= input.targetThreshold) {
    decision = 'keep';
  }

  if (!fitReason) {
    fitReason = decision === 'keep'
      ? `Afinidad alta (${score}%).`
      : `Afinidad baja (${score}%).`;
  }

  return { score, decision, fitReason: fitReason.slice(0, 180) };
}

export function describeHardConstraintChips(constraints: HardConstraints | null | undefined): string[] {
  const chips: string[] = [];
  const reject = constraints?.language?.rejectOfferLanguage || [];
  const penalize = constraints?.language?.penalizeOfferLanguage || [];

  for (const lang of reject) {
    chips.push(lang === 'en' ? `Inglés: máx. ${LANGUAGE_REJECT_MAX_SCORE} pts` : `Español: máx. ${LANGUAGE_REJECT_MAX_SCORE} pts`);
  }
  for (const rule of penalize) {
    const label = rule.lang === 'en' ? 'Inglés' : 'Español';
    chips.push(`${label}: máx. ${rule.maxScore} pts`);
  }
  for (const deal of (constraints?.dealBreakers || []).slice(0, 3)) {
    chips.push(deal.length > 42 ? `${deal.slice(0, 42).trim()}…` : deal);
  }
  return chips;
}

export function formatHardConstraintsForPrompt(constraints: HardConstraints | null | undefined): string {
  const chips = describeHardConstraintChips(constraints);
  if (chips.length === 0) return '';
  return `REGLAS EXTRAÍDAS (se aplican en código, no las ignores):\n${chips.map((chip) => `- ${chip}`).join('\n')}`;
}

export function isLanguageRuleLine(line: string): boolean {
  return LANGUAGE_RULE_LINE.test(line);
}
