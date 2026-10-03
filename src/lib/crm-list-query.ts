import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { companies, jobOffers, companyNotes, userCompanies, people, personCompanies, personOffers, personMessages } from '@/db/schema';
import { companyListColumns } from './job-offer-queries';
import { personListColumns } from './people/service';
import { columnDateRange, escapeIlikePattern, SELECT_ALL_ID_LIMIT } from './application-filter-bounds';
import { crmColumns, normalizeCrmConfig, type ListEntity, type CrmConfig, type CrmRow, type CrmFilter, type CrmPage } from './crm-views';
import type { ApplicationColumnFilter } from './application-views';

function project(columns: Record<string, unknown>) {
  return sql.join(Object.entries(columns).map(([key, column]) => sql`${column} as ${sql.identifier(key)}`), sql`, `);
}
function dataset(entity: ListEntity, userId: string) {
  if (entity === 'companies') return sql`select ${project(companyListColumns)}, ${userCompanies.isFavorite} as "isFavorite",
    (select count(*)::int from ${jobOffers} where ${jobOffers.companyId} = ${companies.id} and ${jobOffers.userId} = ${userId}) as "applicationCount",
    (select count(*)::int from ${companyNotes} where ${companyNotes.companyId} = ${companies.id} and ${companyNotes.userId} = ${userId}) as "noteCount"
    from ${userCompanies} inner join ${companies} on ${companies.id} = ${userCompanies.companyId} where ${userCompanies.userId} = ${userId}`;
  const { role: _role, ...columns } = personListColumns;
  return sql`select ${project(columns)}, coalesce(nullif(${people.role}, ''), ${people.headline}) as role,
    (select max(coalesce(${personMessages.sentAt}, ${personMessages.createdAt})) from ${personMessages} where ${personMessages.personId} = ${people.id} and ${personMessages.userId} = ${userId}) as "lastContactAt",
    (select string_agg(distinct ${companies.name}, ', ' order by ${companies.name}) from ${personCompanies} inner join ${companies} on ${companies.id} = ${personCompanies.companyId} where ${personCompanies.personId} = ${people.id} and ${personCompanies.userId} = ${userId}) as "companyNames"
    from ${people} where ${people.userId} = ${userId}`;
}
async function attachPageRelations(userId: string, entity: ListEntity, rows: CrmRow[]) {
  if (entity !== 'people' || !rows.length) return rows;
  const links = await db.execute<{ personId: string; id: string; name: string; iconHash: string | null }>(sql`select distinct ${personCompanies.personId} as "personId", ${companies.id} as id, ${companies.name} as name, ${companies.iconHash} as "iconHash" from ${personCompanies} inner join ${companies} on ${companies.id} = ${personCompanies.companyId} where ${personCompanies.userId} = ${userId} and ${personCompanies.personId} in (${sql.join(rows.map(row => sql`${row.id}::uuid`), sql`, `)}) order by name, id`);
  const byPerson = new Map<string, { id: string; name: string; iconHash: string | null }[]>();
  for (const link of links.rows) {
    const items = byPerson.get(link.personId) || [];
    items.push({ id: link.id, name: link.name, iconHash: link.iconHash });
    byPerson.set(link.personId, items);
  }
  return rows.map(row => ({ ...row, companies: byPerson.get(row.id) || [] }));
}
const column = (key: string) => sql`${sql.identifier('rows')}.${sql.identifier(key)}`;
function filterSql(entity: ListEntity, userId: string, f: CrmFilter, now: Date): SQL {
  const c = column(f.column), empty = sql`(${c} is null or ${c}::text = '')`;
  if (f.operator === 'isEmpty') return empty;
  if (f.operator === 'isNotEmpty') return sql`not ${empty}`;
  if (f.operator === 'in') {
    if (f.column === 'companyNames') return sql`exists (select 1 from ${personCompanies} where ${personCompanies.personId} = rows.id and ${personCompanies.userId} = ${userId} and ${personCompanies.companyId} in (${sql.join(f.values!.map(v => sql`${v}::uuid`), sql`, `)}))`;
    return sql`${c} in (${sql.join(f.values!.map(v => sql`${v}`), sql`, `)})`;
  }
  const kind = crmColumns(entity).find(d => d.id === f.column)!.kind;
  if (kind === 'date') {
    const range = columnDateRange(f as ApplicationColumnFilter, now), parts: SQL[] = [];
    if (range.start) parts.push(sql`${c} >= ${range.start}`);
    if (range.end) parts.push(sql`${c} < ${range.end}`);
    return parts.length ? sql.join(parts, sql` and `) : sql`false`;
  }
  if (kind === 'number') {
    const op: Record<string, SQL> = { eq: sql`=`, gt: sql`>`, gte: sql`>=`, lt: sql`<`, lte: sql`<=` };
    return sql`${c} ${op[f.operator]} ${Number(f.value)}`;
  }
  const pattern = `%${escapeIlikePattern(f.value)}%`;
  switch (f.operator) {
    case 'contains': return sql`${c} ilike ${pattern}`;
    case 'notContains': return sql`coalesce(${c}, '') not ilike ${pattern}`;
    case 'equals': return sql`lower(coalesce(${c}, '')) = ${f.value.toLowerCase()}`;
    case 'notEquals': return sql`lower(coalesce(${c}, '')) <> ${f.value.toLowerCase()}`;
    default: return sql`false`;
  }
}
function queryParts(entity: ListEntity, userId: string, input: CrmConfig, now: Date) {
  const config = normalizeCrmConfig(entity, input), conditions: SQL[] = [sql`true`];
  if (config.filters.favoritesOnly) conditions.push(sql`rows."isFavorite" = true`);
  if (config.filters.due) conditions.push(sql`rows."nextFollowupAt" <= ${now}`);
  if (config.filters.offerId) conditions.push(sql`exists (select 1 from ${personOffers} where ${personOffers.personId} = rows.id and ${personOffers.userId} = ${userId} and ${personOffers.offerId} = ${config.filters.offerId}::uuid)`);
  if (config.filters.search?.trim()) {
    const fields = entity === 'companies' ? ['name', 'location', 'sector'] : ['name', 'role'];
    const pattern = `%${escapeIlikePattern(config.filters.search.trim())}%`;
    conditions.push(sql`(${sql.join(fields.map(k => sql`${column(k)} ilike ${pattern}`), sql` or `)})`);
  }
  for (const f of config.filters.columnFilters || []) conditions.push(sql`(${filterSql(entity, userId, f, now)})`);
  const sortColumn = column(config.sort.key);
  return { config, base: dataset(entity, userId), where: sql.join(conditions, sql` and `), order: sql`${sortColumn} ${config.sort.direction === 'asc' ? sql`asc` : sql`desc`} nulls last, rows.id asc` };
}
export async function listCrmPage(userId: string, entity: ListEntity, input: CrmConfig, requestedPage = 1, now = new Date()): Promise<CrmPage> {
  const { config, base, where, order } = queryParts(entity, userId, input, now);
  const counts = await db.execute<{ total: number }>(sql`select count(*)::int as total from (${base}) as rows where ${where}`);
  const total = Number(counts.rows[0]?.total || 0), totalPages = Math.max(1, Math.ceil(total / config.pageSize));
  const page = Math.min(Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1), totalPages);
  const data = await db.execute<CrmRow>(sql`select rows.* from (${base}) as rows where ${where} order by ${order} limit ${config.pageSize} offset ${(page - 1) * config.pageSize}`);
  return { items: await attachPageRelations(userId, entity, data.rows), total, page, pageSize: config.pageSize, totalPages };
}
export async function listCrmIds(userId: string, entity: ListEntity, input: CrmConfig, limit = SELECT_ALL_ID_LIMIT): Promise<string[]> {
  const { base, where, order } = queryParts(entity, userId, input, new Date());
  const data = await db.execute<{ id: string }>(sql`select rows.id from (${base}) as rows where ${where} order by ${order} limit ${Math.min(limit, SELECT_ALL_ID_LIMIT)}`);
  return data.rows.map(r => r.id);
}
export async function listCrmSelected(userId: string, entity: ListEntity, ids: string[]): Promise<CrmRow[]> {
  if (!ids.length) return [];
  const base = dataset(entity, userId);
  const data = await db.execute<CrmRow>(sql`select rows.* from (${base}) as rows where rows.id in (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})`);
  return attachPageRelations(userId, entity, data.rows);
}
