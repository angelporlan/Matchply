export type OfferLanguage = 'en' | 'es' | 'mixed' | 'unknown';
export type ConstraintLanguage = 'en' | 'es';
export type LanguagePolicy = 'reject' | 'penalize';
export type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2' | 'native';

export type LanguageScoringRule = {
  id: string;
  language: string;
  condition: 'required' | 'minimum_level';
  minimumLevel?: CefrLevel;
  action: LanguagePolicy;
  source: 'explicit' | 'criteria';
  sourceText?: string;
};

export type ScoringPreferences = {
  version: 1;
  languageRules: LanguageScoringRule[];
  /** Preserved criteria which are inactive until the user clarifies them. */
  reviewRequired: string[];
};

export type OfferLanguageRequirement = {
  language: string;
  minimumLevel: CefrLevel | null;
  required: boolean;
  evidence: string;
};

export type OfferWorkplace = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export type HardConstraints = {
  language?: {
    rules?: LanguageScoringRule[];
    /** Legacy fields are readable for compatibility, never activated as score rules. */
    rejectOfferLanguage?: ConstraintLanguage[];
    penalizeOfferLanguage?: Array<{ lang: ConstraintLanguage; maxScore: number }>;
    /** Highest English requirement the candidate accepts. C1 JD vs B2 here → cap. */
    englishMaxOk?: CefrLevel;
    englishRequirementPolicy?: LanguagePolicy;
  };
  dealBreakers?: string[];
  workplace?: {
    remoteOnly?: boolean;
  };
  salaryMin?: number;
  preferenceReviewRequired?: string[];
};

export const CEFR_LEVELS: CefrLevel[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'];
export const CEFR_RANK: Record<CefrLevel, number> = {
  a1: 1,
  a2: 2,
  b1: 3,
  b2: 4,
  c1: 5,
  c2: 6,
  native: 7,
};
export const CEFR_LABELS: Record<CefrLevel, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
  native: 'Nativo',
};

export const LANGUAGE_REJECT_MAX_SCORE = 30;
export const LANGUAGE_PENALIZE_MAX_SCORE = 40;
export const WORKPLACE_REJECT_MAX_SCORE = 30;
export const WORKPLACE_HYBRID_MAX_SCORE = 50;
export const SALARY_REJECT_MAX_SCORE = 30;

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

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'Inglés', es: 'Español', de: 'Alemán', fr: 'Francés', it: 'Italiano',
  pt: 'Portugués', nl: 'Neerlandés', pl: 'Polaco', ar: 'Árabe', zh: 'Chino',
  ja: 'Japonés', ko: 'Coreano', ru: 'Ruso', ca: 'Catalán', eu: 'Euskera',
};

const LANGUAGE_ALIASES: Record<string, string> = {
  en: 'en', english: 'en', ingles: 'en', es: 'es', spanish: 'es', espanol: 'es', castellano: 'es',
  de: 'de', german: 'de', aleman: 'de', deutsch: 'de', fr: 'fr', french: 'fr', frances: 'fr',
  it: 'it', italian: 'it', italiano: 'it', pt: 'pt', portuguese: 'pt', portugues: 'pt',
  nl: 'nl', dutch: 'nl', neerlandes: 'nl', holandes: 'nl', pl: 'pl', polish: 'pl', polaco: 'pl',
  ar: 'ar', arabic: 'ar', arabe: 'ar', zh: 'zh', chinese: 'zh', mandarin: 'zh', chino: 'zh',
  ja: 'ja', japanese: 'ja', japones: 'ja', ko: 'ko', korean: 'ko', coreano: 'ko',
  ru: 'ru', russian: 'ru', ruso: 'ru', ca: 'ca', catalan: 'ca', eu: 'eu', basque: 'eu', euskera: 'eu',
};

function plain(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return LANGUAGE_ALIASES[plain(value.trim())] || null;
}

const LANGUAGE_NAMES = Object.keys(LANGUAGE_ALIASES).filter((name) => name.length > 2).join('|');
const LANGUAGE_RULE_LINE = new RegExp(`\\b(?:${LANGUAGE_NAMES}|idioma|language)\\b`, 'i');
const REJECT_VERB = /\b(descarta(?:r)?|rechaza(?:r)?|elimina(?:r)?|reject|discard|exclude|evita(?:r)?|no\s+quiero|no\s+consideres|no\s+me\s+interesa)\b/i;
const PENALIZE_HINT = /\b(penaliz[a-z]*|penali[sz]e|limita(?:r)?|puntuaciones?\s+(?:muy\s+)?altas|high\s+scores?)\b/i;
const WRITING_LANGUAGE_HINT = /\b(redactad[ao]s?|escrit[ao]s?|written|anuncios?\s+en|ofertas?\s+en|vacantes?\s+en|job\s+posts?|solo\s+espanol|solo\s+ingles)\b/i;
const MANDATORY_HINT = /\b(required|must|requirement|mandatory|essential|requiere|requerido|requisitos?|piden|exigen?|exige|imprescindible|obligatorio|obligatoria|necesario|necesaria)\b/i;
const OPTIONAL_HINT = /\b(plus|nice.to.have|good.to.have|optional|opcional|deseable|valorable|se\s+valorara|preferible|preferred|not\s+required|no\s+(?:se\s+)?(?:requiere|es\s+(?:necesario|obligatorio))|sin\s+requisito)\b/i;

export function parseCefrLevel(value: unknown): CefrLevel | null {
  if (typeof value !== 'string') return null;
  const normalized = plain(value.trim()).replace(/\s+/g, '');
  if (['nativo', 'bilingual', 'bilingue'].includes(normalized)) return 'native';
  return CEFR_LEVELS.includes(normalized as CefrLevel) ? normalized as CefrLevel : null;
}

function levelsIn(text: string): CefrLevel[] {
  const levels = Array.from(text.matchAll(/\b(?:[abc][12]|native|nativo|nativa|bilingual|bilingue)\b/gi))
    .map((match) => parseCefrLevel(match[0] === 'nativa' ? 'native' : match[0]))
    .filter((level): level is CefrLevel => level !== null);
  return Array.from(new Set(levels));
}

function minimumExplicitLevel(text: string): CefrLevel | null {
  const levels = levelsIn(text);
  if (!levels.length) return null;
  const lowest = levels.reduce((a, b) => CEFR_RANK[a] <= CEFR_RANK[b] ? a : b);
  const above = text.match(/\b(?:por encima de|superior a|mayor que|above|higher than|over)\s+(?:nivel\s+)?([abc][12])\b/i);
  if (above) return CEFR_LEVELS.find((level) => CEFR_RANK[level] === CEFR_RANK[above[1].toLowerCase() as CefrLevel] + 1) || null;
  if (/\b(?:por debajo de|inferior a|menor que|below|lower than|under)\b/i.test(text)) return null;
  return lowest;
}

function splitSentences(text: string): string[] {
  return text.split(/[\n;]+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[\s\-*$•\d.)]+/, '').trim())
    .filter(Boolean);
}

/** Split by language clauses, never append the full document as another sentence. */
function languageClauses(text: string): Array<{ language: string; clause: string; evidence: string; sharedRequired: boolean }> {
  const result: Array<{ language: string; clause: string; evidence: string; sharedRequired: boolean }> = [];
  for (const sentence of splitSentences(text)) {
    const normalized = plain(sentence);
    const matches = Array.from(normalized.matchAll(new RegExp(`\\b(${LANGUAGE_NAMES})\\b`, 'g')));
    const lastMatch = matches[matches.length - 1];
    const sharedText = matches.length > 1
      ? normalized.slice(0, matches[0].index) + normalized.slice(lastMatch.index! + lastMatch[0].length) : '';
    const simpleList = matches.length > 1 && matches.slice(1).every((match, index) =>
      /^[,\s&]*(?:(?:and|y)[,\s&]*)?$/.test(normalized.slice(matches[index].index! + matches[index][0].length, match.index)));
    const sharedRequired = simpleList && MANDATORY_HINT.test(sharedText) && !OPTIONAL_HINT.test(sharedText);
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const start = match.index || 0;
      const nextStart = matches[index + 1]?.index ?? normalized.length;
      const previousEnd = index > 0 ? (matches[index - 1].index || 0) + matches[index - 1][0].length : 0;
      // A separator keeps "English B2, German C2" from assigning C2 to English.
      const between = normalized.slice(previousEnd, start);
      const boundaries = Array.from(between.matchAll(/,|\b(?:and|y|but|pero|or|o)\b/g));
      const boundary = boundaries[boundaries.length - 1];
      const safePrefix = index === 0 ? between : boundary ? between.slice(boundary.index! + boundary[0].length) : '';
      const suffix = normalized.slice(start, nextStart).replace(/[,\s]+(?:and|y|but|pero|or|o)?\s*$/, '');
      result.push({ language: LANGUAGE_ALIASES[match[0]], clause: `${safePrefix}${suffix}`.trim(), evidence: sentence.slice(0, 500), sharedRequired });
    }
  }
  return result;
}

export function detectOfferLanguageRequirements(text: string | null | undefined): OfferLanguageRequirement[] {
  if (!text?.trim()) return [];
  const requirements: OfferLanguageRequirement[] = [];
  for (const { language, clause, evidence, sharedRequired } of languageClauses(text)) {
    if (WRITING_LANGUAGE_HINT.test(clause) || /\b(course|classes|lessons|curso|clases)\b/.test(clause)) continue;
    const minimumLevel = minimumExplicitLevel(clause);
    const alternativeLanguages = new RegExp(`\\b(?:${LANGUAGE_NAMES})\\b[^,;.!?]{0,25}\\b(?:or|o)\\s+(?:${LANGUAGE_NAMES})\\b`, 'i').test(plain(evidence));
    const required = !alternativeLanguages && !OPTIONAL_HINT.test(clause) && (Boolean(minimumLevel) || MANDATORY_HINT.test(clause) || sharedRequired);
    if (!required && !minimumLevel && !OPTIONAL_HINT.test(clause)) continue;
    requirements.push({ language, minimumLevel, required, evidence });
  }
  return requirements;
}

export function detectRequiredEnglishLevel(text: string | null | undefined): CefrLevel | null {
  return detectOfferLanguageRequirements(text)
    .filter((item) => item.language === 'en' && item.required && item.minimumLevel)
    .reduce<CefrLevel | null>((highest, item) => !highest || CEFR_RANK[item.minimumLevel!] > CEFR_RANK[highest] ? item.minimumLevel : highest, null);
}

function normalizeRule(value: unknown): LanguageScoringRule | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const language = normalizeLanguage(row.language);
  const minimumLevel = parseCefrLevel(row.minimumLevel);
  if (!language || !['penalize', 'reject'].includes(String(row.action))) return null;
  if (row.condition !== 'required' && (row.condition !== 'minimum_level' || !minimumLevel)) return null;
  return {
    id: typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 80) : `explicit:${language}:${row.condition}:${minimumLevel || 'any'}`,
    language,
    condition: row.condition,
    ...(row.condition === 'minimum_level' && minimumLevel ? { minimumLevel } : {}),
    action: row.action as LanguagePolicy,
    source: row.source === 'criteria' ? 'criteria' : 'explicit',
    ...(typeof row.sourceText === 'string' ? { sourceText: row.sourceText.slice(0, 500) } : {}),
  };
}

/** Idempotent lazy migration. Candidate language ability is factual data, not a scoring policy. */
export function normalizeScoringPreferences(input: {
  scoringPreferences?: unknown;
  curationCriteria?: string | null;
  englishLevel?: unknown;
  englishOverLevelPolicy?: unknown;
}): ScoringPreferences {
  const saved = input.scoringPreferences && typeof input.scoringPreferences === 'object'
    ? input.scoringPreferences as Record<string, unknown> : {};
  const versioned = saved.version === 1;
  const explicit = versioned && Array.isArray(saved.languageRules)
    ? saved.languageRules.map(normalizeRule).filter((rule): rule is LanguageScoringRule => Boolean(rule && rule.source === 'explicit'))
    : [];
  const languageRules = [...explicit];
  const reviewRequired: string[] = [];
  const criteriaClauses = (input.curationCriteria || '').replace(/(?:,\s*|\b(?:y|and)\s+)(?=(?:descarta|rechaza|penaliza|reject|discard|penali[sz]e)\b)/gi, '\n');
  for (const sentence of splitSentences(criteriaClauses)) {
    const normalized = plain(sentence);
    if (!LANGUAGE_RULE_LINE.test(normalized)) continue;
    const action: LanguagePolicy | null = PENALIZE_HINT.test(normalized) ? 'penalize' : REJECT_VERB.test(normalized) ? 'reject' : null;
    if (/\b(?:no|not|never)\s+(?:penalices|penalizar|penaliza|descartes|descartar|descarta|rechaces|rechazar|penali[sz]e|reject|discard)\b/i.test(normalized)) continue;
    if (!action) {
      if (WRITING_LANGUAGE_HINT.test(normalized)) reviewRequired.push(sentence);
      continue;
    }
    if (WRITING_LANGUAGE_HINT.test(normalized)) {
      reviewRequired.push(sentence);
      continue;
    }
    let recognized = false;
    for (const { language, clause, sharedRequired } of languageClauses(sentence)) {
      const minimumLevel = minimumExplicitLevel(clause);
      if (levelsIn(clause).length && !minimumLevel) continue;
      // Explicit levels ("penaliza inglés C1+") and mandatory-language rules are actionable.
      if (!minimumLevel && !MANDATORY_HINT.test(clause) && !sharedRequired) continue;
      if (OPTIONAL_HINT.test(clause)) continue;
      const condition = minimumLevel ? 'minimum_level' as const : 'required' as const;
      if (explicit.some((rule) => rule.language === language && rule.condition === condition && rule.minimumLevel === (minimumLevel || undefined))) {
        recognized = true;
        continue;
      }
      languageRules.push({ id: `criteria:${language}:${condition}:${minimumLevel || 'any'}:${action}`, language, condition,
        ...(minimumLevel ? { minimumLevel } : {}), action, source: 'criteria', sourceText: sentence.slice(0, 500) });
      recognized = true;
    }
    if (!recognized) reviewRequired.push(sentence);
  }
  const legacyNote = 'La regla antigua «si piden más inglés» está inactiva. Define una condición de idioma para activarla.';
  if ((!versioned && (input.englishOverLevelPolicy === 'reject' || input.englishOverLevelPolicy === 'penalize')) ||
    (versioned && Array.isArray(saved.reviewRequired) && saved.reviewRequired.includes(legacyNote))) reviewRequired.push(legacyNote);
  const uniqueRules = Array.from(new Map(languageRules.map((rule) => [`${rule.language}:${rule.condition}:${rule.minimumLevel || 'any'}:${rule.action}`, rule])).values());
  return { version: 1, languageRules: uniqueRules.slice(0, 30), reviewRequired: Array.from(new Set(reviewRequired)).slice(0, 20) };
}

export function parseHardConstraints(input: {
  curationCriteria?: string | null;
  bio?: string | null;
  scoringPreferences?: unknown;
}): HardConstraints {
  const preferences = normalizeScoringPreferences(input);
  return {
    ...(preferences.languageRules.length ? { language: { rules: preferences.languageRules } } : {}),
    ...(preferences.reviewRequired.length ? { preferenceReviewRequired: preferences.reviewRequired } : {}),
  };
}

function isRemoteOnlyWorkplaces(workplaces: unknown): boolean {
  if (!Array.isArray(workplaces) || workplaces.length === 0) return false;
  return workplaces.every((item) => typeof item === 'string' && ['remote', 'remoto', 'teletrabajo'].includes(item.trim().toLowerCase()));
}

export function parseMatchConstraints(input: {
  curationCriteria?: string | null;
  bio?: string | null;
  preferredWorkplaces?: unknown;
  salaryMin?: unknown;
  englishLevel?: unknown;
  englishOverLevelPolicy?: unknown;
  scoringPreferences?: unknown;
}): HardConstraints {
  const preferences = normalizeScoringPreferences(input);
  const constraints: HardConstraints = {
    ...(preferences.languageRules.length ? { language: { rules: preferences.languageRules } } : {}),
    ...(preferences.reviewRequired.length ? { preferenceReviewRequired: preferences.reviewRequired } : {}),
  };
  if (isRemoteOnlyWorkplaces(input.preferredWorkplaces)) constraints.workplace = { remoteOnly: true };
  const salaryMin = typeof input.salaryMin === 'number' ? input.salaryMin : Number(input.salaryMin);
  if (Number.isFinite(salaryMin) && salaryMin > 0) constraints.salaryMin = Math.round(salaryMin);
  return constraints;
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
    .filter((sentence) => LANGUAGE_RULE_LINE.test(plain(sentence)) || SPANISH_AS_PLUS.test(sentence))
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

  const requiredEnglish = detectRequiredEnglishLevel(text);
  if (requiredEnglish) signals.push(`ingles_exigido:${requiredEnglish}`);

  return signals.length ? `[señales: ${signals.join(', ')}]` : '';
}

/** The language used to write an advert never limits the match score. */
export function getLanguageScoreCap(
  _offerLanguage: OfferLanguage,
  _constraints: HardConstraints | null | undefined,
): ScoreCap | null {
  return null;
}

type ScoreCap = {
  mode: LanguagePolicy;
  maxScore: number;
  reason: string;
};

export function getWorkplaceScoreCap(
  offerWorkplace: OfferWorkplace | null | undefined,
  constraints: HardConstraints | null | undefined,
): ScoreCap | null {
  if (!constraints?.workplace?.remoteOnly) return null;
  if (offerWorkplace === 'onsite') {
    return {
      mode: 'reject',
      maxScore: WORKPLACE_REJECT_MAX_SCORE,
      reason: 'Presencial: tope por tu preferencia de remoto.',
    };
  }
  if (offerWorkplace === 'hybrid') {
    return {
      mode: 'penalize',
      maxScore: WORKPLACE_HYBRID_MAX_SCORE,
      reason: 'Híbrido: puntuación limitada porque pides remoto.',
    };
  }
  return null;
}

export function getLanguageRequirementCap(
  requirements: OfferLanguageRequirement[] | null | undefined,
  constraints: HardConstraints | null | undefined,
): ScoreCap | null {
  const caps: ScoreCap[] = [];
  for (const rule of constraints?.language?.rules || []) {
    const requirement = requirements?.find((item) => item.required && item.language === rule.language &&
      (rule.condition === 'required' || (rule.minimumLevel && item.minimumLevel && CEFR_RANK[item.minimumLevel] >= CEFR_RANK[rule.minimumLevel])));
    if (!requirement) continue;
    caps.push({ mode: rule.action, maxScore: rule.action === 'reject' ? LANGUAGE_REJECT_MAX_SCORE : LANGUAGE_PENALIZE_MAX_SCORE,
      reason: `${LANGUAGE_LABELS[rule.language] || rule.language} ${requirement.minimumLevel ? CEFR_LABELS[requirement.minimumLevel] : 'obligatorio'}: límite por tu regla explícita.` });
  }
  return caps.sort((a, b) => a.maxScore - b.maxScore)[0] || null;
}

export function getEnglishRequirementCap(
  requiredEnglish: CefrLevel | null | undefined,
  constraints: HardConstraints | null | undefined,
): ScoreCap | null {
  return getLanguageRequirementCap(requiredEnglish ? [{ language: 'en', minimumLevel: requiredEnglish, required: true, evidence: '' }] : [], constraints);
}

export function getSalaryScoreCap(
  offerSalaryMax: number | null | undefined,
  constraints: HardConstraints | null | undefined,
): ScoreCap | null {
  if (!constraints?.salaryMin || constraints.salaryMin <= 0) return null;
  if (offerSalaryMax == null || !Number.isFinite(offerSalaryMax)) return null;
  if (offerSalaryMax >= constraints.salaryMin) return null;
  return {
    mode: 'reject',
    maxScore: SALARY_REJECT_MAX_SCORE,
    reason: `Salario hasta ${Math.round(offerSalaryMax)}€: por debajo de tu mínimo (${constraints.salaryMin}€).`,
  };
}

function applyCap(
  score: number,
  fitReason: string,
  cap: ScoreCap | null,
  reasonPattern: RegExp,
): { score: number; fitReason: string; reject: boolean } {
  if (!cap) return { score, fitReason, reject: false };
  let nextScore = score;
  let nextReason = fitReason;
  if (score > cap.maxScore) {
    nextScore = cap.maxScore;
    nextReason = cap.reason;
  } else if (!fitReason || !reasonPattern.test(fitReason)) {
    nextReason = cap.reason;
  }
  return { score: nextScore, fitReason: nextReason, reject: cap.mode === 'reject' };
}

export function enforceCurationConstraints(input: {
  score: number;
  decision?: 'keep' | 'archive';
  fitReason?: string;
  violatedRules?: string[];
  offerLanguage: OfferLanguage;
  offerWorkplace?: OfferWorkplace | null;
  offerSalaryMax?: number | null;
  offerRequiredEnglish?: CefrLevel | null;
  offerLanguageRequirements?: OfferLanguageRequirement[];
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

  let fitReason = (input.fitReason || '').trim();
  let forcedReject = false;

  // LLM claims about violated rules are advisory; only verified input conditions can cap a score.
  const languageCap = input.offerLanguageRequirements
    ? getLanguageRequirementCap(input.offerLanguageRequirements, input.constraints)
    : getEnglishRequirementCap(input.offerRequiredEnglish, input.constraints);
  const languageApplied = applyCap(score, fitReason, languageCap, /idioma|regla|límite/i);
  score = languageApplied.score;
  fitReason = languageApplied.fitReason;
  if (languageApplied.reject) forcedReject = true;

  const workplaceCap = getWorkplaceScoreCap(input.offerWorkplace, input.constraints);
  const workplaceApplied = applyCap(score, fitReason, workplaceCap, /remoto|presencial|h[ií]brido|modalidad/i);
  score = workplaceApplied.score;
  fitReason = workplaceApplied.fitReason;
  if (workplaceApplied.reject) forcedReject = true;

  const salaryCap = getSalaryScoreCap(input.offerSalaryMax, input.constraints);
  const salaryApplied = applyCap(score, fitReason, salaryCap, /salario|mínimo|minimo/i);
  score = salaryApplied.score;
  fitReason = salaryApplied.fitReason;
  if (salaryApplied.reject) forcedReject = true;

  let decision: 'keep' | 'archive' =
    input.decision === 'keep' || input.decision === 'archive'
      ? input.decision
      : (score >= input.targetThreshold ? 'keep' : 'archive');

  if (forcedReject || score < input.targetThreshold) {
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
  for (const rule of constraints?.language?.rules || []) {
    const condition = rule.condition === 'minimum_level' && rule.minimumLevel
      ? `${CEFR_LABELS[rule.minimumLevel]} o superior` : 'obligatorio';
    chips.push(`${LANGUAGE_LABELS[rule.language] || rule.language} ${condition}: máx. ${rule.action === 'reject' ? LANGUAGE_REJECT_MAX_SCORE : LANGUAGE_PENALIZE_MAX_SCORE} pts`);
  }
  if (constraints?.workplace?.remoteOnly) {
    chips.push('Solo remoto');
  }
  if (constraints?.salaryMin) {
    chips.push(`Salario mín. ${constraints.salaryMin}€`);
  }
  return chips;
}

export function formatHardConstraintsForPrompt(constraints: HardConstraints | null | undefined): string {
  const chips = describeHardConstraintChips(constraints);
  if (chips.length === 0) return '';
  return `REGLAS EXTRAÍDAS (se aplican en código, no las ignores):\n${chips.map((chip) => `- ${chip}`).join('\n')}`;
}

export function isLanguageRuleLine(line: string): boolean {
  return LANGUAGE_RULE_LINE.test(plain(line));
}
