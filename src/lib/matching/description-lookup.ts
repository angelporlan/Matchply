/** A list capture stores the card, not the job description. Decisions cannot search; the match worker looks the description up first. */

const PERMANENT_LOOKUP_FAILURES = new Set([
  'NO_URL',
  'OFFER_URL_INVALID',
  'OFFER_URL_BLOCKED',
  'OFFER_NOT_FOUND',
  'OFFER_SOURCE_MISMATCH',
]);

const FAILURE_MESSAGES: Record<string, string> = {
  NO_URL: 'Esta oferta no tiene un enlace público para buscar su descripción.',
  OFFER_URL_INVALID: 'El enlace de la oferta no se puede consultar.',
  OFFER_URL_BLOCKED: 'El enlace de la oferta no se puede consultar.',
  OFFER_NOT_FOUND: 'No se encontró la descripción pública de esta oferta. Ábrela y vuelve a capturarla para calcular el match.',
  OFFER_SOURCE_MISMATCH: 'La búsqueda no confirmó esta oferta. Ábrela y vuelve a capturarla para calcular el match.',
};

/** Automatic match retries stay inside this window, so a confirmed miss is not searched again. */
export const LOOKUP_FAILURE_TTL_MS = 2 * 60 * 60 * 1000;
// A newer retrieval strategy must retry misses recorded by the previous one.
const LOOKUP_FAILURE_VERSION = 2;

export type DescriptionLookupDecision =
  | { action: 'ready' }
  | { action: 'search'; url: string }
  | { action: 'fail'; code: string; message: string; remember: boolean };

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizedLine(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Card text is the title, company and place lines already stored on the offer. Anything else was written on purpose. */
export function isListCardDump(offer: {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  sourceMetadata?: unknown;
}): boolean {
  const lines = String(offer.description || '').split(/\n+/).map(normalizedLine).filter(Boolean);
  if (!lines.length) return true;
  const meta = metadataRecord(offer.sourceMetadata);
  const parts = new Set([
    offer.title, offer.company, meta.location, meta.workplaceType, meta.employmentType, meta.postedAt, meta.salaryVisible,
  ].map(normalizedLine).filter(Boolean));
  return lines.every(line => parts.has(line));
}

/** Search a blank offer or a list capture that still only has the card. Leave real notes and full descriptions alone. */
export function offerNeedsDescriptionLookup(offer: {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  sourceMetadata?: unknown;
}): boolean {
  const description = String(offer.description || '').trim();
  if (metadataRecord(offer.sourceMetadata).captureKind === 'list') {
    if (!description) return true;
    return isListCardDump(offer);
  }
  return !description;
}

export function isPermanentLookupFailure(code: string): boolean {
  return PERMANENT_LOOKUP_FAILURES.has(code);
}

export function lookupFailureMessage(code: string): string {
  return FAILURE_MESSAGES[code] || 'No se pudo recuperar la descripción de la oferta. Vuelve a intentarlo.';
}

export function rememberedLookupFailure(
  sourceMetadata: unknown,
  url: string | null | undefined,
  now = Date.now(),
): string | null {
  const lookup = metadataRecord(sourceMetadata).descriptionLookup;
  if (!lookup || typeof lookup !== 'object' || Array.isArray(lookup)) return null;
  const record = lookup as Record<string, unknown>;
  if (record.version !== LOOKUP_FAILURE_VERSION) return null;
  if (record.status !== 'failed' || typeof record.code !== 'string' || !isPermanentLookupFailure(record.code)) return null;
  if ((typeof record.url === 'string' ? record.url : '') !== String(url || '').trim()) return null;
  if (typeof record.at !== 'string') return null;
  const at = Date.parse(record.at);
  if (!Number.isFinite(at) || at > now + 60_000 || now - at >= LOOKUP_FAILURE_TTL_MS) return null;
  return record.code;
}

export function decideDescriptionLookup(offer: {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  url?: string | null;
  sourceMetadata?: unknown;
}, now = Date.now()): DescriptionLookupDecision {
  if (!offerNeedsDescriptionLookup(offer)) return { action: 'ready' };
  const remembered = rememberedLookupFailure(offer.sourceMetadata, offer.url, now);
  if (remembered) return { action: 'fail', code: remembered, message: lookupFailureMessage(remembered), remember: false };
  const url = String(offer.url || '').trim();
  if (!url) return { action: 'fail', code: 'NO_URL', message: lookupFailureMessage('NO_URL'), remember: true };
  return { action: 'search', url };
}

export function classifyLookupError(error: unknown): { code: string; message: string; remember: boolean } {
  const code = error instanceof Error && error.message.startsWith('OFFER_') ? error.message : 'OFFER_LOOKUP_FAILED';
  return { code, message: lookupFailureMessage(code), remember: isPermanentLookupFailure(code) };
}

export function failedLookupMetadata(existing: unknown, code: string, url: string, at = new Date().toISOString()): Record<string, unknown> {
  return { ...metadataRecord(existing), descriptionLookup: { version: LOOKUP_FAILURE_VERSION, status: 'failed', code, url, at } };
}

export function recoveredDescriptionMetadata(
  existing: unknown,
  sources: string[],
  sourceMethod: 'direct' | 'web_search' | 'manual',
): Record<string, unknown> {
  const next = { ...metadataRecord(existing) };
  delete next.descriptionLookup;
  const clean = sources.filter(source => source.trim()).map(source => source.trim().slice(0, 500)).slice(0, 8);
  return {
    ...next,
    captureKind: 'detail',
    descriptionSource: sourceMethod === 'direct' ? 'public_page' : 'web_search',
    ...(clean.length ? { descriptionSources: clean } : {}),
  };
}
