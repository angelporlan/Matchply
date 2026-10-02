import { and, eq, isNull, gt } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { db } from '@/db';
import { supportSessions, users } from '@/db/schema';
import { sha256Hex } from '@/lib/crypto-hash';
import { isImpersonationEnabled } from '@/lib/flags';
import {
  ACTOR_EPOCH_HEADER,
  SUPPORT_COOKIE_NAME,
  actorEpochFor,
  isSupportSessionActive,
} from '@/lib/impersonation';
import { requestCache } from '@/lib/request-cache';
import {
  AdminAuthorizationError,
  ActorEpochMismatchError,
  AccountSuspendedError,
  ImpersonationEndedError,
  SupportActionBlockedError,
} from '@/lib/request-errors';
import { getSession } from '@/lib/auth-session';
import { sessionUserWithGuestColumns } from '@/lib/job-offer-queries';
import type { SessionUser } from '@/lib/session';
import { touchLastSeenAt } from '@/lib/user-activity';
import type { SubscriptionFeature } from '@/lib/subscription';
import { canAccessFeature } from '@/lib/subscription';
import { SubscriptionAccessError } from '@/lib/permissions';

export type SupportSessionView = {
  id: string;
  actorUserId: string;
  targetUserId: string;
  reason: string;
  expiresAt: Date;
};

export type RequestContext = {
  realUser: SessionUser | null;
  effectiveUser: SessionUser | null;
  impersonation: SupportSessionView | null;
  impersonationInvalid: boolean;
  actorEpoch: string;
};

function mapUser(row: {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  subscriptionStatus: string;
  isGuest: boolean;
  accountStatus: string;
  proGrantedUntil: Date | null;
}): SessionUser {
  return row;
}

async function loadUser(id: string): Promise<SessionUser | null> {
  const [row] = await db.select(sessionUserWithGuestColumns).from(users).where(eq(users.id, id)).limit(1);
  return row ? mapUser(row) : null;
}

function readSupportToken() {
  try {
    return cookies().get(SUPPORT_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

function readSubmittedEpoch() {
  try {
    return headers().get(ACTOR_EPOCH_HEADER);
  } catch {
    return null;
  }
}

function clearSupportCookie() {
  try {
    cookies().delete(SUPPORT_COOKIE_NAME);
  } catch {
    // RSC/read-only cookie store
  }
}

export const getRequestContext = requestCache(async (): Promise<RequestContext> => {
  const session = await getSession();
  const realUserId = session?.user?.id || null;
  const realUser = realUserId ? await loadUser(realUserId) : null;

  let impersonation: SupportSessionView | null = null;
  let impersonationInvalid = false;
  let effectiveUser = realUser;

  const token = readSupportToken();
  if (token) {
    if (!realUser || realUser.role !== 'admin' || !isImpersonationEnabled()) {
      impersonationInvalid = true;
      clearSupportCookie();
    } else {
      const [row] = await db
        .select()
        .from(supportSessions)
        .where(eq(supportSessions.tokenHash, sha256Hex(token)))
        .limit(1);

      if (!row || row.actorUserId !== realUser.id || !isSupportSessionActive(row)) {
        impersonationInvalid = true;
        clearSupportCookie();
      } else {
        const target = await loadUser(row.targetUserId);
        const actorStillAdmin = realUser.role === 'admin' && realUser.accountStatus === 'active';
        if (
          !target
          || target.role === 'admin'
          || target.isGuest
          || target.accountStatus === 'suspended'
          || !actorStillAdmin
        ) {
          impersonationInvalid = true;
          clearSupportCookie();
        } else {
          impersonation = {
            id: row.id,
            actorUserId: row.actorUserId,
            targetUserId: row.targetUserId,
            reason: row.reason,
            expiresAt: row.expiresAt,
          };
          effectiveUser = target;
        }
      }
    }
  }

  if (realUser && !impersonation) {
    void touchLastSeenAt(realUser.id);
  }

  return {
    realUser,
    effectiveUser,
    impersonation,
    impersonationInvalid,
    actorEpoch: actorEpochFor(impersonation?.id),
  };
});

export function assertActorEpoch(ctx: RequestContext) {
  const submitted = readSubmittedEpoch();
  if (!submitted) return;
  if (submitted !== ctx.actorEpoch) {
    throw new ActorEpochMismatchError();
  }
}

/** Mutations send an epoch header. Page reads after a lapsed cookie keep the real admin. */
export function assertMutableActor(ctx: RequestContext) {
  if (ctx.impersonationInvalid && readSubmittedEpoch()) {
    throw new ImpersonationEndedError();
  }
  assertActorEpoch(ctx);
}

export async function requireProductContext(options: {
  allowGuest?: boolean;
  feature?: SubscriptionFeature;
} = {}) {
  const ctx = await getRequestContext();
  if (ctx.impersonationInvalid) {
    throw new ImpersonationEndedError();
  }
  assertActorEpoch(ctx);

  if (ctx.effectiveUser) {
    if (ctx.effectiveUser.accountStatus === 'suspended' && !ctx.impersonation) {
      throw new AccountSuspendedError();
    }
    if (options.feature && !canAccessFeature(ctx.effectiveUser.subscriptionStatus, options.feature, {
      isGuest: ctx.effectiveUser.isGuest,
      proGrantedUntil: ctx.effectiveUser.proGrantedUntil,
    })) {
      throw new SubscriptionAccessError(options.feature);
    }
    return ctx;
  }

  if (!options.allowGuest) {
    throw new Error('Unauthorized');
  }
  return ctx;
}

export async function requireAdminContext() {
  const ctx = await getRequestContext();
  if (ctx.impersonationInvalid) {
    throw new ImpersonationEndedError();
  }
  if (ctx.impersonation) {
    throw new SupportActionBlockedError('Sal de la sesión de soporte para usar administración.');
  }
  assertActorEpoch(ctx);
  const admin = ctx.realUser;
  if (!admin || admin.role !== 'admin' || admin.accountStatus !== 'active' || admin.isGuest) {
    throw new AdminAuthorizationError();
  }
  return { ...ctx, admin };
}

export async function requireAccountContext() {
  const ctx = await requireProductContext();
  if (ctx.impersonation) {
    throw new SupportActionBlockedError();
  }
  const realUser = ctx.realUser;
  if (!realUser) throw new Error('Unauthorized');
  return { ...ctx, realUser };
}

export async function requireBillingContext() {
  const ctx = await getRequestContext();
  if (ctx.impersonationInvalid) throw new ImpersonationEndedError();
  if (ctx.impersonation) {
    throw new SupportActionBlockedError('No puedes gestionar la facturación durante una sesión de soporte.');
  }
  const realUser = ctx.realUser;
  if (!realUser) throw new Error('Unauthorized');
  assertActorEpoch(ctx);
  return { ...ctx, realUser };
}

export function auditActorFields(ctx: RequestContext) {
  return {
    actorUserId: ctx.realUser?.id ?? ctx.effectiveUser?.id ?? null,
    affectedUserId: ctx.effectiveUser?.id ?? null,
    supportSessionId: ctx.impersonation?.id ?? null,
  };
}
