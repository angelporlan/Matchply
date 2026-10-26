import { UsageError } from '@/lib/usage';
import { AiUsageHttpError } from '@/lib/ai-usage-http';
import { RateLimitError } from '@/lib/rate-limit';
import { SubscriptionAccessError } from '@/lib/permissions';
import * as RequestErrors from '@/lib/request-errors';
import { userError } from '@/lib/user-errors';
import { AiProviderError } from '@/lib/ai-provider-errors';
import { headers } from 'next/headers';
import { validRequestId } from '@/lib/request-id';

/** Server boundaries use trusted product errors only; arbitrary SDK status/details are private. */
export function publicErrorBody(error: unknown, fallback = 'UNEXPECTED_ERROR') {
  let requestId: string | undefined;
  try { requestId = validRequestId(headers().get('x-request-id')); } catch { /* outside HTTP */ }
  return { ...classify(error, fallback), ...(requestId ? { requestId } : {}) };
}

function classify(error: unknown, fallback: string) {
  if (error instanceof UsageError) return error.toJSON();
  if (error instanceof AiProviderError) return userError('AI_UNAVAILABLE');
  if (error instanceof RateLimitError) return userError('RATE_LIMITED');
  if (error instanceof SubscriptionAccessError) return userError('PLAN_REQUIRED');
  if (error instanceof AiUsageHttpError || Object.values(RequestErrors).some(Type => error instanceof Type)) {
    return userError(error, 'es', fallback);
  }
  // Legacy application errors have fixed, catalogued message codes. Never return their text.
  return userError(error instanceof Error ? error.message : typeof error === 'string' ? error : null, 'es', fallback);
}
