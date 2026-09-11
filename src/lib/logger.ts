import { headers } from 'next/headers';

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
    return headers().get('x-request-id') || undefined;
  } catch {
    return undefined;
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
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
  const payload = {
    ts: new Date().toISOString(),
    level,
    requestId: rest.requestId || readRequestId(),
    ...rest,
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  };
  const line = JSON.stringify(payload, replacer);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
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
