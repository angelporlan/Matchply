/** Postulaciones and notes are whole counts, not text. */

export const COMPANY_COUNT_COLUMNS = ['applicationCount', 'noteCount'] as const;

export type CompanyCountColumn = (typeof COMPANY_COUNT_COLUMNS)[number];

export const COMPANY_COUNT_OPERATORS = ['eq', 'gt', 'gte', 'lt', 'lte'] as const;

export type CompanyCountOperator = (typeof COMPANY_COUNT_OPERATORS)[number];

export function isCompanyCountColumn(column: string): column is CompanyCountColumn {
  return column === 'applicationCount' || column === 'noteCount';
}

export function isCompanyCountOperator(operator: string): operator is CompanyCountOperator {
  return (COMPANY_COUNT_OPERATORS as readonly string[]).includes(operator);
}

/** Non-negative integers only. "01" is 1. Decimals, signs and blanks are rejected. */
export function parseCompanyCount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const count = Number(trimmed);
  return Number.isSafeInteger(count) ? count : null;
}

export function companyCountMatches(count: number, operator: string, raw: string): boolean {
  const target = parseCompanyCount(raw);
  const normalized = operator === 'equals' ? 'eq' : operator;
  if (target == null || !isCompanyCountOperator(normalized)) return false;
  switch (normalized) {
    case 'eq':
      return count === target;
    case 'gt':
      return count > target;
    case 'gte':
      return count >= target;
    case 'lt':
      return count < target;
    case 'lte':
      return count <= target;
    default:
      return false;
  }
}
