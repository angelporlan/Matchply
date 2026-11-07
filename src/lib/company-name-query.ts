import { sql, type SQLWrapper } from 'drizzle-orm';
import { COMPANY_LEADING_SEPARATORS, COMPANY_NAME_MAX, LINKEDIN_CONTACT_INDICATOR } from './company-name';

/** Sanitize before filtering, sorting, counting and paginating legacy company rows. */
export function cleanCompanyName(column: SQLWrapper) {
  return sql<string>`trim(regexp_replace(trim(regexp_replace(regexp_replace(${column}, '[[:cntrl:]]', ' ', 'g'), ${String.raw`\s+`}, ' ', 'g')), ${COMPANY_LEADING_SEPARATORS}, ''))`;
}

export function validCompanyName(column: SQLWrapper) {
  const name = cleanCompanyName(column);
  return sql`(length(${name}) between 1 and ${COMPANY_NAME_MAX} and ${name} !~* ${LINKEDIN_CONTACT_INDICATOR})`;
}
