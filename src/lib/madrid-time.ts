const MADRID_TZ = 'Europe/Madrid';

const madridDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: MADRID_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const madridOffsetParts = new Intl.DateTimeFormat('en-US', {
  timeZone: MADRID_TZ,
  timeZoneName: 'shortOffset',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type DateRange = { start: Date; end: Date };

function partsMap(formatted: Intl.DateTimeFormatPart[]) {
  const map: Record<string, string> = {};
  for (const part of formatted) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return map;
}

export function madridYmd(date: Date): string {
  return madridDateParts.format(date);
}

function offsetMsAt(date: Date): number {
  const map = partsMap(madridOffsetParts.formatToParts(date));
  const match = (map.timeZoneName || 'GMT+0').match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes) * 60_000;
}

/** Instant for a civil datetime in Europe/Madrid, including DST transitions. */
export function madridLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = new Date(utcGuess - offsetMsAt(new Date(utcGuess)));
  return new Date(utcGuess - offsetMsAt(first));
}

export function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function madridDayRange(ymd: string): DateRange | null {
  const parsed = parseYmd(ymd);
  if (!parsed) return null;
  const start = madridLocalToUtc(parsed.year, parsed.month, parsed.day);
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1));
  const end = madridLocalToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return { start, end };
}

export function madridRollingRange(days: number, now = new Date()): DateRange {
  const today = madridYmd(now);
  const parsed = parseYmd(today)!;
  const startUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day - (days - 1));
  const startDate = new Date(startUtc);
  const start = madridLocalToUtc(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate());
  const tomorrow = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1));
  const end = madridLocalToUtc(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate());
  return { start, end };
}

export function madridCustomRange(fromYmd: string, toYmd: string): DateRange | null {
  const from = madridDayRange(fromYmd);
  const to = madridDayRange(toYmd);
  if (!from || !to) return null;
  if (from.start >= to.end) return null;
  return { start: from.start, end: to.end };
}

export type CreatedPreset = 'today' | '7d' | '30d' | 'custom';

export function resolveMadridCreatedRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}): DateRange | null {
  const now = input.now ?? new Date();
  if (input.preset === 'today') return madridDayRange(madridYmd(now));
  if (input.preset === '7d') return madridRollingRange(7, now);
  if (input.preset === '30d') return madridRollingRange(30, now);
  if (input.preset === 'custom' && input.from && input.to) {
    return madridCustomRange(input.from, input.to);
  }
  return null;
}
