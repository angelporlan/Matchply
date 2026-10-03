import { COMPANY_RELATIONS, CONVERSATION_CHANNELS, PERSON_KINDS, PERSON_STATUSES, PeopleError, type PersonInput, type MessageInput, type LinkedInPersonCapture, UUID_PATTERN } from './types';

export function id(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new PeopleError('PEOPLE_INVALID_ID');
  return value;
}
export function text(value: unknown, max: number, required = false): string | null {
  if (value == null || value === '') { if (required) throw new PeopleError('PEOPLE_REQUIRED'); return null; }
  if (typeof value !== 'string' || value.length > max || /\u0000/.test(value)) throw new PeopleError('PEOPLE_INVALID_TEXT');
  const clean = value.trim();
  if (required && !clean) throw new PeopleError('PEOPLE_REQUIRED');
  return clean || null;
}
export function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new PeopleError('PEOPLE_INVALID_CHOICE');
  return value as T;
}
export function linkedinUrl(value: unknown): string | null {
  const raw = text(value, 2000);
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { throw new PeopleError('PEOPLE_INVALID_LINKEDIN'); }
  if (url.protocol !== 'https:' || !/(^|\.)linkedin\.com$/i.test(url.hostname) || url.username || url.password || url.port) throw new PeopleError('PEOPLE_INVALID_LINKEDIN');
  const match = url.pathname.match(/^\/in\/([^/]+)\/?$/i);
  if (!match) throw new PeopleError('PEOPLE_INVALID_LINKEDIN');
  let slug: string;
  try { slug = decodeURIComponent(match[1]).normalize('NFC').toLowerCase(); } catch { throw new PeopleError('PEOPLE_INVALID_LINKEDIN'); }
  if (/[\/\s?#]/.test(slug)) throw new PeopleError('PEOPLE_INVALID_LINKEDIN');
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
}
export function date(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) throw new PeopleError('PEOPLE_INVALID_DATE');
  const calendar = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new PeopleError('PEOPLE_INVALID_DATE');
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value);
  if (!Number.isFinite(parsed.getTime()) || (value.length === 10 && parsed.toISOString().slice(0, 10) !== value)) throw new PeopleError('PEOPLE_INVALID_DATE');
  return parsed;
}
export function personInput(input: PersonInput) {
  const email = text(input.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PeopleError('PEOPLE_INVALID_EMAIL');
  return {
    name: text(input.name, 180, true)!, linkedinUrl: linkedinUrl(input.linkedinUrl), email,
    role: text(input.role, 240), headline: text(input.headline, 1000), location: text(input.location, 240),
    kind: choice(input.kind, PERSON_KINDS, 'other'), status: choice(input.status, PERSON_STATUSES, 'pending'),
    origin: text(input.origin, 1000), objective: text(input.objective, 4000), topics: text(input.topics, 4000), notes: text(input.notes, 12000),
    nextAction: text(input.nextAction, 1000), nextFollowupAt: date(input.nextFollowupAt),
    language: choice(input.language, ['es', 'en'] as const, 'es'),
    tone: choice(input.tone, ['professional', 'friendly', 'direct', 'formal'] as const, 'professional'),
    connectionDegree: text(input.connectionDegree, 80),
  };
}
export function messageInput(input: MessageInput) {
  return { author: choice(input.author, ['self', 'contact', 'unknown'] as const, 'unknown'), content: text(input.content, 120000, true)!, sentAt: date(input.sentAt) };
}
export function captureInput(value: unknown): LinkedInPersonCapture[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new PeopleError('PEOPLE_INVALID_CAPTURE');
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new PeopleError('PEOPLE_INVALID_CAPTURE');
    return { name: text(item.name, 180, true)!, profileUrl: linkedinUrl(item.profileUrl) || (() => { throw new PeopleError('PEOPLE_INVALID_LINKEDIN'); })(),
      headline: text(item.headline, 1000), connectionDegree: text(item.connectionDegree, 80), source: choice(item.source, ['hiring_team', 'network'] as const, 'network') };
  });
}
export const relationInput = (value: unknown) => choice(value, COMPANY_RELATIONS, 'unconfirmed');
export const channelInput = (value: unknown) => choice(value, CONVERSATION_CHANNELS, 'linkedin');
