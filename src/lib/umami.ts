import { publicErrorCode } from '@/lib/user-errors';

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

export function isUmamiDoNotTrack(value: unknown) {
  return value === 1 || value === '1' || value === 'yes';
}

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

export function umamiTitleForPath(pathname: string) {
  if (pathname === '/') return 'Matchply | Inicio';
  if (pathname.startsWith('/editor/')) return 'Matchply | Editor';
  if (pathname.startsWith('/dashboard/applications')) return 'Matchply | Postulaciones';
  if (pathname.startsWith('/dashboard/profile')) return 'Matchply | Perfil';
  if (pathname.startsWith('/dashboard/subscription')) return 'Matchply | Suscripción';
  if (pathname.startsWith('/dashboard')) return 'Matchply | Panel';
  if (pathname === '/try') return 'Matchply | Prueba';
  if (pathname === '/register') return 'Matchply | Registro';
  if (pathname === '/login') return 'Matchply | Acceso';
  return 'Matchply';
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
    // Document titles may contain private CV, company or contact names.
    title: umamiTitleForPath(input.pathname),
    referrer: sanitizeUmamiReferrer(input.referrer),
  };
}

export const UMAMI_CONVERSION_EVENTS = [
  'landing_viewed',
  'trial_started',
  'signup_completed',
  'cv_imported',
  'cv_import_failed',
  'cv_optimization_started',
  'cv_optimized',
  'cv_optimization_failed',
  'cv_downloaded',
  'offer_pasted',
  'offer_imported',
  'offer_import_failed',
  'diff_viewed',
  'blog_cta_clicked',
] as const;

export type UmamiConversionEvent = typeof UMAMI_CONVERSION_EVENTS[number];

export type FunnelData = { method?: 'pdf' | 'text' | 'url' | 'paste'; domain?: string; error_code?: string; mode?: string };

/** A hostname only: never credentials, paths, queries, local destinations or resource IDs. */
export function offerAnalyticsDomain(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['http:', 'https:'].includes(url.protocol) || !/^(?:[a-z0-9-]+\.)+[a-z]{2,24}$/.test(host)
      || host.length > 253 || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)
      || /[a-f0-9]{8}-[a-f0-9-]{27,}/.test(host)) return undefined;
    return host;
  } catch { return undefined; }
}

/** Event properties are an allowlist, not a general analytics metadata channel. */
export function funnelData(event: UmamiConversionEvent, input: FunnelData = {}): FunnelData {
  const data: FunnelData = {};
  if (event.startsWith('offer_')) {
    if (input.method === 'url' || input.method === 'paste') data.method = input.method;
    const domain = offerAnalyticsDomain(input.domain);
    if (domain) data.domain = domain;
  }
  if (event === 'cv_imported' || event === 'cv_import_failed') {
    if (input.method === 'pdf' || input.method === 'text') data.method = input.method;
  }
  if (event.startsWith('cv_optimiz') && ['optimize_adapted', 'optimize_honest', 'optimize_aggressive'].includes(input.mode || '')) data.mode = input.mode;
  if (event.endsWith('_failed')) data.error_code = publicErrorCode(input.error_code) || 'UNEXPECTED_ERROR';
  return data;
}
