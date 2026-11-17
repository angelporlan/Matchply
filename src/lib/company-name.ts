export const COMPANY_NAME_MAX = 120;

// Keep these expressions compatible with JavaScript and PostgreSQL AREs.
export const COMPANY_LEADING_SEPARATORS = String.raw`^[\s,;:.|·•–—-]+`;
export const LINKEDIN_CONTACT_INDICATOR = String.raw`^(?:[0-9][0-9., ]*\+?\s+)?(?:contactos?|conexiones?|connections?)\s+(?:trabaja(?:n)?\s+aqu[ií]|works?\s+here)[.!]?$`;

export function normalizeCompanyName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(new RegExp(COMPANY_LEADING_SEPARATORS, 'u'), '').trim();
  if (!name || name.length > COMPANY_NAME_MAX || new RegExp(LINKEDIN_CONTACT_INDICATOR, 'iu').test(name)) return null;
  return name;
}
