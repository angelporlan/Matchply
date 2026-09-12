export function timeAgo(date: Date | string, language: 'es' | 'en'): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const locale = language === 'es' ? 'es' : 'en';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const diffMs = value.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');

  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, 'month');

  return rtf.format(Math.round(months / 12), 'year');
}
