import { and, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiRequestUsage as usage, users } from '@/db/schema';

export const AI_USAGE_PAGE_SIZE = 25;
export type UsageReportFilters = { days: number; userId?: string; functionKey?: string; query?: string; userPage: number; requestPage: number };
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const pageNumber = (value: unknown) => typeof value === 'string' && /^\d{1,5}$/.test(value) ? Math.max(1, Math.min(10_000, Number(value))) : 1;
export function parseUsageReportFilters(params: Record<string, string | string[] | undefined>): UsageReportFilters {
  return {
    days: ['7', '30', '90'].includes(String(params.days)) ? Number(params.days) : 30,
    userId: typeof params.user === 'string' && uuid.test(params.user) ? params.user : undefined,
    functionKey: typeof params.function === 'string' && /^[a-z0-9_:-]{1,100}$/i.test(params.function) ? params.function : undefined,
    query: typeof params.q === 'string' ? params.q.trim().slice(0, 100) : undefined,
    userPage: pageNumber(params.usersPage), requestPage: pageNumber(params.requestsPage),
  };
}
const totals = {
  requests: sql<number>`count(*)::int`,
  failedRequests: sql<number>`count(*) filter (where not ${usage.success})::int`,
  inputReportedRequests: sql<number>`count(${usage.inputTokens})::int`,
  outputReportedRequests: sql<number>`count(${usage.outputTokens})::int`,
  inputTokens: sql<number>`coalesce(sum(${usage.inputTokens}), 0)::double precision`,
  outputTokens: sql<number>`coalesce(sum(${usage.outputTokens}), 0)::double precision`,
  cachedInputTokens: sql<number>`coalesce(sum(${usage.cachedInputTokens}), 0)::double precision`,
  reasoningTokens: sql<number>`coalesce(sum(${usage.reasoningTokens}), 0)::double precision`,
  webSearchCalls: sql<number>`coalesce(sum(${usage.webSearchCalls}), 0)::double precision`,
  missingTokens: sql<number>`count(*) filter (where ${usage.inputTokens} is null or (${usage.outputTokens} is null and ${usage.endpoint} <> 'decisions'))::int`,
  missingCost: sql<number>`count(*) filter (where ${usage.costUsd} is null)::int`,
  costUsd: sql<number>`coalesce(sum(${usage.costUsd}), 0)::double precision`,
  reportedCostUsd: sql<number>`coalesce(sum(${usage.costUsd}) filter (where ${usage.costSource} = 'reported'), 0)::double precision`,
  estimatedCostUsd: sql<number>`coalesce(sum(${usage.costUsd}) filter (where ${usage.costSource} = 'estimated'), 0)::double precision`,
};
export type UsageTotals = { [K in keyof typeof totals]: number };

/** Admin-only caller. Aggregation happens in SQL; recent requests and users are paginated. */
export async function loadAiUsageReport(filters: UsageReportFilters, now = new Date()) {
  const since = new Date(now.getTime() - filters.days * 86_400_000);
  const period = and(gte(usage.createdAt, since), lt(usage.createdAt, now));
  const where = and(period, filters.userId ? eq(usage.userId, filters.userId) : undefined, filters.functionKey ? eq(usage.functionKey, filters.functionKey) : undefined);
  const query = filters.query?.replace(/[\\%_]/g, '\\$&');
  const userWhere = and(where, query ? or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`)) : undefined);
  const [summary, functions, userRows, userCount, recent, selectedUser, availableFunctions] = await Promise.all([
    db.select(totals).from(usage).where(where),
    db.select({ functionKey: usage.functionKey, ...totals }).from(usage).where(where)
      .groupBy(usage.functionKey).orderBy(sql`sum(${usage.costUsd}) desc nulls last`, usage.functionKey),
    db.select({ userId: usage.userId, name: users.name, email: users.email, ...totals }).from(usage)
      .leftJoin(users, eq(users.id, usage.userId)).where(userWhere).groupBy(usage.userId, users.name, users.email)
      .orderBy(sql`sum(${usage.costUsd}) desc nulls last`, desc(sql`count(*)`), usage.userId)
      .limit(AI_USAGE_PAGE_SIZE).offset((filters.userPage - 1) * AI_USAGE_PAGE_SIZE),
    db.select({ count: sql<number>`count(distinct coalesce(${usage.userId}::text, 'unattributed'))::int` }).from(usage)
      .leftJoin(users, eq(users.id, usage.userId)).where(userWhere),
    db.select({ id: usage.id, userId: usage.userId, email: users.email, functionKey: usage.functionKey, provider: usage.provider,
      model: usage.model, endpoint: usage.endpoint, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens, reasoningTokens: usage.reasoningTokens, webSearchCalls: usage.webSearchCalls,
      costUsd: usage.costUsd, costSource: usage.costSource, pricing: usage.pricing, success: usage.success, errorCode: usage.errorCode,
      latencyMs: usage.latencyMs, createdAt: usage.createdAt,
    }).from(usage).leftJoin(users, eq(users.id, usage.userId)).where(where).orderBy(desc(usage.createdAt), desc(usage.id))
      .limit(AI_USAGE_PAGE_SIZE).offset((filters.requestPage - 1) * AI_USAGE_PAGE_SIZE),
    filters.userId ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, filters.userId)).limit(1) : Promise.resolve([]),
    db.selectDistinct({ functionKey: usage.functionKey }).from(usage).where(period).orderBy(usage.functionKey),
  ]);
  return { since, until: now, totals: summary[0], functions, users: userRows, userCount: userCount[0].count, recent,
    selectedUser: selectedUser[0] ?? null, availableFunctions, requestCount: summary[0].requests };
}
