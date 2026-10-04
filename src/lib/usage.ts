import { createHash } from 'crypto';
import { and, asc, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, cvs, jobResearchRuns, usageItems, usageOperations, usagePeriods, users, monetizationAssignments, monetizationEvents } from '@/db/schema';
import { getUserPlan, type PlanDb } from '@/lib/plan-store';
export type UsageBucket = 'general' | 'matching' | 'research';
export type UsageOperation = typeof usageOperations.$inferSelect;
export class UsageError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details: Record<string, unknown> = {}) { super(message); this.name = 'UsageError'; }
  toJSON() { return { error: this.message, code: this.code, ...this.details }; }
}
export function utcUsageMonth(now = new Date()) { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }
export function nextUsageMonth(start: Date) { return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); }
function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).filter(([, v]) => v !== undefined).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function usageInputHash(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
export type UsageInput = { bucket: UsageBucket; requestId: string; action: string; input: unknown; units?: number; jobId?: string };
export async function reserveUsage(tx: PlanDb, userId: string, input: UsageInput): Promise<UsageOperation> {
  const units = input.units ?? 1;
  if (!Number.isSafeInteger(units) || units < 1 || !input.requestId || input.requestId.length > 200 || !input.action || input.action.length > 80) throw new UsageError(400, 'INVALID_OPERATION', 'Invalid operation');
  // This lock also serializes first-period creation and guest claim with admissions.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${userId}`}))`);
  const hash = usageInputHash(input.input);
  const [existing] = await tx.select().from(usageOperations).where(and(eq(usageOperations.userId, userId), eq(usageOperations.action, input.action), eq(usageOperations.requestId, input.requestId))).for('update').limit(1);
  if (existing) {
    if (existing.inputHash !== hash || existing.bucket !== input.bucket || existing.units !== units) throw new UsageError(409, 'OPERATION_CONFLICT', 'The operation identifier belongs to another request');
    if (existing.status === 'released') throw new UsageError(409, 'OPERATION_RELEASED', 'This operation failed; start a new operation to retry');
    return existing;
  }
  const { user, plan, limits, config } = await getUserPlan(userId, tx);
  const periodStart = user.isGuest ? new Date(0) : utcUsageMonth();
  const limit = input.bucket === 'general' ? limits.generalAiMonthly : input.bucket === 'matching' ? limits.matchingMonthly : limits.researchMonthly;
  const resetAt = user.isGuest ? null : nextUsageMonth(periodStart).toISOString();
  await tx.insert(usagePeriods).values({ userId, bucket: input.bucket, periodStart }).onConflictDoNothing();
  const [period] = await tx.select().from(usagePeriods).where(and(eq(usagePeriods.userId, userId), eq(usagePeriods.bucket, input.bucket), eq(usagePeriods.periodStart, periodStart))).for('update').limit(1);
  const usage = { used: period.used, reserved: period.reserved, limit, remaining: Math.max(0, limit - period.used - period.reserved), resetAt };
  if (limit === 0) throw new UsageError(403, 'PLAN_REQUIRED', 'This feature is unavailable in your plan', { bucket: input.bucket, usage });
  if (period.used + period.reserved + units > limit) throw new UsageError(429, 'QUOTA_EXCEEDED', 'Your allowance is exhausted', { bucket: input.bucket, usage, required: units });
  await tx.update(usagePeriods).set({ reserved: period.reserved + units, updatedAt: new Date() }).where(eq(usagePeriods.id, period.id));
  const [operation] = await tx.insert(usageOperations).values({ userId, periodId: period.id, bucket: input.bucket, requestId: input.requestId, action: input.action, inputHash: hash, units, configVersion: config.version, plan, jobId: input.jobId, expiresAt: new Date(Date.now() + 10 * 60_000) }).returning();
  return operation;
}
export async function beginUsage(userId: string, input: UsageInput) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${userId}`}))`);
    const [previous] = await tx.select({ id: usageOperations.id }).from(usageOperations).where(and(eq(usageOperations.userId, userId), eq(usageOperations.action, input.action), eq(usageOperations.requestId, input.requestId))).limit(1);
    const operation = await reserveUsage(tx, userId, input);
    if (previous && operation.status === 'reserved') throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'This operation is still in progress', { operationId: operation.id });
    return operation;
  });
}
async function lockedOperation(tx: PlanDb, id: string) {
  // Always lock user before operation/period, same order as admission and claim.
  const [identity] = await tx.select({ userId: usageOperations.userId }).from(usageOperations).where(eq(usageOperations.id, id)).limit(1);
  if (!identity) throw new UsageError(404, 'OPERATION_NOT_FOUND', 'Operation not found');
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${identity.userId}`}))`);
  // Claim may have moved a guest operation while we waited for its lock. A guest
  // moves once; a completed claim releases its account locks before this read.
  const [current] = await tx.select({ userId: usageOperations.userId }).from(usageOperations).where(eq(usageOperations.id, id)).limit(1);
  if (!current) throw new UsageError(404, 'OPERATION_NOT_FOUND', 'Operation not found');
  if (current.userId !== identity.userId) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${current.userId}`}))`);
  const [operation] = await tx.select().from(usageOperations).where(eq(usageOperations.id, id)).for('update').limit(1);
  return operation;
}
export async function consumeUsage(tx: PlanDb, id: string, result: unknown, units?: number) {
  const operation = await lockedOperation(tx, id);
  if (operation.status === 'consumed') return operation;
  if (operation.status !== 'reserved') throw new UsageError(409, 'OPERATION_RELEASED', 'Operation no longer owns a reservation');
  const delta = units ?? (operation.units - operation.consumedUnits);
  if (!Number.isSafeInteger(delta) || delta < 0 || delta > operation.units - operation.consumedUnits) throw new UsageError(400, 'INVALID_OPERATION', 'Invalid consumption');
  const consumed = operation.consumedUnits + delta;
  await tx.update(usagePeriods).set({ used: sql`${usagePeriods.used} + ${delta}`, reserved: sql`${usagePeriods.reserved} - ${delta}`, updatedAt: new Date() }).where(eq(usagePeriods.id, operation.periodId));
  const [updated] = await tx.update(usageOperations).set({ consumedUnits: consumed, status: consumed === operation.units ? 'consumed' : 'reserved', result: result ?? operation.result, updatedAt: new Date() }).where(eq(usageOperations.id, id)).returning();
  return updated;
}
export async function consumeUsageItem(tx: PlanDb, id: string, itemKey: string, result?: unknown) {
  const operation = await lockedOperation(tx, id);
  if (operation.status === 'consumed' && operation.plan === 'legacy' && operation.configVersion === 0) return operation;
  const [already] = await tx.select().from(usageItems).where(and(eq(usageItems.operationId, id), eq(usageItems.itemKey, itemKey))).limit(1);
  if (already) return operation;
  if (operation.status !== 'reserved') throw new UsageError(409, 'OPERATION_RELEASED', 'Operation no longer owns a reservation');
  await tx.insert(usageItems).values({ operationId: id, itemKey });
  return consumeUsage(tx, id, result ?? operation.result, 1);
}
export async function releaseUsage(tx: PlanDb, id: string) {
  const operation = await lockedOperation(tx, id);
  if (operation.status !== 'reserved') return operation;
  const remaining = operation.units - operation.consumedUnits;
  await tx.update(usagePeriods).set({ reserved: sql`${usagePeriods.reserved} - ${remaining}`, updatedAt: new Date() }).where(eq(usagePeriods.id, operation.periodId));
  await tx.delete(cvs).where(and(eq(cvs.pendingUsageOperationId, id), eq(cvs.content, '')));
  await tx.update(cvs).set({ pendingUsageOperationId: null }).where(eq(cvs.pendingUsageOperationId, id));
  const [updated] = await tx.update(usageOperations).set({ status: 'released', updatedAt: new Date() }).where(eq(usageOperations.id, id)).returning();
  return updated;
}
export async function transferGuestUsage(tx: PlanDb, guestId: string, userId: string) {
  for (const id of [guestId, userId].sort()) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${id}`}))`);
    if (id === userId && id !== guestId) {
      // A second request may have read the cookie before the first claim
      // committed. Its guest is then deleted: do not wait for the old guest
      // lock while holding the account lock needed by an in-flight publisher.
      const [guest] = await tx.select({ isGuest: users.isGuest }).from(users).where(eq(users.id, guestId)).limit(1);
      if (!guest?.isGuest) return;
    }
  }
  const guestPeriods = await tx.select().from(usagePeriods).where(eq(usagePeriods.userId, guestId));
  for (const period of guestPeriods) {
    const start = utcUsageMonth();
    await tx.insert(usagePeriods).values({ userId, bucket: period.bucket, periodStart: start }).onConflictDoNothing();
    const [destination] = await tx.select().from(usagePeriods).where(and(eq(usagePeriods.userId, userId), eq(usagePeriods.bucket, period.bucket), eq(usagePeriods.periodStart, start))).for('update').limit(1);
    await tx.update(usagePeriods).set({ used: destination.used + period.used, reserved: destination.reserved + period.reserved, updatedAt: new Date() }).where(eq(usagePeriods.id, destination.id));
    await tx.execute(sql`UPDATE usage_operation source SET "requestId" = ${`claimed:${guestId}:`} || source."requestId" WHERE source."userId" = ${guestId} AND EXISTS (SELECT 1 FROM usage_operation target WHERE target."userId" = ${userId} AND target.action=source.action AND target."requestId"=source."requestId")`);
    await tx.update(usageOperations).set({ userId, periodId: destination.id }).where(eq(usageOperations.periodId, period.id));
    await tx.delete(usagePeriods).where(eq(usagePeriods.id, period.id));
  }
  const assignments = await tx.select().from(monetizationAssignments).where(eq(monetizationAssignments.userId, guestId));
  for (const assignment of assignments) {
    await tx.insert(monetizationAssignments).values({ userId, experimentVersion: assignment.experimentVersion, variant: assignment.variant, firstExposedAt: assignment.firstExposedAt, createdAt: assignment.createdAt }).onConflictDoUpdate({ target: [monetizationAssignments.userId, monetizationAssignments.experimentVersion], set: { variant: assignment.variant, firstExposedAt: sql`least(${monetizationAssignments.firstExposedAt}, ${assignment.firstExposedAt})` } });
  }
  await tx.update(monetizationEvents).set({ userId }).where(eq(monetizationEvents.userId, guestId));
  await tx.execute(sql`UPDATE "user" target SET "firstValueAt"=coalesce(target."firstValueAt",guest."firstValueAt") FROM "user" guest WHERE target.id=${userId} AND guest.id=${guestId}`);
}
export async function runWithUsage<T>(userId: string, input: UsageInput, fn: (operation: UsageOperation) => Promise<T>): Promise<T> {
  const operation = await beginUsage(userId, input);
  if (operation.status === 'consumed') return operation.result as T;
  try {
    const result = await fn(operation);
    await db.transaction(tx => consumeUsage(tx, operation.id, result));
    return result;
  } catch (error) {
    await db.transaction(tx => releaseUsage(tx, operation.id));
    throw error;
  }
}
export async function renewUsageOperation(id: string) {
  await db.update(usageOperations).set({ expiresAt: new Date(Date.now() + 10 * 60_000) }).where(and(eq(usageOperations.id, id), eq(usageOperations.status, 'reserved')));
}
export async function reconcileUsage() {
  // Long-lived queued jobs must not fill every cleanup page and starve expired
  // synchronous operations while workers are paused or unavailable.
  const candidates = await db.select().from(usageOperations).where(and(
    eq(usageOperations.status, 'reserved'), lt(usageOperations.expiresAt, new Date()),
    sql`NOT EXISTS (SELECT 1 FROM ${aiJobs} WHERE ${aiJobs.id} = ${usageOperations.jobId} AND ${aiJobs.status} IN ('queued', 'running'))`,
    sql`NOT EXISTS (SELECT 1 FROM ${jobResearchRuns} WHERE ${jobResearchRuns.id} = ${usageOperations.jobId} AND ${jobResearchRuns.status} IN ('queued', 'running'))`,
  )).orderBy(asc(usageOperations.expiresAt), asc(usageOperations.id)).limit(100);
  for (const candidate of candidates) await db.transaction(async tx => {
    const operation = await lockedOperation(tx, candidate.id);
    if (operation.status !== 'reserved' || operation.expiresAt > new Date()) return;
    if (operation.jobId) {
      const [job] = await tx.select({ status: aiJobs.status, leaseUntil: aiJobs.leaseUntil }).from(aiJobs).where(eq(aiJobs.id, operation.jobId)).limit(1);
      const [research] = await tx.select({ status: jobResearchRuns.status }).from(jobResearchRuns).where(eq(jobResearchRuns.id, operation.jobId)).limit(1);
      if (job && ['queued', 'running'].includes(job.status) || research && ['queued', 'running'].includes(research.status)) return;
    }
    await releaseUsage(tx, operation.id);
  });
}
export async function getUsageSnapshot(userId: string) {
  const { user, config, plan, limits } = await getUserPlan(userId);
  const start = user.isGuest ? new Date(0) : utcUsageMonth();
  const periods = await db.select().from(usagePeriods).where(and(eq(usagePeriods.userId, userId), eq(usagePeriods.periodStart, start)));
  const usage = {} as Record<UsageBucket, { used: number; reserved: number; limit: number; remaining: number; resetAt: string | null }>;
  for (const bucket of ['general', 'matching', 'research'] as const) {
    const row = periods.find(p => p.bucket === bucket);
    const limit = bucket === 'general' ? limits.generalAiMonthly : bucket === 'matching' ? limits.matchingMonthly : limits.researchMonthly;
    const used = row?.used ?? 0, reserved = row?.reserved ?? 0;
    usage[bucket] = { used, reserved, limit, remaining: Math.max(0, limit - used - reserved), resetAt: user.isGuest ? null : nextUsageMonth(start).toISOString() };
  }
  return { plan, configVersion: config.version, limits, usage };
}
