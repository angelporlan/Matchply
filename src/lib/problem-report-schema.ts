import { diagnosticRoute, ERROR_STEPS, type ErrorStep } from '@/lib/diagnostics-schema';
import { validRequestId } from '@/lib/request-id';

export const REPORT_COMMENT_MAX = 2000;
export type ProblemReportInput = { id: string; requestId: string | null; step: ErrorStep; route: string; comment: string };
export function parseProblemReport(value: unknown): ProblemReportInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['id', 'requestId', 'step', 'route', 'comment'].includes(key))
    || typeof input.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.id)
    || (input.requestId !== null && input.requestId !== undefined && !validRequestId(input.requestId))
    || !ERROR_STEPS.includes(input.step as ErrorStep)
    || (input.comment !== undefined && (typeof input.comment !== 'string' || input.comment.length > REPORT_COMMENT_MAX))
    || typeof input.route !== 'string' || input.route.length > 2048) return null;
  return { id: input.id, requestId: validRequestId(input.requestId) || null, step: input.step as ErrorStep,
    route: diagnosticRoute(input.route), comment: typeof input.comment === 'string' ? input.comment.trim() : '' };
}
