import { fetchWithTimeout } from '@/lib/http';
import { isUmamiAdminEnabled } from '@/lib/flags';
import { UMAMI_CONVERSION_EVENTS } from '@/lib/umami';

export type UmamiPeriod = '24h' | '7d' | '30d' | '12m';

function websiteId() {
  return process.env.UMAMI_WEBSITE_ID || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || '';
}

function periodMs(period: UmamiPeriod) {
  if (period === '24h') return 24 * 3600_000;
  if (period === '7d') return 7 * 24 * 3600_000;
  if (period === '30d') return 30 * 24 * 3600_000;
  return 365 * 24 * 3600_000;
}

function authHeaders() {
  return { Authorization: `Bearer ${process.env.UMAMI_API_TOKEN}`, Accept: 'application/json' };
}

async function fetchJson(url: URL) {
  const res = await fetchWithTimeout(url.toString(), { headers: authHeaders() }, 12_000);
  if (!res.ok) throw new Error(`Umami respondió ${res.status}.`);
  return res.json();
}

function metricList(raw: unknown): Array<{ x: string; y: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as { x?: string; y?: number };
      return { x: String(row.x || ''), y: Number(row.y || 0) };
    })
    .filter((item) => item.x)
    .slice(0, 8);
}

function statValue(stats: any, key: 'visitors' | 'pageviews' | 'bounces' | 'totaltime') {
  const value = stats?.[key]?.value ?? stats?.[key] ?? stats?.[key === 'visitors' ? 'uniques' : key];
  return typeof value === 'number' ? value : null;
}

export async function fetchUmamiSummary(period: UmamiPeriod = '7d') {
  if (!isUmamiAdminEnabled()) {
    return { ok: false as const, error: 'Umami no está configurado en el servidor.' };
  }
  const unit = period === '24h' ? 'hour' : 'day';
  const span = periodMs(period);
  const endAt = Date.now();
  const startAt = endAt - span;
  const prevEnd = startAt;
  const prevStart = prevEnd - span;
  const base = process.env.UMAMI_API_URL!;
  const id = websiteId();

  const statsUrl = (from: number, to: number) => {
    const url = new URL(`/api/websites/${id}/stats`, base);
    url.searchParams.set('startAt', String(from));
    url.searchParams.set('endAt', String(to));
    url.searchParams.set('unit', unit);
    return url;
  };
  const metricsUrl = (type: string) => {
    const url = new URL(`/api/websites/${id}/metrics`, base);
    url.searchParams.set('startAt', String(startAt));
    url.searchParams.set('endAt', String(endAt));
    url.searchParams.set('type', type);
    return url;
  };

  try {
    const [stats, previous, referrers, devices, events] = await Promise.all([
      fetchJson(statsUrl(startAt, endAt)),
      fetchJson(statsUrl(prevStart, prevEnd)).catch(() => null),
      fetchJson(metricsUrl('referrer')).catch(() => []),
      fetchJson(metricsUrl('device')).catch(() => []),
      fetchJson(metricsUrl('event')).catch(() => []),
    ]);
    const conversions = metricList(events).filter((item) =>
      (UMAMI_CONVERSION_EVENTS as readonly string[]).includes(item.x),
    );
    return {
      ok: true as const,
      period,
      stats: {
        visitors: statValue(stats, 'visitors'),
        pageviews: statValue(stats, 'pageviews'),
      },
      previous: previous ? {
        visitors: statValue(previous, 'visitors'),
        pageviews: statValue(previous, 'pageviews'),
      } : null,
      referrers: metricList(referrers),
      devices: metricList(devices),
      conversions,
    };
  } catch (error: any) {
    return { ok: false as const, error: error.message || 'No se pudo consultar Umami.' };
  }
}
