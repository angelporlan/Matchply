import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cvPlanSelections, cvs, cvVariants } from '@/db/schema';
import { getUserPlan, type PlanDb } from '@/lib/plan-store';
import { UsageError } from '@/lib/usage';
export async function lockCvUser(tx: PlanDb, userId: string) { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${userId}`}))`); }
export async function getCvAccess(userId: string, tx: PlanDb = db) {
  const { plan, limits } = await getUserPlan(userId, tx);
  const rows = await tx.select({ id: cvs.id, title: cvs.title, isBase: cvs.isBase, isPrincipal: cvs.isPrincipal, pendingUsageOperationId: cvs.pendingUsageOperationId }).from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.updatedAt), desc(cvs.id));
  const [selection] = await tx.select().from(cvPlanSelections).where(eq(cvPlanSelections.userId, userId)).limit(1);
  const bases = rows.filter(cv => cv.isBase);
  const preferredBase = bases.find(cv => cv.id === selection?.baseCvId) ?? bases.find(cv => cv.isPrincipal) ?? bases[0];
  const baseCvId = preferredBase?.id ?? rows[0]?.id ?? null;
  if (plan === 'pro' && limits.maxCvs === null && limits.maxBaseCvs === null && limits.maxAdaptedCvs === null) return { total: rows.length, max: null, activeIds: rows.map(cv => cv.id), readOnlyIds: [] as string[], baseCvId, cvs: rows };
  const orderedBases = preferredBase ? [preferredBase, ...bases.filter(cv => cv.id !== preferredBase.id)] : bases;
  const baseIds = orderedBases.slice(0, limits.maxBaseCvs ?? bases.length).map(cv => cv.id);
  // Legacy extra base documents remain available in read-only mode, rather than being reclassified.
  const variants = rows.filter(cv => !cv.isBase);
  const selectedVariants = (selection?.adaptedCvIds ?? []).map(id => variants.find(cv => cv.id === id)).filter((cv): cv is typeof variants[number] => Boolean(cv));
  const candidates = [...selectedVariants, ...variants.filter(cv => !selectedVariants.some(selected => selected.id === cv.id))];
  const activeIds = [...baseIds, ...candidates.slice(0, limits.maxAdaptedCvs ?? candidates.length).map(cv => cv.id)].slice(0, limits.maxCvs ?? rows.length);
  return { total: rows.length, max: limits.maxCvs, activeIds, readOnlyIds: rows.filter(cv => !activeIds.includes(cv.id)).map(cv => cv.id), baseCvId: activeIds.includes(baseCvId ?? '') ? baseCvId : activeIds[0] ?? null, cvs: rows };
}
export async function requireCvCreation(tx: PlanDb, userId: string, input: { isBase?: boolean }) {
  if (input.isBase !== undefined && typeof input.isBase !== 'boolean') throw new UsageError(400, 'INVALID_CV_TYPE', 'Invalid resume category');
  await lockCvUser(tx, userId);
  const { limits } = await getUserPlan(userId, tx);
  const [row] = await tx.select({ total: sql<number>`cast(count(*) as int)`, bases: sql<number>`cast(count(*) filter (where ${cvs.isBase}) as int)`, adapted: sql<number>`cast(count(*) filter (where not ${cvs.isBase}) as int)` }).from(cvs).where(eq(cvs.userId, userId));
  const max = input.isBase ? limits.maxBaseCvs : limits.maxAdaptedCvs;
  const categoryCount = input.isBase ? row.bases : row.adapted;
  if (limits.maxCvs !== null && row.total >= limits.maxCvs || max !== null && categoryCount >= max) throw new UsageError(403, 'CV_LIMIT', 'Your plan does not have room for another resume', { total: row.total, limit: limits.maxCvs, category: input.isBase ? 'base' : 'adapted' });
}
export async function requireEditableCv(tx: PlanDb, userId: string, cvId: string) {
  await lockCvUser(tx, userId);
  const access = await getCvAccess(userId, tx);
  const cv = access.cvs.find(item => item.id === cvId);
  if (!cv) throw new UsageError(404, 'CV_NOT_FOUND', 'Resume not found');
  if (!access.activeIds.includes(cvId)) throw new UsageError(403, 'CV_READ_ONLY', 'This resume is read-only in your current plan', { cvId });
  return cv;
}
export async function createCvForUser(userId: string, values: Omit<typeof cvs.$inferInsert, 'userId'>) {
  return db.transaction(async tx => {
    await requireCvCreation(tx, userId, { isBase: values.isBase });
    const [cv] = await tx.insert(cvs).values({ ...values, userId }).returning();
    return cv;
  });
}
/** A new manual source occupies the base slot again if its previous base was deleted. */
export async function createManualCvForUser(userId: string, values: Omit<typeof cvs.$inferInsert, 'userId' | 'isBase' | 'isPrincipal'>) {
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const [{ total, bases }] = await tx.select({ total: sql<number>`cast(count(*) as int)`, bases: sql<number>`cast(count(*) filter (where ${cvs.isBase}) as int)` }).from(cvs).where(eq(cvs.userId, userId));
    const isBase = bases === 0;
    await requireCvCreation(tx, userId, { isBase });
    const [created] = await tx.insert(cvs).values({ ...values, userId, isBase, isPrincipal: total === 0 }).returning();
    return created;
  });
}
export async function updateCvForUser(userId: string, cvId: string, values: Partial<typeof cvs.$inferInsert>) {
  const mutable = new Set(['title', 'content', 'isBase', 'isPrincipal', 'templateName', 'accentColor', 'fontFamily', 'pageMargin', 'scale']);
  if (!values || typeof values !== 'object' || Object.keys(values).some(key => !mutable.has(key))) throw new UsageError(400, 'INVALID_CV_PATCH', 'Invalid resume fields');
  if (values.isBase !== undefined && typeof values.isBase !== 'boolean' || values.isPrincipal !== undefined && typeof values.isPrincipal !== 'boolean') throw new UsageError(400, 'INVALID_CV_TYPE', 'Invalid resume category');
  return db.transaction(async tx => {
    const current = await requireEditableCv(tx, userId, cvId);
    if (current.pendingUsageOperationId) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'This resume is being generated');
    if (values.isBase !== undefined && values.isBase !== current.isBase) {
      const { limits } = await getUserPlan(userId, tx);
      const [count] = await tx.select({ count: sql<number>`cast(count(*) as int)` }).from(cvs).where(and(eq(cvs.userId, userId), eq(cvs.isBase, values.isBase)));
      const max = values.isBase ? limits.maxBaseCvs : limits.maxAdaptedCvs;
      if (max !== null && count.count >= max) throw new UsageError(403, 'CV_LIMIT', 'Your plan does not have room for this resume category');
    }
    const [updated] = await tx.update(cvs).set(values).where(and(eq(cvs.id, cvId), eq(cvs.userId, userId))).returning();
    if (values.content !== undefined && updated.optimizationId && updated.activeOptimizeMode) {
      await tx.update(cvVariants).set({ content: values.content, revision: sql`${cvVariants.revision} + 1`, updatedAt: new Date() })
        .where(and(eq(cvVariants.optimizationId, updated.optimizationId), eq(cvVariants.modeId, updated.activeOptimizeMode), eq(cvVariants.status, 'ready')));
    }
    return updated;
  });
}
export async function reserveCvTarget(tx: PlanDb, userId: string, input: { baseCvId?: string | null; targetCvId?: string | null; confirmOverwrite?: boolean; operationId: string; values: Partial<typeof cvs.$inferInsert> }) {
  if (input.values.isBase !== undefined && typeof input.values.isBase !== 'boolean') throw new UsageError(400, 'INVALID_CV_TYPE', 'Invalid resume category');
  await lockCvUser(tx, userId);
  if (input.baseCvId) await requireEditableCv(tx, userId, input.baseCvId);
  if (input.targetCvId) {
    await requireEditableCv(tx, userId, input.targetCvId);
    const [target] = await tx.select({ id: cvs.id, content: cvs.content, pending: cvs.pendingUsageOperationId }).from(cvs).where(and(eq(cvs.id, input.targetCvId), eq(cvs.userId, userId))).for('update').limit(1);
    const [category] = await tx.select({ isBase: cvs.isBase }).from(cvs).where(eq(cvs.id, target.id)).limit(1);
    if (input.values.isBase !== undefined && input.values.isBase !== category.isBase) {
      const { limits } = await getUserPlan(userId, tx);
      const [{ count }] = await tx.select({ count: sql<number>`cast(count(*) as int)` }).from(cvs).where(and(eq(cvs.userId, userId), eq(cvs.isBase, input.values.isBase)));
      const cap = input.values.isBase ? limits.maxBaseCvs : limits.maxAdaptedCvs;
      if (cap !== null && count >= cap) throw new UsageError(403, 'CV_LIMIT', 'Your plan does not have room for this resume category');
    }
    if (target.pending && target.pending !== input.operationId) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'Another operation is using this resume');
    if (target.content.trim() && !input.confirmOverwrite) throw new UsageError(409, 'CV_OVERWRITE_CONFIRM', 'Confirm replacing this resume');
    await tx.update(cvs).set({ pendingUsageOperationId: input.operationId }).where(eq(cvs.id, target.id));
    return target.id;
  }
  await requireCvCreation(tx, userId, { isBase: input.values.isBase ?? false });
  const [created] = await tx.insert(cvs).values({ ...input.values, userId, title: input.values.title ?? 'Resume', content: '', pendingUsageOperationId: input.operationId }).returning({ id: cvs.id });
  return created.id;
}
export async function selectActiveCvs(userId: string, baseCvId: string | null, adaptedCvIds: string[]) {
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const { limits } = await getUserPlan(userId, tx);
    if (new Set(adaptedCvIds).size !== adaptedCvIds.length || limits.maxBaseCvs === 0 && baseCvId || limits.maxAdaptedCvs !== null && adaptedCvIds.length > limits.maxAdaptedCvs || limits.maxCvs !== null && adaptedCvIds.length + (baseCvId ? 1 : 0) > limits.maxCvs) throw new UsageError(400, 'INVALID_CV_SELECTION', 'Invalid resume selection');
    const rows = await tx.select({ id: cvs.id, isBase: cvs.isBase }).from(cvs).where(eq(cvs.userId, userId));
    if (baseCvId && !rows.some(cv => cv.id === baseCvId && cv.isBase) || adaptedCvIds.some(id => !rows.some(cv => cv.id === id && !cv.isBase))) throw new UsageError(400, 'INVALID_CV_SELECTION', 'Invalid resume selection');
    await tx.insert(cvPlanSelections).values({ userId, baseCvId, adaptedCvIds }).onConflictDoUpdate({ target: cvPlanSelections.userId, set: { baseCvId, adaptedCvIds, updatedAt: new Date() } });
    return getCvAccess(userId, tx);
  });
}
