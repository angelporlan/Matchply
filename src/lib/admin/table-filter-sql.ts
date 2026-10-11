import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { escapeIlikePattern } from '@/lib/application-filter-bounds';
import type { CrmColumn, CrmFilter } from '@/lib/crm-views';
import { adminDateBounds } from './table-filters';

export function adminColumnFilterSql(filter: CrmFilter, definitions: CrmColumn[], columns: Record<string, SQLWrapper>, now: Date): SQL {
  const column = columns[filter.column];
  const definition = definitions.find(item => item.id === filter.column);
  if (!column || !definition) return sql`false`;
  const empty = sql`(${column} is null or ${column}::text = '')`;
  if (filter.operator === 'isEmpty') return empty;
  if (filter.operator === 'isNotEmpty') return sql`not ${empty}`;
  if (filter.operator === 'in') return sql`${column} in (${sql.join((filter.values || []).map(value => sql`${value}`), sql`, `)})`;
  if (definition.kind === 'date') {
    const range = adminDateBounds(filter, now), parts: SQL[] = [];
    if (range.start) parts.push(sql`${column} >= ${range.start}`);
    if (range.end) parts.push(sql`${column} < ${range.end}`);
    return parts.length ? sql`(${sql.join(parts, sql` and `)})` : sql`false`;
  }
  const pattern = `%${escapeIlikePattern(filter.value)}%`;
  switch (filter.operator) {
    case 'contains': return sql`${column} ilike ${pattern}`;
    case 'notContains': return sql`coalesce(${column}, '') not ilike ${pattern}`;
    case 'equals': return sql`lower(coalesce(${column}, '')) = ${filter.value.toLowerCase()}`;
    case 'notEquals': return sql`lower(coalesce(${column}, '')) <> ${filter.value.toLowerCase()}`;
    default: return sql`false`;
  }
}
