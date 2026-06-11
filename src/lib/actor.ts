import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { createHash, randomBytes, randomUUID } from 'crypto';

export const GUEST_COOKIE_NAME = 'matchply_guest';
export const GUEST_TTL_DAYS = 7;
export const GUEST_MAX_CVS = 3;

const GUEST_COOKIE_MAX_AGE = GUEST_TTL_DAYS * 24 * 60 * 60;

export type RequestActor = {
  kind: 'user' | 'guest';
  userId: string;
  name: string | null;
  email: string | null;
  role: string | null;
  subscriptionStatus: string;
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

async function getGuestActorFromCookie(): Promise<RequestActor | null> {
  const token = getGuestTokenFromCookie();
  if (!token) return null;

  const [guest] = await db
    .select()
    .from(users)
    .where(and(eq(users.guestTokenHash, hashGuestToken(token)), eq(users.isGuest, true)))
    .limit(1);

  if (!guest || !guest.guestExpiresAt || guest.guestExpiresAt.getTime() < Date.now()) {
    return null;
  }

  return {
    kind: 'guest',
    userId: guest.id,
    name: guest.name,
    email: guest.email,
    role: guest.role,
    subscriptionStatus: guest.subscriptionStatus,
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
  const session = await auth();
  if (session?.user?.id) {
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (dbUser && !dbUser.isGuest) {
      return {
        kind: 'user',
        userId: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        subscriptionStatus: dbUser.subscriptionStatus,
      };
    }
  }

  if (!options.allowGuest) return null;
  return getGuestActorFromCookie();
}

export async function getOrCreateGuestActor(): Promise<RequestActor> {
  const existingActor = await getActor({ allowGuest: true });
  if (existingActor) return existingActor;

  await deleteExpiredGuestFromCookie();

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + GUEST_COOKIE_MAX_AGE * 1000);

  const [guest] = await db
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
    .returning();

  setGuestCookie(token);

  return {
    kind: 'guest',
    userId: guest.id,
    name: guest.name,
    email: guest.email,
    role: guest.role,
    subscriptionStatus: guest.subscriptionStatus,
  };
}

export async function getGuestCvCount(userId: string) {
  const rows = await db
    .select({ id: cvs.id })
    .from(cvs)
    .where(eq(cvs.userId, userId));

  return rows.length;
}

export async function claimGuestDataForUser(userId: string) {
  const token = getGuestTokenFromCookie();
  if (!token) return { claimed: false, cvCount: 0 };

  const [guest] = await db
    .select()
    .from(users)
    .where(and(eq(users.guestTokenHash, hashGuestToken(token)), eq(users.isGuest, true)))
    .limit(1);

  if (!guest || !guest.guestExpiresAt) {
    clearGuestCookie();
    return { claimed: false, cvCount: 0 };
  }

  if (guest.guestExpiresAt.getTime() < Date.now()) {
    await db.delete(users).where(eq(users.id, guest.id));
    clearGuestCookie();
    return { claimed: false, cvCount: 0 };
  }

  if (guest.id === userId) {
    clearGuestCookie();
    return { claimed: false, cvCount: 0 };
  }

  const guestCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, guest.id))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt));

  const [currentPrincipal] = await db
    .select({ id: cvs.id })
    .from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.isPrincipal, true)))
    .limit(1);

  await db.transaction(async (tx) => {
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

    await tx
      .update(jobOffers)
      .set({ userId })
      .where(eq(jobOffers.userId, guest.id));

    await tx.delete(users).where(eq(users.id, guest.id));
  });

  clearGuestCookie();
  return { claimed: true, cvCount: guestCvs.length };
}
