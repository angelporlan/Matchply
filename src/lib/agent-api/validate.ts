import { PIPELINE_STATUSES, type PipelineStatus } from '@/lib/application-service';
import { AgentApiError } from '@/lib/agent-api/errors';
import { normalizeCareerProfileFields } from '@/lib/career-profile';
import { COMPANY_NOTE_MAX, normalizeCompanyName } from '@/lib/company-service';
import { parseMatchConstraints } from '@/lib/curation-constraints';

export const CV_CONTENT_MAX = 400_000;
export const CV_TITLE_MAX = 120;
export const APPLICATION_DESCRIPTION_MAX = 100_000;
export const JOB_TITLE_MAX = 200;
export const EXTERNAL_ID_MAX = 120;
export const URL_MAX = 2_000;
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
  note?: string;
};

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
    note: parseNoteValue(record.note),
  };
}

export type PatchApplicationInput = Partial<CreateApplicationInput> & { note?: string };

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
  if ('nextFollowupDate' in record) patch.nextFollowupDate = parseFollowupValue(record.nextFollowupDate);
  if ('note' in record) {
    const note = parseNoteValue(record.note);
    if (note) patch.note = note;
  }
  if (!Object.keys(patch).length) {
    throw new AgentApiError(400, 'empty_patch', 'No hay cambios que guardar.');
  }
  return patch;
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
