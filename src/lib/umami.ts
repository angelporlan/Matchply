const SENSITIVE_QUERY = new Set([
  'email',
  'token',
  'session',
  'code',
  'password',
  'secret',
  'key',
  'cv',
  'content',
]);

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export function shouldTrackUmamiPath(pathname: string) {
  if (!pathname) return false;
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/account/suspended')) return false;
  return true;
}

export function normalizeUmamiPath(pathname: string) {
  const withoutIds = pathname.replace(UUID_RE, ':id');
  return withoutIds.replace(/\/editor\/[^/]+/i, '/editor/:cvId');
}

export function normalizeUmamiTitle(title: string) {
  return title.replace(UUID_RE, '').replace(/\s{2,}/g, ' ').trim().slice(0, 120);
}

export function sanitizeUmamiReferrer(referrer: string | null | undefined) {
  if (!referrer) return '';
  try {
    const url = new URL(referrer);
    return url.origin;
  } catch {
    return '';
  }
}

export function stripSensitiveSearch(search: string) {
  if (!search) return '';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of Array.from(params.keys())) {
    if (SENSITIVE_QUERY.has(key.toLowerCase())) params.delete(key);
  }
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function umamiPagePayload(input: {
  pathname: string;
  title?: string;
  search?: string;
  referrer?: string | null;
}) {
  const path = normalizeUmamiPath(input.pathname) + stripSensitiveSearch(input.search || '');
  return {
    url: path,
    title: normalizeUmamiTitle(input.title || ''),
    referrer: sanitizeUmamiReferrer(input.referrer),
  };
}

export const UMAMI_CONVERSION_EVENTS = [
  'trial_started',
  'signup_completed',
  'cv_imported',
  'cv_optimized',
  'cv_downloaded',
] as const;

export type UmamiConversionEvent = typeof UMAMI_CONVERSION_EVENTS[number];
