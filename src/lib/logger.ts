import { headers } from 'next/headers';
import { getAiUsageContext } from './ai-usage-context';
import { randomUUID } from 'node:crypto';
import { validRequestId } from '@/lib/request-id';
import { diagnosticRoute, errorEventValues, type ErrorEventInput } from '@/lib/diagnostics-schema';
import { userError } from '@/lib/user-errors';
import { createErrorRecorder } from '@/lib/error-event-buffer';

const recorderState = globalThis as typeof globalThis & { matchplyErrorRecorder?: ReturnType<typeof createErrorRecorder> };
export const errorRecorder = recorderState.matchplyErrorRecorder ??= createErrorRecorder(
  async (event: ErrorEventInput) => { const { recordErrorEvent } = await import('@/lib/error-events'); await recordErrorEvent(event); },
  () => process.env.NEXT_PHASE !== 'phase-production-build' && process.env.ERROR_EVENTS_ENABLED !== 'false'
    && (process.env.NODE_ENV === 'production' || process.env.ERROR_EVENTS_ENABLED === 'true'),
);

export type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = {
  event: string;
  level?: LogLevel;
  requestId?: string;
  userId?: string;
  route?: string;
  durationMs?: number;
  error?: unknown;
  [key: string]: unknown;
};

function readRequestId() {
  try {
    return validRequestId(headers().get('x-request-id'));
  } catch {
    return undefined;
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack?.slice(0, 8000) };
  }
  if (typeof error === 'string') return { message: error };
  return { message: 'unknown' };
}

function replacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function log(fields: LogFields) {
  const { error, level = 'info', ...rest } = fields;
  const traceId = readRequestId();
  const failed = level === 'error' || (level === 'warn' && error !== undefined);
  let route = diagnosticRoute(rest.route);
  try { if (route === '/unknown') route = diagnosticRoute(headers().get('x-matchply-route')); } catch { /* worker */ }
  const payload = {
    ts: new Date().toISOString(),
    level,
    ...rest,
    requestId: validRequestId(rest.requestId) || validRequestId(getAiUsageContext()?.requestId) || traceId || (failed ? randomUUID() : undefined),
    ...(traceId ? { traceId } : {}),
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };
  const line = JSON.stringify(payload, replacer);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
  if (failed) {
    const event = errorEventValues({ requestId: payload.requestId, traceId, event: fields.event,
      code: userError(fields.code || error).code, route,
      source: fields.errorSource === 'browser' ? 'browser' : fields.errorSource === 'worker' ? 'worker' : 'server',
      digest: typeof fields.digest === 'string' ? fields.digest : undefined });
    if (event) errorRecorder.record(event);
  }
}

export async function timed<T>(
  event: string,
  fields: Omit<LogFields, 'event' | 'durationMs'>,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    log({ event, ...fields, durationMs: Date.now() - started });
    return result;
  } catch (error) {
    log({ event, ...fields, level: 'error', durationMs: Date.now() - started, error });
    throw error;
  }
}
