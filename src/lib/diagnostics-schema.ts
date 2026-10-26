import { publicErrorCode } from '@/lib/user-errors';
import { validRequestId } from '@/lib/request-id';

export const ERROR_STEPS = ['page', 'cv-import', 'offer-import', 'optimization', 'pdf-download', 'registration', 'editor', 'unknown'] as const;
export type ErrorStep = typeof ERROR_STEPS[number];
export type ErrorEventInput = { requestId: string; traceId?: string; event: string; code: string; route: string; source: 'server' | 'browser' | 'worker'; digest?: string };

/** Only route templates are stored; unknown path segments and all queries are omitted. */
export function diagnosticRoute(value: unknown): string {
  if (typeof value !== 'string') return '/unknown';
  const path = value.split(/[?#]/, 1)[0];
  for (const [prefix, template] of [
    ['/editor/', '/editor/:cvId'], ['/dashboard/applications/offer/', '/dashboard/applications/offer/:id'],
    ['/api/ai/jobs/', '/api/ai/jobs/:id'], ['/api/ai/optimize/', '/api/ai/optimize/:id/:action'],
    ['/api/cv/exports/', '/api/cv/exports/:id'], ['/api/cv/', '/api/cv/:id/:action'],
    ['/api/research/', '/api/research/:id'], ['/blog/', '/blog/:locale/:slug'],
  ]) if (path.startsWith(prefix) && !['/api/cv/import', '/api/cv/parse-pdf', '/api/research/quota'].includes(path)) return template;
  const fixed = ['/', '/try', '/register', '/login', '/dashboard', '/dashboard/applications', '/dashboard/profile', '/dashboard/subscription', '/api/pdf', '/api/cv/import', '/api/cv/parse-pdf', '/api/ai/optimize', '/api/ai/curate', '/api/ai/offers/import', '/api/ai/offers/discover', '/api/ai/profile/extract', '/api/ai/profile/interview', '/api/research/quota', '/api/diagnostics/errors', '/api/diagnostics/reports'];
  return fixed.includes(path) ? path : path.startsWith('/admin') ? '/admin' : '/unknown';
}

export function errorEventValues(input: Partial<ErrorEventInput>): ErrorEventInput | null {
  const requestId = validRequestId(input.requestId);
  if (!requestId) return null;
  return {
    requestId, ...(validRequestId(input.traceId) ? { traceId: input.traceId } : {}),
    event: typeof input.event === 'string' && /^[a-z][a-z0-9_:.]{0,95}$/.test(input.event) ? input.event : 'product_error',
    code: publicErrorCode(input.code) || 'UNEXPECTED_ERROR', route: diagnosticRoute(input.route),
    source: input.source === 'browser' || input.source === 'worker' ? input.source : 'server',
    ...(typeof input.digest === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(input.digest) ? { digest: input.digest } : {}),
  };
}

export function parseClientError(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['requestId', 'code', 'step', 'digest', 'route'].includes(key))
    || !ERROR_STEPS.includes(input.step as ErrorStep) || !publicErrorCode(input.code)
    || (input.requestId !== undefined && !validRequestId(input.requestId))
    || (input.digest !== undefined && (typeof input.digest !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.digest)))) return null;
  return { requestId: input.requestId as string | undefined, code: publicErrorCode(input.code)!, step: input.step as ErrorStep, digest: input.digest as string | undefined, route: diagnosticRoute(input.route) };
}
