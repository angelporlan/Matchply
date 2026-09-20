'use server';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { supportSessions, users } from '@/db/schema';
import { insertCriticalAuditLog } from '@/lib/audit';
import { randomToken, sha256Hex } from '@/lib/crypto-hash';
import { isImpersonationEnabled } from '@/lib/flags';
import {
  SUPPORT_COOKIE_NAME,
  SUPPORT_SESSION_TTL_MS,
  impersonationDenial,
  impersonationDenialMessage,
} from '@/lib/impersonation';
import { requireAdminContext, auditActorFields, getRequestContext } from '@/lib/request-context';
import { SupportActionBlockedError } from '@/lib/request-errors';

function setSupportCookie(token: string) {
  cookies().set(SUPPORT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SUPPORT_SESSION_TTL_MS / 1000),
  });
}

function clearSupportCookie() {
  cookies().delete(SUPPORT_COOKIE_NAME);
}

export async function startImpersonationAction(targetUserId: string, reason: string) {
  const { admin, ...ctx } = await requireAdminContext();
  if (ctx.impersonation) {
    return { success: false, error: impersonationDenialMessage('nested') };
  }

  const [target] = await db
    .select({
      id: users.id,
      role: users.role,
      isGuest: users.isGuest,
      accountStatus: users.accountStatus,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  const denial = impersonationDenial(admin, target, {
    enabled: isImpersonationEnabled(),
    alreadyImpersonating: Boolean(ctx.impersonation),
    reason,
  });
  if (denial) {
    return { success: false, error: impersonationDenialMessage(denial) };
  }

  const token = randomToken(32);
  const now = new Date();
  const [session] = await db.insert(supportSessions).values({
    actorUserId: admin.id,
    targetUserId,
    tokenHash: sha256Hex(token),
    reason: reason.trim(),
    createdAt: now,
    expiresAt: new Date(now.getTime() + SUPPORT_SESSION_TTL_MS),
  }).returning();

  await insertCriticalAuditLog(db as any, {
    action: 'admin_impersonation_start',
    userId: admin.id,
    userEmail: admin.email,
    details: { targetUserId, reason: reason.trim(), sessionId: session.id },
    ...auditActorFields(ctx),
    affectedUserId: targetUserId,
    supportSessionId: session.id,
    category: 'admin',
  });

  setSupportCookie(token);
  redirect('/dashboard');
}

export async function stopImpersonationAction() {
  const ctx = await getRequestContext();
  if (!ctx.realUser) throw new SupportActionBlockedError();
  const token = cookies().get(SUPPORT_COOKIE_NAME)?.value;
  if (token) {
    const [session] = await db.select().from(supportSessions).where(eq(supportSessions.tokenHash, sha256Hex(token))).limit(1);
    if (session && session.actorUserId === ctx.realUser.id) {
      await db.update(supportSessions).set({ endedAt: new Date() }).where(eq(supportSessions.id, session.id));
      await insertCriticalAuditLog(db as any, {
        action: 'admin_impersonation_end',
        userId: ctx.realUser.id,
        userEmail: ctx.realUser.email,
        details: { targetUserId: session.targetUserId, sessionId: session.id, how: 'manual' },
        actorUserId: ctx.realUser.id,
        affectedUserId: session.targetUserId,
        supportSessionId: session.id,
        category: 'admin',
      });
    }
  }
  clearSupportCookie();
  redirect('/admin/users');
}

export async function revokeImpersonationAction(sessionId: string) {
  const { admin, ...ctx } = await requireAdminContext();
  const [session] = await db.select().from(supportSessions).where(eq(supportSessions.id, sessionId)).limit(1);
  if (!session) return { success: false, error: 'Sesión no encontrada.' };
  await db.update(supportSessions).set({ revokedAt: new Date(), endedAt: new Date() }).where(eq(supportSessions.id, sessionId));
  await insertCriticalAuditLog(db as any, {
    action: 'admin_impersonation_revoke',
    userId: admin.id,
    userEmail: admin.email,
    details: { sessionId, targetUserId: session.targetUserId },
    ...auditActorFields(ctx),
    affectedUserId: session.targetUserId,
    supportSessionId: sessionId,
    category: 'admin',
  });
  return { success: true };
}
