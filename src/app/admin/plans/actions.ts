'use server';

import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { planConfigHistory, users } from '@/db/schema';
import { requireAdminContext, auditActorFields } from '@/lib/request-context';
import { publishPlanConfig } from '@/lib/plan-admin';
import { getPlanConfig } from '@/lib/plan-store';
import { parsePlanConfig } from '@/lib/plan-config';
import { getMonetizationMetrics } from '@/lib/monetization';
import { getResolvedAiRuntime } from '@/lib/ai-runtime-store';

export async function loadPlansAdminState() {
  await requireAdminContext();
  const config = await getPlanConfig();
  const [history, metrics, runtime] = await Promise.all([
    db.select({ version: planConfigHistory.version, createdAt: planConfigHistory.createdAt, author: users.email })
      .from(planConfigHistory).leftJoin(users, eq(users.id, planConfigHistory.updatedByUserId)).orderBy(desc(planConfigHistory.version)).limit(20),
    getMonetizationMetrics(config.paywall.experimentVersion),
    getResolvedAiRuntime(true),
  ]);
  return { config, history, metrics, modelReferences: runtime.general };
}

export async function loadHistoricPlanConfigAction(version: number) {
  await requireAdminContext();
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('INVALID_VERSION');
  const [historic] = await db.select({ config: planConfigHistory.config }).from(planConfigHistory)
    .where(eq(planConfigHistory.version, version)).limit(1);
  if (!historic) throw new Error('VERSION_NOT_FOUND');
  return parsePlanConfig(historic.config);
}

export async function savePlansConfigAction(input: { expectedVersion: number; config: unknown }) {
  const { admin, ...ctx } = await requireAdminContext();
  try {
    const published = await publishPlanConfig(admin.id, input, auditActorFields(ctx));
    for (const path of ['/admin/plans', '/', '/dashboard', '/dashboard/subscription', '/dashboard/profile']) revalidatePath(path);
    return { success: true as const, config: published };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PLAN_CONFIG_SAVE_FAILED';
    return { success: false as const, code };
  }
}
