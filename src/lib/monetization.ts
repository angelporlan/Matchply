import { createHash, randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { monetizationAssignments, monetizationEvents, users } from '@/db/schema';
import { getPlanConfig } from '@/lib/plan-store';
import type { PlanLimits } from '@/lib/plan-config';

export const MONETIZATION_CLIENT_EVENTS = ['paywall_view', 'paywall_cta', 'quota_warning', 'quota_blocked'] as const;
export type MonetizationClientEvent = typeof MONETIZATION_CLIENT_EVENTS[number];
export type MonetizationEvent = MonetizationClientEvent | 'first_value_ready' | 'checkout_started' | 'trial_started' | 'subscription_paid';
export type PaywallVariant = 'a' | 'b';
export type PaywallCopy = { es: { title: string; body: string; cta: string }; en: { title: string; body: string; cta: string } };
export type PaywallPresentation = {
  experimentVersion: number; variant: PaywallVariant | null; mode: 'ab' | 'a' | 'b' | 'paused'; copy: PaywallCopy; limits: PlanLimits;
};

export function assignPaywallVariant(userId: string, experimentVersion: number): PaywallVariant {
  return createHash('sha256').update(`${experimentVersion}:${userId}`).digest()[0] % 2 === 0 ? 'a' : 'b';
}

export async function getPaywallPresentation(userId: string, database: MonetizationDatabase = db): Promise<PaywallPresentation> {
  const { paywall, pro } = await getPlanConfig(database);
  if (paywall.mode === 'paused') return { experimentVersion: paywall.experimentVersion, variant: null, mode: paywall.mode, copy: paywall.copy.a, limits: pro };
  const variant = paywall.mode === 'a' || paywall.mode === 'b' ? paywall.mode : assignPaywallVariant(userId, paywall.experimentVersion);
  const insert = database.insert(monetizationAssignments).values({ userId, experimentVersion: paywall.experimentVersion, variant });
  if (paywall.mode === 'a' || paywall.mode === 'b') await insert.onConflictDoUpdate({ target: [monetizationAssignments.userId, monetizationAssignments.experimentVersion], set: { variant } });
  else await insert.onConflictDoNothing();
  const [assignment] = await database.select({ variant: monetizationAssignments.variant }).from(monetizationAssignments)
    .where(and(eq(monetizationAssignments.userId, userId), eq(monetizationAssignments.experimentVersion, paywall.experimentVersion))).limit(1);
  const selected = paywall.mode === 'a' || paywall.mode === 'b' ? paywall.mode : assignment?.variant === 'b' ? 'b' : 'a';
  return { experimentVersion: paywall.experimentVersion, variant: selected, mode: paywall.mode, copy: paywall.copy[selected], limits: pro };
}

export type MonetizationDatabase = Pick<typeof db, 'insert' | 'select' | 'update' | 'delete' | 'execute'>;

/** Billing calls this inside the same transaction as fulfillment. */
export async function recordMonetizationEvent(input: {
  userId: string; event: MonetizationEvent; source?: string; externalId?: string;
  experimentVersion?: number | null; variant?: PaywallVariant | null;
  metadata?: Record<string, string | number | boolean | null>;
}, database: MonetizationDatabase = db) {
  let experimentVersion = input.experimentVersion;
  let variant = input.variant;
  if (input.experimentVersion === undefined || input.variant === undefined) {
    const presentation = await getPaywallPresentation(input.userId, database);
    experimentVersion = presentation.experimentVersion;
    variant = presentation.variant;
  }
  // Pausing the experiment keeps functional offers visible but stops experiment collection.
  if (!variant || !experimentVersion) return;
  await database.insert(monetizationEvents).values({
    userId: input.userId, experimentVersion, variant, event: input.event,
    source: input.source || 'web', externalId: input.externalId || null,
    metadata: input.metadata || {},
  }).onConflictDoNothing();
  if (input.event === 'paywall_view') {
    await database.update(monetizationAssignments).set({ firstExposedAt: sql`coalesce(${monetizationAssignments.firstExposedAt}, now())` })
      .where(and(eq(monetizationAssignments.userId, input.userId), eq(monetizationAssignments.experimentVersion, experimentVersion)));
  }
}

export async function recordFirstValue(userId: string, database: MonetizationDatabase = db) {
  await database.update(users).set({ firstValueAt: new Date() }).where(and(eq(users.id, userId), isNull(users.firstValueAt)));
  await recordMonetizationEvent({ userId, event: 'first_value_ready', externalId: `first-value:${userId}`, source: 'cv-adapted' }, database);
}

export type MonetizationVariantMetrics = { exposed: number; cta: number; checkouts: number; trials: number; paid: number; conversionRate: number; matureTrials: number; matureTrialPaid: number; trialConversionRate: number };
export type MonetizationMetrics = { experimentVersion: number; variants: Record<PaywallVariant, MonetizationVariantMetrics> };

export async function getMonetizationMetrics(experimentVersion?: number): Promise<MonetizationMetrics> {
  const version = experimentVersion || (await getPlanConfig()).paywall.experimentVersion;
  // A conversion belongs to an exposure only during its following 30 days.
  const result = await db.execute(sql`
    select a.variant,
      count(distinct a."userId") filter (where a."firstExposedAt" is not null)::int as exposed,
      count(distinct e."userId") filter (where e.event = 'paywall_cta')::int as cta,
      count(distinct e."userId") filter (where e.event = 'checkout_started')::int as checkouts,
      count(distinct e."userId") filter (where e.event = 'trial_started')::int as trials,
      count(distinct e."userId") filter (where e.event = 'subscription_paid')::int as paid,
      count(distinct e."userId") filter (where e.event = 'trial_started' and e."createdAt" <= now() - interval '14 days')::int as "matureTrials",
      count(distinct e."userId") filter (where e.event = 'subscription_paid' and exists (
        select 1 from monetization_event t where t."userId" = e."userId" and t."experimentVersion" = e."experimentVersion"
        and t.variant = e.variant and t.event = 'trial_started' and t."createdAt" >= a."firstExposedAt"
        and t."createdAt" <= now() - interval '14 days' and t."createdAt" <= e."createdAt"
      ))::int as "matureTrialPaid"
    from monetization_assignment a
    left join monetization_event e on e."userId" = a."userId" and e."experimentVersion" = a."experimentVersion"
      and e.variant = a.variant and e."createdAt" >= a."firstExposedAt"
      and e."createdAt" < a."firstExposedAt" + interval '30 days'
    where a."experimentVersion" = ${version}
    group by a.variant
  `);
  const empty = (): MonetizationVariantMetrics => ({ exposed: 0, cta: 0, checkouts: 0, trials: 0, paid: 0, conversionRate: 0, matureTrials: 0, matureTrialPaid: 0, trialConversionRate: 0 });
  const variants = { a: empty(), b: empty() };
  for (const row of result.rows as Array<Record<string, unknown>>) {
    if (row.variant !== 'a' && row.variant !== 'b') continue;
    const metric = variants[row.variant];
    for (const field of ['exposed', 'cta', 'checkouts', 'trials', 'paid', 'matureTrials', 'matureTrialPaid'] as const) metric[field] = Number(row[field]) || 0;
    metric.conversionRate = metric.exposed ? Math.round(metric.paid / metric.exposed * 10_000) / 100 : 0;
    metric.trialConversionRate = metric.matureTrials ? Math.round(metric.matureTrialPaid / metric.matureTrials * 10_000) / 100 : 0;
  }
  return { experimentVersion: version, variants };
}

export function monetizationClientEventId(userId: string, requestId?: string) {
  return `client:${userId}:${requestId || randomUUID()}`;
}
