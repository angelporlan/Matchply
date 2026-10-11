import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { planConfigs, planConfigHistory, users } from '@/db/schema';
import { insertCriticalAuditLog, type AuditLogInput } from '@/lib/audit';
import { parsePlanConfig } from '@/lib/plan-config';

/** The HTTP caller must also reject support impersonation via requireAdminContext. */
export async function publishPlanConfig(adminId: string, input: { expectedVersion: number; config: unknown }, actor: Pick<AuditLogInput, 'actorUserId' | 'affectedUserId' | 'supportSessionId'> = {}) {
  if (actor.supportSessionId) throw new Error('ADMIN_IMPERSONATION_FORBIDDEN');
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) throw new Error('INVALID_VERSION');
  const next = parsePlanConfig(input.config);
  return db.transaction(async tx => {
    const [admin] = await tx.select({ id: users.id, email: users.email, role: users.role, isGuest: users.isGuest, accountStatus: users.accountStatus }).from(users).where(eq(users.id, adminId)).limit(1);
    if (!admin || admin.role !== 'admin' || admin.isGuest || admin.accountStatus !== 'active') throw new Error('ADMIN_REQUIRED');
    const [row] = await tx.select().from(planConfigs).where(eq(planConfigs.id, 1)).for('update').limit(1);
    if (!row) throw new Error('PLAN_CONFIG_UNAVAILABLE');
    if (row.version !== input.expectedVersion) throw new Error('PLAN_CONFIG_CONFLICT');
    const previous = parsePlanConfig({ ...(row.config as object), version: row.version });
    if (JSON.stringify(previous.guest) !== JSON.stringify(next.guest)) throw new Error('GUEST_CONFIG_READ_ONLY');
    if (next.paywall.experimentVersion < previous.paywall.experimentVersion || JSON.stringify(previous.paywall.copy) !== JSON.stringify(next.paywall.copy) && next.paywall.experimentVersion === previous.paywall.experimentVersion) throw new Error('EXPERIMENT_VERSION_REQUIRED');
    const config = { ...next, version: row.version + 1 };
    await tx.update(planConfigs).set({ version: config.version, config, updatedByUserId: admin.id, updatedAt: new Date() }).where(eq(planConfigs.id, 1));
    await tx.insert(planConfigHistory).values({ version: config.version, config, updatedByUserId: admin.id });
    await insertCriticalAuditLog(tx, { action: 'admin_plan_config_save', userId: admin.id, userEmail: admin.email,
      details: { version: config.version, previous, next: config }, ...actor, category: 'admin' });
    return config;
  });
}
