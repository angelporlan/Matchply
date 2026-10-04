import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { planConfigs, users } from '@/db/schema';
import { getAccessTier } from '@/lib/subscription';
import { parsePlanConfig } from '@/lib/plan-config';
export type PlanDb = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;
export async function getPlanConfig(tx: PlanDb = db) {
  const [row] = await tx.select().from(planConfigs).where(eq(planConfigs.id, 1)).limit(1);
  if (!row) throw new Error('PLAN_CONFIG_UNAVAILABLE');
  return parsePlanConfig({ ...(row.config as object), version: row.version });
}
export async function getUserPlan(userId: string, tx: PlanDb = db) {
  const [user] = await tx.select({ id: users.id, isGuest: users.isGuest, subscriptionStatus: users.subscriptionStatus, proGrantedUntil: users.proGrantedUntil, accountStatus: users.accountStatus, createdAt: users.createdAt, stripePriceId: users.stripePriceId, stripePaidAt: users.stripePaidAt, stripeCurrentPeriodEnd: users.stripeCurrentPeriodEnd, stripeTrialEnd: users.stripeTrialEnd }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.accountStatus !== 'active') throw new Error('Unauthorized');
  const config = await getPlanConfig(tx);
  const plan = getAccessTier(user.subscriptionStatus, user);
  return { user, config, plan, limits: config[plan] };
}
export async function userPlanFeature(userId: string, feature: import('@/lib/subscription').SubscriptionFeature, tx: PlanDb = db) {
  const { limits, plan } = await getUserPlan(userId, tx);
  if (feature === 'advancedAi') return limits.matchBatchSize > 1;
  if (feature === 'deepResearch') return limits.researchMonthly > 0;
  if (feature === 'agentApi') return limits.apiKeys > 0 && limits.apiRequestsPerMinute > 0 && plan !== 'guest';
  if (feature === 'linkedinExtension') return plan !== 'guest';
  return true;
}
