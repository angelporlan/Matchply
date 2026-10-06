import { db } from '@/db';
import { auditLogs, cvs, cvOptimizations, aiJobs, jobOffers, users } from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { sessionUserWithGuestColumns } from '@/lib/job-offer-queries';
import { requestCache } from '@/lib/request-cache';
import { GUEST_MAX_CVS } from '@/lib/subscription';
import { assertMutableActor, getRequestContext } from '@/lib/request-context';
import { AccountSuspendedError } from '@/lib/request-errors';
import { transferGuestCrm } from '@/lib/guest-crm-claim';
import { transferGuestUsage } from '@/lib/usage';

export { GUEST_MAX_CVS } from '@/lib/subscription';

export const GUEST_COOKIE_NAME = 'matchply_guest';
export const GUEST_TTL_DAYS = 7;

const GUEST_COOKIE_MAX_AGE = GUEST_TTL_DAYS * 24 * 60 * 60;

export type RequestActor = {
  kind: 'user' | 'guest';
  userId: string;
  name: string | null;
  email: string | null;
  role: string | null;
  subscriptionStatus: string;
  accountStatus: string;
  proGrantedUntil: Date | null;
  stripePriceId?: string | null;
  stripePaidAt?: Date | null;
  stripeCurrentPeriodEnd?: Date | null;
  stripeTrialEnd?: Date | null;
  realUserId: string;
  impersonationSessionId: string | null;
};

function hashGuestToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getGuestTokenFromCookie() {
  return cookies().get(GUEST_COOKIE_NAME)?.value || null;
}

function setGuestCookie(token: string) {
  cookies().set(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  });
}

export function clearGuestCookie() {
  cookies().delete(GUEST_COOKIE_NAME);
}

/** Guest row for the dashboard shell. Null when the cookie is missing or expired. */
export const loadGuestSessionUser = requestCache(async () => {
  const token = getGuestTokenFromCookie();
  if (!token) return null;

  const [guest] = await db
    .select({
      ...sessionUserWithGuestColumns,
      guestExpiresAt: users.guestExpiresAt,
    })
    .from(users)
    .where(and(eq(users.guestTokenHash, hashGuestToken(token)), eq(users.isGuest, true)))
    .limit(1);

  if (!guest || !guest.guestExpiresAt || guest.guestExpiresAt.getTime() < Date.now()) {
    return null;
  }

  return {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    image: guest.image,
    role: guest.role,
    subscriptionStatus: guest.subscriptionStatus,
    isGuest: guest.isGuest,
    accountStatus: guest.accountStatus,
    proGrantedUntil: guest.proGrantedUntil,
  };
});

async function getGuestActorFromCookie(): Promise<RequestActor | null> {
  const guest = await loadGuestSessionUser();
  if (!guest) return null;

  return {
    kind: 'guest',
    ...guestActorFields(guest),
  };
}

async function deleteExpiredGuestFromCookie() {
  const token = getGuestTokenFromCookie();
  if (!token) return;

  const [guest] = await db
    .select({ id: users.id, guestExpiresAt: users.guestExpiresAt })
    .from(users)
    .where(and(eq(users.guestTokenHash, hashGuestToken(token)), eq(users.isGuest, true)))
    .limit(1);

  if (guest?.guestExpiresAt && guest.guestExpiresAt.getTime() < Date.now()) {
    await db.delete(users).where(eq(users.id, guest.id));
    clearGuestCookie();
  }
}

export async function getActor(options: { allowGuest?: boolean } = {}): Promise<RequestActor | null> {
  const ctx = await getRequestContext();
  assertMutableActor(ctx);

  if (ctx.effectiveUser && !ctx.effectiveUser.isGuest) {
    if (ctx.effectiveUser.accountStatus === 'suspended' && !ctx.impersonation) {
      throw new AccountSuspendedError();
    }
    return {
      kind: 'user',
      userId: ctx.effectiveUser.id,
      name: ctx.effectiveUser.name,
      email: ctx.effectiveUser.email,
      role: ctx.effectiveUser.role,
      subscriptionStatus: ctx.effectiveUser.subscriptionStatus,
      accountStatus: ctx.effectiveUser.accountStatus,
      proGrantedUntil: ctx.effectiveUser.proGrantedUntil,
      stripePriceId: ctx.effectiveUser.stripePriceId,
      stripePaidAt: ctx.effectiveUser.stripePaidAt,
      stripeCurrentPeriodEnd: ctx.effectiveUser.stripeCurrentPeriodEnd,
      stripeTrialEnd: ctx.effectiveUser.stripeTrialEnd,
      realUserId: ctx.realUser?.id || ctx.effectiveUser.id,
      impersonationSessionId: ctx.impersonation?.id ?? null,
    };
  }

  if (!options.allowGuest) return null;
  return getGuestActorFromCookie();
}

function guestActorFields(guest: { id: string; name: string | null; email: string | null; role: string | null; subscriptionStatus: string }): Omit<RequestActor, 'kind'> {
  return {
    userId: guest.id,
    name: guest.name,
    email: guest.email,
    role: guest.role,
    subscriptionStatus: guest.subscriptionStatus,
    accountStatus: 'active',
    proGrantedUntil: null,
    realUserId: guest.id,
    impersonationSessionId: null,
  };
}

export async function getOrCreateGuestActor(): Promise<RequestActor> {
  const existingActor = await getActor({ allowGuest: true });
  if (existingActor) return existingActor;

  await deleteExpiredGuestFromCookie();

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + GUEST_COOKIE_MAX_AGE * 1000);

  const [guest] = (await db
    .insert(users)
    .values({
      name: 'Invitado',
      email: `guest-${randomUUID()}@guest.matchply.local`,
      role: 'user',
      subscriptionStatus: 'none',
      isGuest: true,
      guestTokenHash: hashGuestToken(token),
      guestExpiresAt: expiresAt,
    })
    .returning()) as any[];

  setGuestCookie(token);

  return {
    kind: 'guest',
    ...guestActorFields(guest),
  };
}

export async function getGuestCvCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(cvs)
    .where(eq(cvs.userId, userId));

  return Number(row?.count) || 0;
}

const emptyClaim = { claimed: false, cvCount: 0, cvId: null, offerId: null };

export async function claimGuestDataForUser(userId: string) {
  const token = getGuestTokenFromCookie();
  if (!token) return emptyClaim;

  const [guest] = await db
    .select({ id: users.id, guestExpiresAt: users.guestExpiresAt })
    .from(users)
    .where(and(eq(users.guestTokenHash, hashGuestToken(token)), eq(users.isGuest, true)))
    .limit(1);

  if (!guest || !guest.guestExpiresAt) {
    clearGuestCookie();
    return emptyClaim;
  }

  if (guest.guestExpiresAt.getTime() < Date.now()) {
    await db.delete(users).where(eq(users.id, guest.id));
    clearGuestCookie();
    return emptyClaim;
  }

  if (guest.id === userId) {
    clearGuestCookie();
    return emptyClaim;
  }

  const guestCvs = await db
    .select({ id: cvs.id, isPrincipal: cvs.isPrincipal })
    .from(cvs)
    .where(eq(cvs.userId, guest.id))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt));

  const [latestOffer] = await db
    .select({ id: jobOffers.id, cvId: jobOffers.cvId })
    .from(jobOffers)
    .where(eq(jobOffers.userId, guest.id))
    .orderBy(desc(jobOffers.updatedAt), desc(jobOffers.createdAt))
    .limit(1);

  const [latestCv] = await db
    .select({ id: cvs.id })
    .from(cvs)
    .where(eq(cvs.userId, guest.id))
    .orderBy(desc(cvs.updatedAt))
    .limit(1);

  const cvId = latestOffer?.cvId || latestCv?.id || null;
  const offerId = latestOffer?.id || null;

  const [currentPrincipal] = await db
    .select({ id: cvs.id })
    .from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.isPrincipal, true)))
    .limit(1);

  await db.transaction(async (tx) => {
    await transferGuestUsage(tx, guest.id, userId);
    if (currentPrincipal) {
      await tx
        .update(cvs)
        .set({ userId, isPrincipal: false })
        .where(eq(cvs.userId, guest.id));
    } else {
      await tx
        .update(cvs)
        .set({ userId })
        .where(eq(cvs.userId, guest.id));

      if (guestCvs.length > 0 && !guestCvs.some((cv) => cv.isPrincipal)) {
        await tx
          .update(cvs)
          .set({ isPrincipal: true })
          .where(eq(cvs.id, guestCvs[0].id));
      }
    }

    await transferGuestCrm(tx, guest.id, userId);
    await tx.update(cvOptimizations).set({ userId }).where(eq(cvOptimizations.userId, guest.id));
    await tx.update(aiJobs).set({ userId }).where(eq(aiJobs.userId, guest.id));

    // Guest deletion nulls audit userId. Keep optimize/download on the new account.
    await tx.update(auditLogs).set({ userId }).where(eq(auditLogs.userId, guest.id));
    await tx.update(auditLogs).set({ actorUserId: userId }).where(eq(auditLogs.actorUserId, guest.id));
    await tx.update(auditLogs).set({ affectedUserId: userId }).where(eq(auditLogs.affectedUserId, guest.id));

    await tx.delete(users).where(eq(users.id, guest.id));
  });

  clearGuestCookie();
  return { claimed: true, cvCount: guestCvs.length, cvId, offerId };
}
