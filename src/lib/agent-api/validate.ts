import { PIPELINE_STATUSES, type PipelineStatus } from '@/lib/application-service';
import { AgentApiError } from '@/lib/agent-api/errors';
import { normalizeCareerProfileFields } from '@/lib/career-profile';
import { COMPANY_NOTE_MAX, normalizeCompanyName } from '@/lib/company-service';
import { isCrmEntity, normalizeCrmViewName, type CrmEntity } from '@/lib/crm-views';
import { COMPANY_RELATIONS, PERSON_STATUSES, type PersonInput } from '@/lib/people/types';
import { sha256Hex } from '@/lib/crypto-hash';
import { parseMatchConstraints } from '@/lib/curation-constraints';
import { computeOverall } from '@/lib/matching/rubric';
import {
  MATCH_DIMENSION_KEYS,
  MATCH_EXPLANATION_VERSION,
  MATCH_PROMPT_VERSION,
  type MatchAdjustment,
  type MatchBreakdown,
  type MatchDetails,
  type MatchDimensionKey,
  type MatchEvidenceSnapshot,
  type MatchRequirement,
} from '@/lib/matching/types';

export const CV_CONTENT_MAX = 400_000;
export const CV_TITLE_MAX = 120;
export const APPLICATION_DESCRIPTION_MAX = 100_000;
export const JOB_TITLE_MAX = 200;
export const EXTERNAL_ID_MAX = 120;
export const URL_MAX = 2_000;
export const TLDR_MAX = 1_000;
export const EVALUATION_BATCH_MAX = 200;
const LIST_DEFAULT = 50;
const LIST_MAX = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORMS = ['linkedin', 'infojobs', 'indeed', 'other'] as const;
const FONTS = ['helvetica', 'times', 'courier'] as const;
const PROFILE_FORBIDDEN = new Set([
  'email',
  'role',
  'password',
  'passwordHash',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'subscriptionStatus',
  'id',
  'userId',
  'hardConstraints',
  'accountStatus',
  'isGuest',
  '__proto__',
  'constructor',
  'prototype',
]);

export type ApplicationWritePlan = 'insert' | 'return_existing';

export function applicationWritePlan(input: {
  externalId?: string | null;
  url?: string | null;
  existingByExternalId: boolean;
  existingByUrl: boolean;
}): ApplicationWritePlan {
  if (input.externalId && input.existingByExternalId) return 'return_existing';
  if (!input.externalId && input.url && input.existingByUrl) return 'return_existing';
  return 'insert';
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentApiError(400, 'invalid_body', 'El cuerpo tiene que ser un objeto JSON.');
  }
  return value as Record<string, unknown>;
}

export function parseApiTokenName(value: unknown) {
  if (typeof value !== 'string') {
    throw new AgentApiError(400, 'invalid_name', 'Ponle un nombre a la clave.');
  }
  const name = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 80) {
    throw new AgentApiError(400, 'invalid_name', 'Ponle un nombre de hasta 80 caracteres.');
  }
  return name;
}

export function parseAgentStatus(value: unknown): PipelineStatus {
  if (typeof value !== 'string' || !PIPELINE_STATUSES.includes(value as PipelineStatus)) {
    throw new AgentApiError(400, 'invalid_status', 'El estado no es válido.');
  }
  return value as PipelineStatus;
}

export function parseLimit(value: string | null, fallback = LIST_DEFAULT, max = LIST_MAX) {
  if (!value) return fallback;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    throw new AgentApiError(400, 'invalid_limit', 'El límite de la lista no es válido.');
  }
  return limit;
}

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

export function assertResourceId(id: string, message: string) {
  if (!isUuid(id)) throw new AgentApiError(404, 'not_found', message);
}

function parseUuid(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new AgentApiError(400, code, message);
  }
  return value;
}

export function encodeApplicationCursor(updatedAt: Date, id: string) {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeApplicationCursor(cursor: string): { updatedAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const splitAt = decoded.lastIndexOf('|');
    if (splitAt <= 0) return null;
    const updatedAt = new Date(decoded.slice(0, splitAt));
    const id = decoded.slice(splitAt + 1);
    if (!Number.isFinite(updatedAt.getTime()) || !isUuid(id)) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

export function sanitizeCareerProfilePatch(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (PROFILE_FORBIDDEN.has(key)) continue;
    next[key] = child;
  }
  return next;
}

export function mergeCareerProfile(current: unknown, patch: unknown) {
  const clean = sanitizeCareerProfilePatch(patch);
  const base = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as Record<string, unknown>) }
    : {};
  delete base.hardConstraints;
  const normalized = normalizeCareerProfileFields({ ...base, ...clean });
  return {
    ...base,
    ...normalized,
    hardConstraints: parseMatchConstraints(normalized),
    updatedAt: new Date().toISOString(),
  };
}

export function parseCvTitle(value: unknown) {
  if (typeof value !== 'string') {
    throw new AgentApiError(400, 'invalid_title', 'El título del currículum no es válido.');
  }
  const title = value.trim().replace(/\s+/g, ' ');
  if (!title || title.length > CV_TITLE_MAX) {
    throw new AgentApiError(400, 'invalid_title', 'El título del currículum no es válido.');
  }
  return title;
}

export function parseCvContent(value: unknown) {
  if (typeof value !== 'string') {
    throw new AgentApiError(400, 'invalid_content', 'El contenido del currículum no es válido.');
  }
  if (value.length > CV_CONTENT_MAX) {
    throw new AgentApiError(400, 'invalid_content', 'El currículum supera el tamaño permitido.');
  }
  return value;
}

export function copyCvTitle(title: string) {
  const suffix = ' (Copia)';
  const room = CV_TITLE_MAX - suffix.length;
  const base = title.length + suffix.length > CV_TITLE_MAX ? title.slice(0, room).trim() : title;
  return `${base}${suffix}`;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function parseCvStylePatch(record: Record<string, unknown>) {
  const patch: {
    title?: string;
    content?: string;
    templateName?: string;
    accentColor?: string | null;
    fontFamily?: string | null;
    pageMargin?: number;
    scale?: number;
    isBase?: boolean;
    isPrincipal?: boolean;
  } = {};

  if ('title' in record) patch.title = parseCvTitle(record.title);
  if ('content' in record) patch.content = parseCvContent(record.content);
  if ('templateName' in record) {
    if (typeof record.templateName !== 'string' || !record.templateName.trim()) {
      throw new AgentApiError(400, 'invalid_template', 'La plantilla no es válida.');
    }
    patch.templateName = record.templateName.trim();
  }
  if ('accentColor' in record) {
    if (record.accentColor === null) patch.accentColor = null;
    else if (typeof record.accentColor !== 'string' || !HEX_COLOR.test(record.accentColor)) {
      throw new AgentApiError(400, 'invalid_style', 'El color de acento no es válido.');
    } else patch.accentColor = record.accentColor;
  }
  if ('fontFamily' in record) {
    if (record.fontFamily === null) patch.fontFamily = null;
    else if (typeof record.fontFamily !== 'string' || !(FONTS as readonly string[]).includes(record.fontFamily)) {
      throw new AgentApiError(400, 'invalid_style', 'La fuente no es válida.');
    } else patch.fontFamily = record.fontFamily;
  }
  if ('pageMargin' in record) {
    if (typeof record.pageMargin !== 'number' || record.pageMargin < 18 || record.pageMargin > 72) {
      throw new AgentApiError(400, 'invalid_style', 'El margen tiene que estar entre 18 y 72.');
    }
    patch.pageMargin = record.pageMargin;
  }
  if ('scale' in record) {
    if (typeof record.scale !== 'number' || record.scale < 0.6 || record.scale > 1.4) {
      throw new AgentApiError(400, 'invalid_style', 'La escala tiene que estar entre 0.6 y 1.4.');
    }
    patch.scale = record.scale;
  }
  if ('isBase' in record) {
    if (typeof record.isBase !== 'boolean') throw new AgentApiError(400, 'invalid_style', 'isBase tiene que ser verdadero o falso.');
    patch.isBase = record.isBase;
  }
  if ('isPrincipal' in record && record.isPrincipal !== false) {
    if (record.isPrincipal !== true) throw new AgentApiError(400, 'invalid_style', 'isPrincipal tiene que ser verdadero o falso.');
    patch.isPrincipal = true;
  }

  if (!Object.keys(patch).length) {
    throw new AgentApiError(400, 'empty_patch', 'No hay cambios que guardar.');
  }
  return patch;
}

function parsePlatformValue(value: unknown) {
  if (typeof value !== 'string' || !(PLATFORMS as readonly string[]).includes(value)) {
    throw new AgentApiError(400, 'invalid_platform', 'La plataforma no es válida.');
  }
  return value;
}

function parseUrlValue(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new AgentApiError(400, 'invalid_url', 'La URL no es válida.');
  const url = value.trim();
  if (!url) return null;
  if (url.length > URL_MAX || !/^https?:\/\//i.test(url)) {
    throw new AgentApiError(400, 'invalid_url', 'La URL tiene que empezar por http:// o https://.');
  }
  return url;
}

function parseDescriptionValue(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > APPLICATION_DESCRIPTION_MAX) {
    throw new AgentApiError(400, 'invalid_description', 'La descripción supera el tamaño permitido.');
  }
  return value;
}

function parseJobTitleValue(value: unknown) {
  if (typeof value !== 'string') throw new AgentApiError(400, 'invalid_title', 'El puesto no es válido.');
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title || title.length > JOB_TITLE_MAX) {
    throw new AgentApiError(400, 'invalid_title', 'El puesto no es válido.');
  }
  return title;
}

function parseCompanyValue(value: unknown) {
  const company = normalizeCompanyName(value);
  if (!company) throw new AgentApiError(400, 'invalid_company', 'El nombre de la empresa no es válido.');
  return company;
}

function parseExternalIdValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new AgentApiError(400, 'invalid_external_id', 'El identificador externo no es válido.');
  const id = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!id || id.length > EXTERNAL_ID_MAX) {
    throw new AgentApiError(400, 'invalid_external_id', 'El identificador externo no es válido.');
  }
  return id;
}

function parseFollowupValue(value: unknown): Date | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new AgentApiError(400, 'invalid_followup', 'La fecha de seguimiento no es válida.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new AgentApiError(400, 'invalid_followup', 'La fecha de seguimiento no es válida.');
  }
  return date;
}

function parseNoteValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new AgentApiError(400, 'invalid_note', 'La nota no es válida.');
  const note = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!note) return undefined;
  if (note.length > COMPANY_NOTE_MAX) {
    throw new AgentApiError(400, 'invalid_note', 'La nota es demasiado larga.');
  }
  return note;
}

function parseCvIdValue(value: unknown): string | null {
  if (value === null || value === '') return null;
  return parseUuid(value, 'invalid_cv', 'El currículum indicado no es válido.');
}

export function parseScoreOverall(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new AgentApiError(400, 'invalid_score', 'La puntuación tiene que ser un entero entre 0 y 100.');
  }
  return value;
}

export function parseTldr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new AgentApiError(400, 'invalid_tldr', 'El resumen no es válido.');
  }
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length > TLDR_MAX) {
    throw new AgentApiError(400, 'invalid_tldr', 'El resumen supera los 1000 caracteres.');
  }
  return text;
}

export type AgentMatchScoreWrite = {
  scoreOverall: number;
  matchInputHash: string;
  matchEvidence: {
    version: string;
    inputHash: string;
    score: number;
    requirements: [];
    adjustments: [];
  };
  matchKind: 'triage';
};

// The applications board reads scoreOverall only when this hash and version line up.
export function buildAgentMatchScore(userId: string, offerId: string, score: number): AgentMatchScoreWrite {
  const inputHash = sha256Hex(`agent_api:${userId}:${offerId}:${score}:${MATCH_PROMPT_VERSION}`);
  return {
    scoreOverall: score,
    matchInputHash: inputHash,
    matchEvidence: { version: MATCH_PROMPT_VERSION, inputHash, score, requirements: [], adjustments: [] },
    matchKind: 'triage',
  };
}

export function currentMatchScoreValue(row: {
  scoreOverall: number | null;
  matchInputHash: string | null;
  matchEvidence: { version?: string; inputHash?: string } | null;
}) {
  if (row.matchInputHash == null || row.matchEvidence == null) return null;
  if (row.matchEvidence.version !== MATCH_PROMPT_VERSION) return null;
  if (row.matchEvidence.inputHash !== row.matchInputHash) return null;
  return row.scoreOverall;
}

const MATCH_CARD_KEYS = ['scoreBreakdown', 'matchEvidence', 'requirements', 'adjustments', 'matchDetails'] as const;
const REQUIREMENT_KINDS = ['skill', 'experience', 'seniority', 'language', 'other'] as const;
const REQUIREMENT_IMPORTANCE = ['required', 'preferred'] as const;
const REQUIREMENT_STATUSES = ['met', 'missing', 'partial', 'unknown'] as const;
const ADJUSTMENT_CODES = ['experience_gap', 'core_skill_gap', 'seniority_gap', 'user_preference'] as const;
const OUTREACH_MAX = 4_000;
const COVER_LETTER_MAX = 8_000;

export type AgentInterviewQuestion = { question: string; tip: string };

export type ParsedMatchCard = {
  scoreOverall: number;
  scoreBreakdown: MatchBreakdown;
  requirements: MatchRequirement[];
  adjustments: MatchAdjustment[];
  details: {
    summary: string;
    dimensions: MatchDetails['dimensions'];
    requirements: MatchDetails['requirements'];
    nextSteps: string[];
  };
};

export type AgentMatchCardWrite = {
  scoreOverall: number;
  scoreBreakdown: MatchBreakdown;
  matchInputHash: string;
  matchEvidence: MatchEvidenceSnapshot;
  matchDetails: MatchDetails;
  matchKind: 'triage';
};

export function buildAgentMatchCard(userId: string, offerId: string, card: ParsedMatchCard): AgentMatchCardWrite {
  const { tech_stack, experience_fit, work_mode, salary_fit, career_alignment } = card.scoreBreakdown;
  const inputHash = sha256Hex(`agent_api:${userId}:${offerId}:${card.scoreOverall}:${tech_stack},${experience_fit},${work_mode},${salary_fit},${career_alignment}:${MATCH_PROMPT_VERSION}`);
  const scoreBreakdown = { ...card.scoreBreakdown };
  return {
    scoreOverall: card.scoreOverall,
    scoreBreakdown,
    matchInputHash: inputHash,
    matchKind: 'triage',
    matchEvidence: {
      version: MATCH_PROMPT_VERSION,
      sourceHash: inputHash,
      inputHash,
      score: card.scoreOverall,
      baseScore: card.scoreOverall,
      baseBreakdown: { ...scoreBreakdown },
      scoreBreakdown: { ...scoreBreakdown },
      requirements: card.requirements,
      adjustments: card.adjustments,
      candidateComplete: false,
      offerComplete: false,
    },
    matchDetails: {
      version: MATCH_EXPLANATION_VERSION,
      inputHash,
      summary: card.details.summary,
      dimensions: card.details.dimensions,
      requirements: card.details.requirements,
      nextSteps: card.details.nextSteps,
    },
  };
}

function cleanPreservedText(value: string) {
  return value.replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
}

function parseOutreachText(value: unknown, max: number, invalidMessage: string, longMessage: string) {
  if (value === null) return null;
  if (typeof value !== 'string') throw new AgentApiError(400, 'invalid_outreach', invalidMessage);
  const text = cleanPreservedText(value);
  if (!text) return null;
  if (text.length > max) throw new AgentApiError(400, 'invalid_outreach', longMessage);
  return text;
}

function parseInterviewQuestions(value: unknown): AgentInterviewQuestion[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new AgentApiError(400, 'invalid_questions', 'Las preguntas de entrevista no son válidas.');
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AgentApiError(400, 'invalid_questions', 'Las preguntas de entrevista no son válidas.');
    }
    const row = item as Record<string, unknown>;
    if (typeof row.question !== 'string' || typeof row.tip !== 'string') {
      throw new AgentApiError(400, 'invalid_questions', 'Las preguntas de entrevista no son válidas.');
    }
    const question = cleanPreservedText(row.question);
    const tip = cleanPreservedText(row.tip);
    if (question.length < 1 || question.length > 1_000 || tip.length < 1 || tip.length > 2_000) {
      throw new AgentApiError(400, 'invalid_questions', 'Las preguntas de entrevista no son válidas.');
    }
    return { question, tip };
  });
}

function parseContactFields(record: Record<string, unknown>) {
  const contact: {
    outreachMessage?: string | null;
    coverLetter?: string | null;
    interviewQuestions?: AgentInterviewQuestion[] | null;
  } = {};
  if ('outreachMessage' in record) {
    contact.outreachMessage = parseOutreachText(
      record.outreachMessage,
      OUTREACH_MAX,
      'El mensaje de contacto no es válido.',
      'El mensaje de contacto supera los 4000 caracteres.',
    );
  }
  if ('coverLetter' in record) {
    contact.coverLetter = parseOutreachText(
      record.coverLetter,
      COVER_LETTER_MAX,
      'La carta no es válida.',
      'La carta supera los 8000 caracteres.',
    );
  }
  if ('interviewQuestions' in record) contact.interviewQuestions = parseInterviewQuestions(record.interviewQuestions);
  return contact;
}

function invalidMatch(message: string): never {
  throw new AgentApiError(400, 'invalid_match', message);
}

function boundedText(value: unknown, min: number, max: number, message: string) {
  if (typeof value !== 'string') invalidMatch(message);
  const text = value.trim();
  if (text.length < min || text.length > max) invalidMatch(message);
  return text;
}

function parseBreakdownValue(value: unknown): MatchBreakdown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentApiError(400, 'invalid_score_breakdown', 'El desglose tiene que incluir las cinco dimensiones.');
  }
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).filter((key) => !MATCH_DIMENSION_KEYS.includes(key as MatchDimensionKey));
  if (extra.length || MATCH_DIMENSION_KEYS.some((key) => !(key in record))) {
    throw new AgentApiError(400, 'invalid_score_breakdown', 'El desglose tiene que incluir las cinco dimensiones.');
  }
  const breakdown = {} as MatchBreakdown;
  for (const key of MATCH_DIMENSION_KEYS) {
    const score = record[key];
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100) {
      throw new AgentApiError(400, 'invalid_score_breakdown', 'Cada dimensión tiene que ser un entero entre 0 y 100.');
    }
    breakdown[key] = score;
  }
  return breakdown;
}

function sameBreakdown(left: MatchBreakdown, right: MatchBreakdown) {
  return MATCH_DIMENSION_KEYS.every((key) => left[key] === right[key]);
}

function parseEvidenceQuote(value: unknown, candidate: boolean) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidMatch('La evidencia del requisito no es válida.');
  const record = value as Record<string, unknown>;
  const sourceId = typeof record.sourceId === 'string' ? record.sourceId.trim() : '';
  const quote = typeof record.quote === 'string' ? record.quote.trim() : '';
  if (candidate) {
    if (sourceId !== 'cv' && sourceId !== 'profile') invalidMatch('La evidencia del candidato tiene que citar el currículum o el perfil.');
  } else if (sourceId.length < 1 || sourceId.length > 40) {
    invalidMatch('La cita de la oferta no es válida.');
  }
  if (quote.length < 1 || quote.length > 600) invalidMatch('La cita del requisito no es válida.');
  return { sourceId, quote };
}

function parseOptionalYears(record: Record<string, unknown>, key: string) {
  if (!(key in record) || record[key] == null) return undefined;
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 60) {
    invalidMatch('Los años del requisito no son válidos.');
  }
  return value;
}

function parseOptionalScope(record: Record<string, unknown>, key: string) {
  if (!(key in record) || record[key] == null) return undefined;
  return boundedText(record[key], 1, 80, 'El ámbito de la experiencia no es válido.');
}

function parseRequirements(value: unknown): MatchRequirement[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) {
    invalidMatch('Hace falta entre 1 y 30 requisitos.');
  }
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalidMatch('Hay un requisito que no es válido.');
    const record = item as Record<string, unknown>;
    const id = boundedText(record.id, 1, 80, 'El identificador del requisito no es válido.');
    if (seen.has(id)) invalidMatch('Hay un requisito repetido.');
    seen.add(id);
    if (typeof record.kind !== 'string' || !(REQUIREMENT_KINDS as readonly string[]).includes(record.kind)) {
      invalidMatch('El tipo de requisito no es válido.');
    }
    if (typeof record.importance !== 'string' || !(REQUIREMENT_IMPORTANCE as readonly string[]).includes(record.importance)) {
      invalidMatch('La importancia del requisito no es válida.');
    }
    if (typeof record.core !== 'boolean') invalidMatch('El requisito tiene que indicar si es principal.');
    if (typeof record.status !== 'string' || !(REQUIREMENT_STATUSES as readonly string[]).includes(record.status)) {
      invalidMatch('El estado del requisito no es válido.');
    }
    if (!Array.isArray(record.candidateEvidence) || record.candidateEvidence.length > 8) {
      invalidMatch('La evidencia del candidato no es válida.');
    }
    if (!Array.isArray(record.alternatives) || record.alternatives.length > 8) {
      invalidMatch('Las alternativas del requisito no son válidas.');
    }
    const requirement: MatchRequirement = {
      id,
      name: boundedText(record.name, 1, 200, 'El nombre del requisito no es válido.'),
      kind: record.kind as MatchRequirement['kind'],
      importance: record.importance as MatchRequirement['importance'],
      core: record.core,
      status: record.status as MatchRequirement['status'],
      offerEvidence: parseEvidenceQuote(record.offerEvidence, false),
      candidateEvidence: record.candidateEvidence.map((entry) => parseEvidenceQuote(entry, true)),
      alternatives: record.alternatives.map((entry) => boundedText(entry, 1, 120, 'Las alternativas del requisito no son válidas.')),
    };
    const requiredYears = parseOptionalYears(record, 'requiredYears');
    const candidateYears = parseOptionalYears(record, 'candidateYears');
    if (requiredYears !== undefined) requirement.requiredYears = requiredYears;
    if (candidateYears !== undefined) requirement.candidateYears = candidateYears;
    if ('candidateYearsIsUpperBound' in record && record.candidateYearsIsUpperBound != null) {
      if (typeof record.candidateYearsIsUpperBound !== 'boolean') invalidMatch('La cota de años del candidato no es válida.');
      requirement.candidateYearsIsUpperBound = record.candidateYearsIsUpperBound;
    }
    const experienceScope = parseOptionalScope(record, 'experienceScope');
    const candidateExperienceScope = parseOptionalScope(record, 'candidateExperienceScope');
    if (experienceScope) requirement.experienceScope = experienceScope;
    if (candidateExperienceScope) requirement.candidateExperienceScope = candidateExperienceScope;
    return requirement;
  });
}

function parseAdjustments(value: unknown, requirementIds: Set<string>): MatchAdjustment[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) invalidMatch('Los ajustes de la puntuación no son válidos.');
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalidMatch('Los ajustes de la puntuación no son válidos.');
    const record = item as Record<string, unknown>;
    if (typeof record.code !== 'string' || !(ADJUSTMENT_CODES as readonly string[]).includes(record.code)) {
      invalidMatch('El ajuste de puntuación no es válido.');
    }
    if (!Array.isArray(record.requirementIds) || record.requirementIds.some((id) => typeof id !== 'string' || !requirementIds.has(id))) {
      invalidMatch('El ajuste cita un requisito que no existe.');
    }
    if (typeof record.overallCap !== 'number' || !Number.isInteger(record.overallCap) || record.overallCap < 0 || record.overallCap > 100) {
      invalidMatch('El tope del ajuste tiene que ser un entero entre 0 y 100.');
    }
    const adjustment: MatchAdjustment = {
      code: record.code as MatchAdjustment['code'],
      requirementIds: record.requirementIds as string[],
      overallCap: record.overallCap,
      reason: boundedText(record.reason, 1, 500, 'La razón del ajuste no es válida.'),
    };
    const hasDimension = 'dimension' in record && record.dimension != null;
    const hasDimensionCap = 'dimensionCap' in record && record.dimensionCap != null;
    if (hasDimension || hasDimensionCap) {
      if (!hasDimension || typeof record.dimension !== 'string' || !MATCH_DIMENSION_KEYS.includes(record.dimension as MatchDimensionKey)) {
        invalidMatch('La dimensión del ajuste no es válida.');
      }
      if (typeof record.dimensionCap !== 'number' || !Number.isInteger(record.dimensionCap) || record.dimensionCap < 0 || record.dimensionCap > 100) {
        invalidMatch('El tope de la dimensión tiene que ser un entero entre 0 y 100.');
      }
      adjustment.dimension = record.dimension as MatchDimensionKey;
      adjustment.dimensionCap = record.dimensionCap;
    }
    return adjustment;
  });
}

function parseRequirementIdList(value: unknown, requirementIds: Set<string>, message: string) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !requirementIds.has(id))) invalidMatch(message);
  return value as string[];
}

function parseMatchDetailsInput(value: unknown, requirementIds: Set<string>): ParsedMatchCard['details'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidMatch('La explicación del encaje no es válida.');
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.dimensions)) invalidMatch('La evaluación tiene que explicar las cinco dimensiones.');
  const seen = new Set<string>();
  const dimensions = record.dimensions.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalidMatch('La evaluación tiene que explicar las cinco dimensiones.');
    const row = item as Record<string, unknown>;
    if (typeof row.key !== 'string' || !MATCH_DIMENSION_KEYS.includes(row.key as MatchDimensionKey) || seen.has(row.key)) {
      invalidMatch('La evaluación tiene que explicar las cinco dimensiones.');
    }
    seen.add(row.key);
    return {
      key: row.key as MatchDimensionKey,
      explanation: boundedText(row.explanation, 1, 1_000, 'La explicación de una dimensión no es válida.'),
      requirementIds: parseRequirementIdList(row.requirementIds, requirementIds, 'Una dimensión cita un requisito que no existe.'),
    };
  });
  if (MATCH_DIMENSION_KEYS.some((key) => !seen.has(key))) {
    invalidMatch('La evaluación tiene que explicar las cinco dimensiones.');
  }
  if (!Array.isArray(record.requirements) || record.requirements.length > 30) {
    invalidMatch('La explicación de los requisitos no es válida.');
  }
  const requirements = record.requirements.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalidMatch('La explicación de los requisitos no es válida.');
    const row = item as Record<string, unknown>;
    if (typeof row.requirementId !== 'string' || !requirementIds.has(row.requirementId)) {
      invalidMatch('La explicación cita un requisito que no existe.');
    }
    return {
      requirementId: row.requirementId,
      explanation: boundedText(row.explanation, 1, 1_000, 'La explicación de un requisito no es válida.'),
    };
  });
  if (!Array.isArray(record.nextSteps) || record.nextSteps.length < 1 || record.nextSteps.length > 8) {
    invalidMatch('Hace falta entre 1 y 8 pasos siguientes.');
  }
  return {
    summary: boundedText(record.summary, 1, 2_000, 'El resumen de la evaluación no es válido.'),
    dimensions,
    requirements,
    nextSteps: record.nextSteps.map((item) => boundedText(item, 1, 300, 'Hay un paso siguiente que no es válido.')),
  };
}

function matchEvidenceRecord(record: Record<string, unknown>) {
  if (!('matchEvidence' in record) || record.matchEvidence == null) return null;
  if (typeof record.matchEvidence !== 'object' || Array.isArray(record.matchEvidence)) {
    invalidMatch('La evidencia de encaje no es válida.');
  }
  return record.matchEvidence as Record<string, unknown>;
}

/** Returns null when the body is a loose score. A partial card is an error, never a guess. */
export function parseMatchCard(record: Record<string, unknown>): ParsedMatchCard | null {
  if (!MATCH_CARD_KEYS.some((key) => key in record)) return null;
  if (!('scoreOverall' in record) || record.scoreOverall === null) {
    throw new AgentApiError(
      400,
      'invalid_score',
      record.scoreOverall === null
        ? 'No se puede borrar la puntuación y enviar el desglose a la vez.'
        : 'La ficha necesita una puntuación entera entre 0 y 100.',
    );
  }
  const scoreOverall = parseScoreOverall(record.scoreOverall);
  if (scoreOverall === null) {
    throw new AgentApiError(400, 'invalid_score', 'La ficha necesita una puntuación entera entre 0 y 100.');
  }
  const evidence = matchEvidenceRecord(record);
  let scoreBreakdown: MatchBreakdown | undefined;
  if ('scoreBreakdown' in record) scoreBreakdown = parseBreakdownValue(record.scoreBreakdown);
  if (evidence && 'scoreBreakdown' in evidence) {
    const nested = parseBreakdownValue(evidence.scoreBreakdown);
    if (scoreBreakdown && !sameBreakdown(scoreBreakdown, nested)) {
      throw new AgentApiError(400, 'invalid_score_breakdown', 'El desglose de la raíz y el de la evidencia no coinciden.');
    }
    scoreBreakdown = nested;
  }
  if (!scoreBreakdown) {
    throw new AgentApiError(400, 'invalid_score_breakdown', 'El desglose tiene que incluir las cinco dimensiones.');
  }
  const requirements = parseRequirements(evidence ? evidence.requirements : record.requirements);
  const adjustmentSource = evidence && 'adjustments' in evidence
    ? evidence.adjustments
    : ('adjustments' in record ? record.adjustments : []);
  const adjustments = parseAdjustments(adjustmentSource, new Set(requirements.map((item) => item.id)));
  const details = parseMatchDetailsInput(record.matchDetails, new Set(requirements.map((item) => item.id)));
  const expected = Math.min(computeOverall(scoreBreakdown), ...adjustments.map((item) => item.overallCap));
  if (scoreOverall !== expected) {
    throw new AgentApiError(400, 'invalid_score', 'La puntuación no coincide con el desglose.');
  }
  return { scoreOverall, scoreBreakdown, requirements, adjustments, details };
}

export type CreateApplicationInput = {
  title: string;
  company: string;
  url: string | null;
  platform: string;
  description: string | null;
  status: PipelineStatus;
  cvId: string | null;
  externalId: string | null;
  nextFollowupDate: Date | null;
  followupProvided?: boolean;
  nextAction?: string | null;
  note?: string;
  tldr?: string | null;
  scoreOverall?: number | null;
  matchCard?: ParsedMatchCard;
  outreachMessage?: string | null;
  coverLetter?: string | null;
  interviewQuestions?: AgentInterviewQuestion[] | null;
};

function parseNextAction(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 1000) throw new AgentApiError(400, 'invalid_next_action', 'La próxima acción no es válida.');
  return value.trim() || null;
}

export function parseCreateApplicationBody(value: unknown): CreateApplicationInput {
  const record = asRecord(value);
  if (!('title' in record) || !('company' in record)) {
    throw new AgentApiError(400, 'invalid_body', 'Hacen falta el puesto y la empresa.');
  }
  return {
    title: parseJobTitleValue(record.title),
    company: parseCompanyValue(record.company),
    url: 'url' in record ? parseUrlValue(record.url) : null,
    platform: 'platform' in record && record.platform != null && record.platform !== ''
      ? parsePlatformValue(record.platform)
      : 'other',
    description: 'description' in record ? parseDescriptionValue(record.description) : null,
    status: 'status' in record && record.status != null && record.status !== ''
      ? parseAgentStatus(record.status)
      : 'interested',
    cvId: 'cvId' in record ? parseCvIdValue(record.cvId) : null,
    externalId: parseExternalIdValue(record.externalId),
    nextFollowupDate: 'nextFollowupDate' in record ? parseFollowupValue(record.nextFollowupDate) : null,
    followupProvided: 'nextFollowupDate' in record,
    ...('nextAction' in record ? { nextAction: parseNextAction(record.nextAction) } : {}),
    note: parseNoteValue(record.note),
    ...parseContactFields(record),
    ...('tldr' in record ? { tldr: parseTldr(record.tldr) } : {}),
    ...matchWrite(record),
  };
}

export type PatchApplicationInput = Partial<CreateApplicationInput> & {
  note?: string;
  scoreOverall?: number | null;
  tldr?: string | null;
};

export function parsePatchApplicationBody(value: unknown): PatchApplicationInput {
  const record = asRecord(value);
  const patch: PatchApplicationInput = {};
  if ('title' in record) patch.title = parseJobTitleValue(record.title);
  if ('company' in record) patch.company = parseCompanyValue(record.company);
  if ('url' in record) patch.url = parseUrlValue(record.url);
  if ('platform' in record) patch.platform = parsePlatformValue(record.platform);
  if ('description' in record) patch.description = parseDescriptionValue(record.description);
  if ('status' in record) patch.status = parseAgentStatus(record.status);
  if ('cvId' in record) patch.cvId = parseCvIdValue(record.cvId);
  if ('externalId' in record) patch.externalId = parseExternalIdValue(record.externalId);
  if ('nextAction' in record) patch.nextAction = parseNextAction(record.nextAction);
  if ('nextFollowupDate' in record) patch.nextFollowupDate = parseFollowupValue(record.nextFollowupDate);
  if ('tldr' in record) patch.tldr = parseTldr(record.tldr);
  Object.assign(patch, parseContactFields(record), matchWrite(record));
  if ('note' in record) {
    const note = parseNoteValue(record.note);
    if (note) patch.note = note;
  }
  if (!Object.keys(patch).length) {
    throw new AgentApiError(400, 'empty_patch', 'No hay cambios que guardar.');
  }
  return patch;
}

export type AgentEvaluationInput = {
  id: string;
  scoreOverall: number;
  tldr?: string | null;
  matchCard?: ParsedMatchCard;
};

function matchWrite(record: Record<string, unknown>): { matchCard?: ParsedMatchCard; scoreOverall?: number | null } {
  const matchCard = parseMatchCard(record);
  if (matchCard) return { matchCard, scoreOverall: matchCard.scoreOverall };
  if ('scoreOverall' in record) return { scoreOverall: parseScoreOverall(record.scoreOverall) };
  return {};
}

export function parseBatchEvaluationsBody(value: unknown): AgentEvaluationInput[] {
  const record = asRecord(value);
  const evaluations = record.evaluations;
  if (!Array.isArray(evaluations) || evaluations.length < 1 || evaluations.length > EVALUATION_BATCH_MAX) {
    throw new AgentApiError(400, 'invalid_body', 'Hace falta una lista de entre 1 y 200 evaluaciones.');
  }
  const seen = new Set<string>();
  return evaluations.map((item, index) => {
    const entry = asRecord(item);
    if (!('id' in entry) || typeof entry.id !== 'string' || !isUuid(entry.id)) {
      throw new AgentApiError(400, 'invalid_body', `La evaluación ${index + 1} no tiene un identificador válido.`);
    }
    if (seen.has(entry.id)) {
      throw new AgentApiError(400, 'invalid_body', 'La lista repite una candidatura.');
    }
    seen.add(entry.id);
    if (!('scoreOverall' in entry)) {
      throw new AgentApiError(400, 'invalid_score', 'Cada evaluación necesita una puntuación.');
    }
    const scoreOverall = parseScoreOverall(entry.scoreOverall);
    if (scoreOverall === null) {
      throw new AgentApiError(400, 'invalid_score', 'La puntuación del lote tiene que ser un entero entre 0 y 100.');
    }
    const written = matchWrite(entry);
    const evaluation: AgentEvaluationInput = { id: entry.id, scoreOverall };
    if (written.matchCard) evaluation.matchCard = written.matchCard;
    if ('tldr' in entry) evaluation.tldr = parseTldr(entry.tldr);
    return evaluation;
  });
}

export type CreateCvInput = {
  title?: string;
  content?: string;
  duplicateFromId?: string;
};

export function parseCreateCvBody(value: unknown): CreateCvInput {
  const record = asRecord(value);
  const input: CreateCvInput = {};
  if ('title' in record && record.title != null && record.title !== '') input.title = parseCvTitle(record.title);
  if ('content' in record && record.content != null) input.content = parseCvContent(record.content);
  if ('duplicateFromId' in record && record.duplicateFromId != null && record.duplicateFromId !== '') {
    input.duplicateFromId = parseUuid(record.duplicateFromId, 'invalid_cv', 'El currículum de origen no es válido.');
  }
  if (!input.title && !input.duplicateFromId) {
    throw new AgentApiError(400, 'invalid_title', 'El título del currículum no es válido.');
  }
  return input;
}

export function parseViewName(value: unknown) {
  try {
    return normalizeCrmViewName(value);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_NAME') {
      throw new AgentApiError(400, 'invalid_name', 'El nombre de la vista no es válido.');
    }
    throw error;
  }
}

export function parseCrmEntity(value: unknown): CrmEntity {
  if (!isCrmEntity(value)) throw new AgentApiError(400, 'invalid_entity', 'La entidad no es válida.');
  return value;
}

export function parsePageValue(value: unknown) {
  if (value == null || value === '') return 1;
  const page = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(page) || page < 1) throw new AgentApiError(400, 'invalid_page', 'La página no es válida.');
  return page;
}

export function parseIdBatch(value: unknown, max = EVALUATION_BATCH_MAX) {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) {
    throw new AgentApiError(400, 'invalid_ids', 'La lista de identificadores no es válida.');
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== 'string' || !isUuid(id) || seen.has(id)) {
      throw new AgentApiError(400, 'invalid_ids', 'La lista de identificadores no es válida.');
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function parseStatusBatchBody(value: unknown) {
  const record = asRecord(value);
  return { ids: parseIdBatch(record.ids), status: parseAgentStatus(record.status) };
}

export function parseFavoritesBody(value: unknown) {
  const record = asRecord(value);
  if (typeof record.isFavorite !== 'boolean') {
    throw new AgentApiError(400, 'invalid_body', 'Indica si la fila queda como favorita.');
  }
  return { entity: parseCrmEntity(record.entity), ids: parseIdBatch(record.ids), isFavorite: record.isFavorite };
}

export function parsePeopleStatusBody(value: unknown) {
  const record = asRecord(value);
  if (typeof record.status !== 'string' || !(PERSON_STATUSES as readonly string[]).includes(record.status)) {
    throw new AgentApiError(400, 'invalid_status', 'El estado no es válido.');
  }
  return { ids: parseIdBatch(record.ids), status: record.status };
}

export function parseCompanyRelation(value: unknown) {
  if (typeof value !== 'string' || !(COMPANY_RELATIONS as readonly string[]).includes(value)) {
    throw new AgentApiError(400, 'invalid_body', 'La relación no es válida.');
  }
  return value;
}

const PERSON_FIELDS = ['name', 'linkedinUrl', 'email', 'role', 'headline', 'location', 'kind', 'status', 'origin', 'objective', 'topics', 'notes', 'nextAction', 'nextFollowupAt', 'language', 'tone', 'connectionDegree'] as const;

export function parsePersonBody(value: unknown): PersonInput {
  const record = asRecord(value);
  const input: Record<string, unknown> = {};
  for (const key of PERSON_FIELDS) {
    if (key in record) input[key] = record[key];
  }
  if (typeof input.name !== 'string') throw new AgentApiError(400, 'invalid_body', 'La persona necesita un nombre.');
  return input as PersonInput;
}

export function parseCompanyWrite(value: unknown) {
  const record = asRecord(value);
  if (typeof record.name !== 'string') throw new AgentApiError(400, 'invalid_name', 'La empresa necesita un nombre.');
  const text = (key: string) => (typeof record[key] === 'string' ? record[key] as string : null);
  return {
    name: record.name,
    website: 'website' in record ? text('website') : undefined,
    location: 'location' in record ? text('location') : undefined,
    sector: 'sector' in record ? text('sector') : undefined,
  };
}
