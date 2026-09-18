import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { canAccessFeature, SubscriptionFeature } from '@/lib/subscription';
import { requestCache } from '@/lib/request-cache';

export class SubscriptionAccessError extends Error {
  readonly status = 403;

  constructor(public readonly feature: SubscriptionFeature) {
    super(`A PRO subscription is required to access ${feature}.`);
    this.name = 'SubscriptionAccessError';
  }
}

export type EntitlementUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionStatus: string;
  isGuest: boolean;
};

/** Narrow user read for entitlement checks; memoized per request by userId. */
export const getEntitlementUser = requestCache(async (userId: string): Promise<EntitlementUser | null> => {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      subscriptionStatus: users.subscriptionStatus,
      isGuest: users.isGuest,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
});

export async function requireUserFeature(userId: string, feature: SubscriptionFeature) {
  const user = await getEntitlementUser(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (!canAccessFeature(user.subscriptionStatus, feature, { isGuest: user.isGuest })) {
    throw new SubscriptionAccessError(feature);
  }

  return user;
}
