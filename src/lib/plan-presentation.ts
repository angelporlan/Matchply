export type PlanLimitsView = {
  maxCvs: number | null;
  maxBaseCvs: number | null;
  maxAdaptedCvs: number | null;
  generalAiMonthly: number;
  matchingMonthly: number;
  researchMonthly: number;
  matchBatchSize: number;
  apiKeys: number;
  apiRequestsPerMinute: number;
};

export type QuotaBucketView = {
  used: number;
  reserved: number;
  limit: number;
  remaining: number;
  resetAt: string | null;
};

export type PlanUsageSnapshot = {
  plan: 'guest' | 'free' | 'pro';
  configVersion: number;
  limits: PlanLimitsView;
  usage: { general: QuotaBucketView; matching: QuotaBucketView; research: QuotaBucketView };
  cv: { total: number; max: number | null; activeIds: string[]; readOnlyIds: string[]; baseCvId?: string | null; cvs?: Array<{ id: string; title: string; isBase: boolean }> };
  trial?: { eligible?: boolean; active?: boolean; endAt?: string | null };
  firstValueAt?: string | null;
};

export type PlanRestriction = { code: string; bucket?: 'general' | 'matching' | 'research'; source: string; kind: 'quota' | 'rate' | 'progress'; limit?: number };

export function quotaState(bucket: QuotaBucketView): 'available' | 'warning' | 'exhausted' {
  if (bucket.remaining <= 0) return 'exhausted';
  return bucket.limit > 0 && (bucket.used + bucket.reserved) / bucket.limit >= 0.8 ? 'warning' : 'available';
}

/** Unknown placeholders stay visible in admin previews instead of inventing values. */
export function interpolatePlanCopy(copy: string, values: Record<string, string | number | null | undefined>) {
  return copy.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, key: string) => {
    const value = values[key];
    return value == null ? placeholder : String(value);
  });
}

export function getPlanRestriction(value: unknown, source: string): PlanRestriction | null {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nested = candidate.error && typeof candidate.error === 'object' ? candidate.error as Record<string, unknown> : {};
  const code = String(candidate.code || nested.code || candidate.error || value || '').toUpperCase();
  const kind = /(RATE_LIMITED|TOO_MANY_REQUESTS)/.test(code) ? 'rate' : code === 'OPERATION_IN_PROGRESS' ? 'progress' : 'quota';
  if (!/(QUOTA_EXCEEDED|QUOTA_EXHAUSTED|PLAN_REQUIRED|PRO_REQUIRED|SUBSCRIPTION_REQUIRED|CV_LIMIT|CV_READ_ONLY|API_KEY_LIMIT|TOO_MANY_KEYS|BATCH_LIMIT|MATCH_BATCH_TOO_LARGE|RATE_LIMITED|TOO_MANY_REQUESTS|OPERATION_IN_PROGRESS)/.test(code)) return null;
  const rawBucket = candidate.bucket || nested.bucket;
  const bucket = rawBucket === 'general' || rawBucket === 'matching' || rawBucket === 'research' ? rawBucket : undefined;
  const limit = candidate.limit ?? nested.limit;
  return { code, bucket, source, kind, ...(typeof limit === 'number' ? { limit } : {}) };
}

export function reportPlanRestriction(value: unknown, source: string) {
  const restriction = getPlanRestriction(value, source);
  if (!restriction || typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent('matchply:plan-restriction', { detail: restriction }));
  return true;
}

export function refreshPlanUsage() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('matchply:usage-refresh'));
}

export function nextPlanTabIndex(key: string, current: number): number | null {
  if (key === 'ArrowRight') return (current + 1) % 3;
  if (key === 'ArrowLeft') return (current + 2) % 3;
  if (key === 'Home') return 0;
  if (key === 'End') return 2;
  return null;
}
