import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers, people, userCompanies } from '@/db/schema';
import { isCrmEntity, type CrmEntity } from './crm-views';
import { PERSON_STATUSES, UUID_PATTERN } from './people/types';
import { SELECT_ALL_ID_LIMIT } from './application-filter-bounds';

export function crmIds(input: unknown): string[] {
  if (!Array.isArray(input) || !input.length || input.length > SELECT_ALL_ID_LIMIT || input.some(id => typeof id !== 'string' || !UUID_PATTERN.test(id))) throw new Error('INVALID_IDS');
  return Array.from(new Set(input));
}
export async function setRowsFavorite(userId: string, entity: CrmEntity, input: string[], isFavorite: boolean) {
  if (!isCrmEntity(entity) || typeof isFavorite !== 'boolean') throw new Error('INVALID_INPUT');
  const ids = crmIds(input);
  return db.transaction(async tx => {
    const table = entity === 'applications' ? jobOffers : entity === 'people' ? people : userCompanies;
    const key = entity === 'companies' ? userCompanies.companyId : entity === 'applications' ? jobOffers.id : people.id;
    const where = and(eq(table.userId, userId), inArray(key, ids));
    const rows = await tx.select({ id: key }).from(table).where(where).for('update');
    if (rows.length !== ids.length) throw new Error('NOT_FOUND');
    return tx.update(table).set({ isFavorite }).where(where).returning({ id: key, isFavorite: table.isFavorite });
  });
}
export async function setPeopleStatus(userId: string, input: string[], status: string) {
  if (!(PERSON_STATUSES as readonly string[]).includes(status)) throw new Error('INVALID_STATUS');
  const ids = crmIds(input), where = and(eq(people.userId, userId), inArray(people.id, ids));
  return db.transaction(async tx => {
    const owned = await tx.select({ id: people.id }).from(people).where(where).for('update');
    if (owned.length !== ids.length) throw new Error('NOT_FOUND');
    return tx.update(people).set({ status, updatedAt: new Date() }).where(where).returning({ id: people.id, status: people.status });
  });
}
