import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sessionUserWithGuestColumns } from '@/lib/job-offer-queries';
import { requestCache } from '@/lib/request-cache';
import { getRequestContext } from '@/lib/request-context';

export { getSession } from '@/lib/auth-session';

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  subscriptionStatus: string;
  isGuest: boolean;
  accountStatus: string;
  proGrantedUntil: Date | null;
};

export const sessionUserSelect = sessionUserWithGuestColumns;

/**
 * Effective product user (impersonated target when a support session is active).
 * Returns null when there is no session or the user row no longer exists.
 */
export const getSessionUser = requestCache(async (): Promise<SessionUser | null> => {
  const ctx = await getRequestContext();
  return ctx.effectiveUser;
});

/** Authenticated account, ignoring impersonation. */
export const getRealSessionUser = requestCache(async (): Promise<SessionUser | null> => {
  const ctx = await getRequestContext();
  return ctx.realUser;
});

export const loadUserById = requestCache(async (userId: string): Promise<SessionUser | null> => {
  const [dbUser] = await db
    .select(sessionUserSelect)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return dbUser ?? null;
});
