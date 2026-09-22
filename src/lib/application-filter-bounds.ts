import type { ApplicationColumnFilter, ApplicationViewFilters } from '@/lib/application-views';

function dayStart(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function escapeIlikePattern(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function dateFilterRange(filters: ApplicationViewFilters, now: Date) {
  const dateFilter = filters.date || 'all';
  if (dateFilter === 'all') return { start: undefined as Date | undefined, end: undefined as Date | undefined };
  const today = dayStart(now);
  if (dateFilter === 'today') {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { start: today, end };
  }
  if (dateFilter === '7days') {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  const start = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : undefined;
  const end = filters.endDate ? new Date(`${filters.endDate}T00:00:00`) : undefined;
  if (end && !Number.isNaN(end.valueOf())) end.setDate(end.getDate() + 1);
  return {
    start: start && !Number.isNaN(start.valueOf()) ? start : undefined,
    end: end && !Number.isNaN(end.valueOf()) ? end : undefined,
  };
}

export function columnDateRange(filter: ApplicationColumnFilter, now: Date) {
  const today = dayStart(now);
  if (filter.operator === 'today') {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { start: today, end };
  }
  if (filter.operator === 'last3Days' || filter.operator === 'last7Days') {
    const days = filter.operator === 'last3Days' ? 3 : 7;
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (filter.operator === 'customRange') {
    const start = filter.startDate ? new Date(`${filter.startDate}T00:00:00`) : undefined;
    const end = filter.endDate ? new Date(`${filter.endDate}T00:00:00`) : undefined;
    if (end && !Number.isNaN(end.valueOf())) end.setDate(end.getDate() + 1);
    return {
      start: start && !Number.isNaN(start.valueOf()) ? start : undefined,
      end: end && !Number.isNaN(end.valueOf()) ? end : undefined,
    };
  }
  return { start: undefined as Date | undefined, end: undefined as Date | undefined };
}

export function scoreFilterRange(filter: ApplicationColumnFilter) {
  switch (filter.operator) {
    case 'gte90':
      return { min: 90, max: undefined as number | undefined };
    case 'gte80':
      return { min: 80, max: undefined };
    case 'gte75':
      return { min: 75, max: undefined };
    case 'gte60':
      return { min: 60, max: undefined };
    case 'gte50':
      return { min: 50, max: undefined };
    case 'scoreRange':
      return { min: filter.minScore, max: filter.maxScore };
    default:
      return { min: undefined as number | undefined, max: undefined as number | undefined };
  }
}

export const EXPORT_OFFER_ID_LIMIT = 1_000;
export const SELECT_ALL_ID_LIMIT = 10_000;
export const BOARD_COLUMN_PAGE_SIZE = 50;

export type ApplicationStatusCounts = Record<
  'all' | 'interested' | 'applied' | 'interview' | 'offer' | 'rejected' | 'archived',
  number
>;

export function emptyStatusCounts(): ApplicationStatusCounts {
  return {
    all: 0,
    interested: 0,
    applied: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    archived: 0,
  };
}
