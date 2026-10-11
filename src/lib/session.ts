import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sessionUserWithGuestColumns } from '@/lib/job-offer-queries';
import { loadGuestSessionUser } from '@/lib/actor';
import { requestCache } from '@/lib/request-cache';
import { getRequestContext } from '@/lib/request-context';

/** Where a guest goes instead of Stripe. A guest has no account to bill. */
export const GUEST_UPGRADE_HREF = '/register?source=guest-upgrade';

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
  stripePriceId?: string | null;
  stripePaidAt?: Date | null;
  stripeCurrentPeriodEnd?: Date | null;
  stripeTrialEnd?: Date | null;
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

export type DashboardViewer = {
  user: SessionUser;
  isGuest: boolean;
  impersonation: boolean;
};

/**
 * Who is looking at the product shell: the signed-in account, or the guest cookie.
 * Guests stay out of getRequestContext so billing and admin never treat them as accounts.
 */
export const getDashboardViewer = requestCache(async (): Promise<DashboardViewer | null> => {
  const ctx = await getRequestContext();
  if (ctx.effectiveUser && !ctx.effectiveUser.isGuest) {
    return {
      user: ctx.effectiveUser,
      isGuest: false,
      impersonation: Boolean(ctx.impersonation),
    };
  }

  const guest = await loadGuestSessionUser();
  if (!guest) return null;
  return { user: guest, isGuest: true, impersonation: false };
});

export const loadUserById = requestCache(async (userId: string): Promise<SessionUser | null> => {
  const [dbUser] = await db
    .select(sessionUserSelect)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return dbUser ?? null;
});
