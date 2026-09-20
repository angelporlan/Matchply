import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { headers } from 'next/headers';
import { log } from '@/lib/logger';

export type AuditCategory = 'ordinary' | 'admin';

export type AuditLogInput = {
  action: string;
  userId?: string | null;
  userEmail?: string | null;
  details?: Record<string, unknown>;
  actorUserId?: string | null;
  affectedUserId?: string | null;
  supportSessionId?: string | null;
  requestId?: string | null;
  category?: AuditCategory;
};

function readHttpContext() {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  let requestId: string | null = null;
  try {
    const headerList = headers();
    userAgent = headerList.get('user-agent');
    requestId = headerList.get('x-request-id');
    const forwardedFor = headerList.get('x-forwarded-for');
    if (forwardedFor) {
      ipAddress = forwardedFor.split(',')[0].trim();
    } else {
      ipAddress = headerList.get('x-real-ip');
    }
  } catch {
    // outside an HTTP request
  }
  return { ipAddress, userAgent, requestId };
}

function sanitizeDetails(details: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    const lower = key.toLowerCase();
    if (lower.includes('password') || lower.includes('token') || lower.includes('secret') || lower.includes('hash')) {
      continue;
    }
    if (typeof value === 'string' && value.length > 500) {
      next[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function auditRowValues(input: AuditLogInput) {
  const http = readHttpContext();
  return {
    userId: input.userId ?? null,
    userEmail: input.userEmail ?? null,
    action: input.action,
    details: JSON.stringify(sanitizeDetails(input.details || {})),
    ipAddress: http.ipAddress,
    userAgent: http.userAgent,
    actorUserId: input.actorUserId ?? input.userId ?? null,
    affectedUserId: input.affectedUserId ?? input.userId ?? null,
    supportSessionId: input.supportSessionId ?? null,
    requestId: input.requestId ?? http.requestId,
    category: input.category ?? 'ordinary',
    createdAt: new Date(),
  };
}

/**
 * Non-blocking audit for ordinary activity. Failures never reject the caller.
 */
export async function createAuditLog(
  action: string,
  userId: string | null,
  userEmail: string | null,
  details: Record<string, any> = {},
  extra: Omit<AuditLogInput, 'action' | 'userId' | 'userEmail' | 'details'> = {},
) {
  try {
    const values = auditRowValues({
      action,
      userId,
      userEmail,
      details,
      ...extra,
    });
    void db.insert(auditLogs).values(values).catch((error) => {
      log({ event: 'audit_log_failed', level: 'error', action, userId: userId || undefined, error });
    });
  } catch (error) {
    log({ event: 'audit_log_failed', level: 'error', action, userId: userId || undefined, error });
  }
}

/** Same-transaction insert for critical admin changes. */
export async function insertCriticalAuditLog(
  tx: { insert: typeof db.insert },
  input: AuditLogInput,
) {
  await tx.insert(auditLogs).values({
    ...auditRowValues({ ...input, category: input.category ?? 'admin' }),
  });
}
