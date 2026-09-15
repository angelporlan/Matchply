import {
  buildOfferSignalPrefix,
  detectOfferLanguage,
  detectRequiredEnglishLevel,
  detectOfferLanguageRequirements,
  type OfferLanguage,
} from '@/lib/curation-constraints';
import type { MatchKind, MatchOfferCard, OfferWorkplace } from './types';
import { evidenceHash } from './canonical';

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

type SectionKind = 'requirements' | 'responsibilities' | 'conditions' | 'noise' | 'unknown';
const REQUIREMENTS = /^(?:requisitos(?: indispensables| obligatorios| deseables)?|requirements|must[ -]?haves?|qualifications|preferred qualifications|minimum qualifications|what we are looking for|what (?:you.ll|you will) need|what you bring|perfil buscado|tu perfil|qu[eé] (?:pedimos|buscamos|necesitas)|se requiere|you (?:should|must) have)\b/i;
const RESPONSIBILITIES = /^(?:responsibilities|responsabilidades|funciones|your role|the role|what you(?:.ll| will) do|qu[eé] har[aá]s|tu misi[oó]n)\b/i;
const CONDITIONS = /^(?:salary|salario|compensation|location|ubicaci[oó]n|modalidad|working (?:hours|arrangements)|condiciones)\b/i;
const NOISE = /^(?:benefits|perks|beneficios|qu[eé] ofrecemos|what we offer|about us|about the company|sobre nosotros|qui[eé]nes somos|equal opportunity|diversity|igualdad de oportunidades|por qu[eé] (?:trabajar|unirte))\b/i;
const IMPORTANT = /\b(?:required|mandatory|must|indispensable|obligatori[oa]|imprescindible|requisito|years? (?:of|in)|a[nñ]os? (?:de|en)|salario|salary|compensation|remot[eo]|hybrid|h[ií]brid[oa]|presencial|c[12]|b[12]|english|ingl[eé]s|german|alem[aá]n|fran[cç][eé]s|french)\b/i;

function plainDescription(value: string): string {
  return value.replace(/<\/(?:p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\r/g, '').trim();
}

function sectionHeading(line: string): SectionKind | null {
  const clean = line.replace(new RegExp('^[^\\p{L}\\p{N}]+', 'u'), '').replace(/[*_#]/g, '').trim();
  if (clean.length > 150) return null;
  if (REQUIREMENTS.test(clean)) return 'requirements';
  if (RESPONSIBILITIES.test(clean)) return 'responsibilities';
  if (CONDITIONS.test(clean)) return 'conditions';
  if (NOISE.test(clean)) return 'noise';
  return null;
}

/** Keep whole lines/paragraphs; requirements in the middle or following benefits are never head/tail-truncated. */
export function extractRequirementsSection(description: string, maxChars = 14000): { text: string; complete: boolean } {
  const lines = plainDescription(description).split('\n').map((line) => line.trim()).filter(Boolean);
  let section: SectionKind = 'unknown';
  const selected: Array<{ line: string; priority: number; order: number }> = [];
  lines.forEach((line, order) => {
    const heading = sectionHeading(line);
    if (heading) section = heading;
    // Conditions can occur inside a benefits block: do not lose salary, language or location evidence.
    if (section === 'noise' && !IMPORTANT.test(line)) return;
    const priority = IMPORTANT.test(line) ? 0 : section === 'requirements' ? 1
      : section === 'responsibilities' || section === 'conditions' ? 2 : 3;
    selected.push({ line, priority, order });
  });
  const total = selected.reduce((sum, row) => sum + row.line.length + 1, 0);
  if (total <= maxChars) return { text: selected.map((row) => row.line).join('\n'), complete: true };
  let used = 0;
  const kept = selected.sort((a, b) => a.priority - b.priority || a.order - b.order)
    .filter((row) => {
      if (used + row.line.length + 1 > maxChars) return false;
      used += row.line.length + 1;
      return true;
    }).sort((a, b) => a.order - b.order);
  return { text: kept.map((row) => row.line).join('\n'), complete: false };
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
  // Scoring sees identical facts in batch and detail; only explanations differ.
  const maxChars = 14000;
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
  const requirements = extractRequirementsSection(description, maxChars);
  const sourceText = `${offer.title}\n${plainDescription(description)}`;
  const sourceHash = evidenceHash({ title: offer.title, company: offer.company, description, sourceMetadata: offer.sourceMetadata ?? null });

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
    signals,
    requirementsExtract: requirements.text,
    sourceText, sourceHash,
    languageRequirements: detectOfferLanguageRequirements(sourceText),
    complete: requirements.complete,
    sufficient: description.trim().length >= 40 && requirements.text.length >= 30,
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
    sourceHash: card.sourceHash,
    complete: card.complete,
    requirementsExtract: card.requirementsExtract,
  });
}
