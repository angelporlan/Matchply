import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { canAccessFeature, SubscriptionFeature } from '@/lib/subscription';

export class SubscriptionAccessError extends Error {
  readonly status = 403;

  constructor(public readonly feature: SubscriptionFeature) {
    super(`A PRO subscription is required to access ${feature}.`);
    this.name = 'SubscriptionAccessError';
  }
}

export async function requireUserFeature(userId: string, feature: SubscriptionFeature) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  if (!canAccessFeature(user.subscriptionStatus, feature, { isGuest: user.isGuest })) {
    throw new SubscriptionAccessError(feature);
  }

  return user;
}
