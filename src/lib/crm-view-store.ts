import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { applicationViews, type ApplicationView } from '@/db/schema';
import { isCrmEntity, normalizeCrmViewName, normalizeEntityConfig, type CrmEntity } from '@/lib/crm-views';

export async function insertCrmView(userId: string, entity: CrmEntity, viewName: string, config: unknown, isDefault = false): Promise<ApplicationView> {
  if (!isCrmEntity(entity)) throw new Error('INVALID_ENTITY');
  const name = normalizeCrmViewName(viewName);
  const normalized = normalizeEntityConfig(entity, config);
  if (!isDefault) {
    const [row] = await db.insert(applicationViews).values({ userId, entity, name, config: normalized }).returning();
    if (!row) throw new Error('VIEW_INSERT_FAILED');
    return row;
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`crm-view:${userId}:${entity}`}))`);
    const [created] = await tx.insert(applicationViews).values({ userId, entity, name, config: normalized }).returning();
    if (!created) throw new Error('VIEW_INSERT_FAILED');
    await tx.update(applicationViews).set({ isDefault: false }).where(and(eq(applicationViews.userId, userId), eq(applicationViews.entity, entity)));
    const [row] = await tx.update(applicationViews).set({ isDefault: true, updatedAt: new Date() }).where(eq(applicationViews.id, created.id)).returning();
    if (!row) throw new Error('VIEW_INSERT_FAILED');
    return row;
  });
}

export async function updateCrmViewRow(userId: string, entity: CrmEntity, id: string, patch: { name?: string; config?: unknown }) {
  if (!isCrmEntity(entity)) throw new Error('INVALID_ENTITY');
  const [row] = await db.update(applicationViews).set({
    ...(patch.name !== undefined ? { name: normalizeCrmViewName(patch.name) } : {}),
    ...(patch.config !== undefined ? { config: normalizeEntityConfig(entity, patch.config) } : {}),
    updatedAt: new Date(),
  }).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).returning();
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

export async function deleteCrmViewRow(userId: string, entity: CrmEntity, id: string) {
  if (!isCrmEntity(entity)) throw new Error('INVALID_ENTITY');
  const [row] = await db.delete(applicationViews).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).returning();
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

export async function setCrmViewDefault(userId: string, entity: CrmEntity, id: string | null) {
  if (!isCrmEntity(entity)) throw new Error('INVALID_ENTITY');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`crm-view:${userId}:${entity}`}))`);
    if (id) {
      const [existing] = await tx.select({ id: applicationViews.id }).from(applicationViews).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).limit(1);
      if (!existing) throw new Error('NOT_FOUND');
    }
    await tx.update(applicationViews).set({ isDefault: false }).where(and(eq(applicationViews.userId, userId), eq(applicationViews.entity, entity)));
    if (!id) return null;
    const [row] = await tx.update(applicationViews).set({ isDefault: true, updatedAt: new Date() }).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).returning();
    return row ?? null;
  });
}

export async function listCrmViewRows(userId: string, entity: CrmEntity) {
  if (!isCrmEntity(entity)) throw new Error('INVALID_ENTITY');
  return db.select().from(applicationViews).where(and(eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).orderBy(desc(applicationViews.isDefault), asc(applicationViews.name));
}

export async function getCrmViewRow(userId: string, id: string) {
  const [row] = await db.select().from(applicationViews).where(and(eq(applicationViews.id, id), eq(applicationViews.userId, userId))).limit(1);
  return row ?? null;
}
