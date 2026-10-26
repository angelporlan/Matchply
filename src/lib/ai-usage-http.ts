import { userError, publicUsageDetails } from '@/lib/user-errors';
import { UsageError } from '@/lib/usage';
import { RateLimitError } from '@/lib/rate-limit';
import { SubscriptionAccessError } from '@/lib/permissions';
import * as RequestErrors from '@/lib/request-errors';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

const REQUEST_ID = /^[a-zA-Z0-9_-]{8,128}$/;

export class AiUsageHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

/** Keep the same ID when retrying a lost response; a deliberate regeneration gets a new ID. */
export function aiRequestId(request: Request | null, value?: unknown): string {
  const supplied = value ?? request?.headers.get('Idempotency-Key');
  if (supplied == null || supplied === '') return randomUUID();
  if (typeof supplied !== 'string' || !REQUEST_ID.test(supplied)) {
    throw new AiUsageHttpError(400, 'INVALID_REQUEST_ID', 'El identificador de la solicitud no es válido.');
  }
  return supplied;
}

/** Quota and plan errors are returned before opening an AI stream. */
export function aiUsageErrorResponse(error: unknown): NextResponse | null {
  const known = error instanceof AiUsageHttpError || error instanceof UsageError || error instanceof RateLimitError || error instanceof SubscriptionAccessError || Object.values(RequestErrors).some(Type => error instanceof Type);
  if (!known || !(error instanceof Error) || !('status' in error) || typeof error.status !== 'number') return null;
  if (error.status < 400 || error.status >= 500) return null;
  const detail = error as Error & { status: number; code?: string; details?: Record<string, unknown>; bucket?: string; used?: number; reserved?: number; limit?: number; resetsAt?: unknown; resetAt?: unknown };
  return NextResponse.json({
    ...publicUsageDetails(detail.details || {}), ...userError(detail.code || (detail.status === 429 ? 'RATE_LIMITED' : 'INVALID_INPUT')),
    ...publicUsageDetails({ bucket: detail.bucket, used: detail.used, reserved: detail.reserved,
      limit: detail.limit, resetsAt: detail.resetsAt || detail.resetAt }),
  }, { status: detail.status, headers: { 'Cache-Control': 'no-store' } });
}
