import {
  buildOfferSignalPrefix,
  detectOfferLanguage,
  detectRequiredEnglishLevel,
  extractLanguageSentences,
  type OfferLanguage,
} from '@/lib/curation-constraints';
import type { MatchKind, MatchOfferCard, OfferWorkplace } from './types';

const REQUIREMENTS_HEADING =
  /(?:^|\n)\s*(?:#{1,3}\s*)?(?:requisitos|requirements|must[\s-]?haves?|qualifications|se requiere|qué pedimos|what (?:you'?ll|you will) need|you (?:should|must) have)[^\n]*\n/i;

const WORKPLACE_REMOTE = /\b(remote|remoto|teletrabajo|100%\s*remote|fully\s*remote)\b/i;
const WORKPLACE_HYBRID = /\b(hybrid|h[ií]brido)\b/i;
const WORKPLACE_ONSITE = /\b(onsite|on-site|presencial|oficina|in-office|on site)\b/i;

export function detectOfferWorkplace(input: {
  title?: string | null;
  description?: string | null;
  sourceMetadata?: unknown;
}): OfferWorkplace {
  const meta = input.sourceMetadata && typeof input.sourceMetadata === 'object'
    ? input.sourceMetadata as Record<string, unknown>
    : {};
  const workplaceMeta = typeof meta.workplaceType === 'string' ? meta.workplaceType : '';
  const haystack = `${workplaceMeta} ${input.title || ''} ${input.description || ''}`;

  if (WORKPLACE_REMOTE.test(haystack) && !WORKPLACE_ONSITE.test(haystack) && !WORKPLACE_HYBRID.test(haystack)) {
    return 'remote';
  }
  if (WORKPLACE_HYBRID.test(haystack)) return 'hybrid';
  if (WORKPLACE_ONSITE.test(haystack)) return 'onsite';
  if (WORKPLACE_REMOTE.test(haystack)) return 'remote';
  return 'unknown';
}

export function extractOfferSalaryMax(text: string | null | undefined): number | null {
  if (!text) return null;
  const pattern = /(?:€\s*)?(\d{2,3}(?:[.\s]\d{3})|\d{2,3}(?:[.,]\d{1,2})?)\s*(k|mil)?(?:\s*(?:€|eur|euros?))?/gi;
  let max: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = (match[1] || '').replace(/\s/g, '').replace(',', '.');
    let value = Number(raw.replace(/\.(?=\d{3}\b)/g, ''));
    if (!Number.isFinite(value)) continue;
    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k' || suffix === 'mil' || (value > 0 && value < 400 && /k\b/i.test(match[0]))) {
      value *= 1000;
    }
    if (value < 8000 || value > 400000) continue;
    if (max === null || value > max) max = value;
  }
  return max === null ? null : Math.round(max);
}

function extractRequirementsSection(description: string, maxChars: number): string {
  const text = description.replace(/\r/g, '').trim();
  if (!text) return '';

  const heading = text.match(REQUIREMENTS_HEADING);
  if (heading && heading.index != null) {
    const rest = text.slice(heading.index + heading[0].length);
    const nextHeading = rest.search(/\n\s*#{1,3}\s+\S/);
    const body = (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).replace(/\s+/g, ' ').trim();
    if (body.length >= 40) return body.slice(0, maxChars);
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  const headLen = Math.floor(maxChars * 0.35);
  const tailLen = maxChars - headLen - 5;
  return `${cleaned.slice(0, headLen)} […] ${cleaned.slice(-tailLen)}`;
}

export function buildOfferCard(
  offer: {
    id: string;
    title: string;
    company: string;
    description?: string | null;
    platform?: string | null;
    tldr?: string | null;
    sourceMetadata?: unknown;
  },
  kind: MatchKind,
): MatchOfferCard {
  const maxChars = kind === 'deep' ? 8000 : 1200;
  const description = offer.description || '';
  const language: OfferLanguage = detectOfferLanguage({
    title: offer.title,
    description,
    sourceMetadata: offer.sourceMetadata,
  });
  const workplace = detectOfferWorkplace({
    title: offer.title,
    description,
    sourceMetadata: offer.sourceMetadata,
  });
  const salaryMax = extractOfferSalaryMax(`${offer.title} ${description}`);
  const requiredEnglish = detectRequiredEnglishLevel(`${offer.title}\n${description}`);
  const signals = buildOfferSignalPrefix({
    title: offer.title,
    description,
    sourceMetadata: offer.sourceMetadata,
  });
  const languageSentences = extractLanguageSentences(description);
  const requirements = extractRequirementsSection(description, maxChars);
  const extras = [
    languageSentences,
    salaryMax ? `salario_max:${salaryMax}` : '',
    requiredEnglish ? `ingles_exigido:${requiredEnglish}` : '',
  ].filter(Boolean).join(' ');

  const meta = offer.sourceMetadata && typeof offer.sourceMetadata === 'object'
    ? offer.sourceMetadata as Record<string, unknown>
    : {};

  return {
    id: offer.id,
    title: offer.title,
    company: offer.company,
    platform: offer.platform || undefined,
    language,
    workplace,
    salaryMax,
    requiredEnglish,
    location: typeof meta.location === 'string' ? meta.location.slice(0, 80) : undefined,
    tldr: offer.tldr ? String(offer.tldr).slice(0, 220) : undefined,
    signals,
    requirementsExtract: extras
      ? `${requirements}${requirements ? ' ' : ''}[${extras}]`.slice(0, maxChars + 120)
      : requirements,
  };
}

export function serializeOfferCard(card: MatchOfferCard): string {
  return JSON.stringify({
    id: card.id,
    title: card.title,
    company: card.company,
    language: card.language,
    workplace: card.workplace,
    salaryMax: card.salaryMax,
    requiredEnglish: card.requiredEnglish,
    location: card.location || '',
    tldr: card.tldr || '',
    requirementsExtract: card.requirementsExtract,
  });
}
