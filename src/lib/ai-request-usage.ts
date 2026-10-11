import { db } from '@/db';
import { aiRequestUsage } from '@/db/schema';
import { log } from '@/lib/logger';
import { calculateRequestCost, type TokenPrices, type TokenUsage } from './ai-request-cost';
import type { AiUsageContext } from './ai-usage-context';

export type AiRequestMetric = AiUsageContext & TokenUsage & {
  provider: string; model: string; endpoint: string; providerRequestId?: string;
  success: boolean; latencyMs: number; errorCode?: string; serviceTier?: string;
};
const pending = new Set<Promise<unknown>>();
function customPrices(): Record<string, TokenPrices> {
  try {
    const data = JSON.parse(process.env.AI_USAGE_PRICING_JSON || '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, value]) => {
      const p = value as TokenPrices;
      return p && [p.input, p.output, p.cachedInput].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
        && (p.cacheWrite === undefined || (Number.isFinite(p.cacheWrite) && p.cacheWrite >= 0))
        && (p.longContextAbove === undefined || (Number.isSafeInteger(p.longContextAbove) && p.longContextAbove > 0))
        && [p.longInputMultiplier, p.longOutputMultiplier].every(n => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n > 0))
        && typeof p.source === 'string' && typeof p.verifiedAt === 'string';
    })) as Record<string, TokenPrices>;
  } catch { return {}; }
}
export function recordAiRequestUsage(input: AiRequestMetric) {
  const cost = calculateRequestCost(input.provider, input.model, input.endpoint, input, input.serviceTier, customPrices());
  const promise = db.insert(aiRequestUsage).values({
    userId: input.userId ?? null, jobId: input.jobId ?? null, functionKey: input.functionKey.slice(0, 100),
    provider: input.provider, model: input.model.slice(0, 200), endpoint: input.endpoint,
    providerRequestId: input.providerRequestId?.slice(0, 200) ?? null,
    success: input.success, latencyMs: Math.min(input.latencyMs, 2_147_483_647),
    inputTokens: input.inputTokens, outputTokens: input.outputTokens, cachedInputTokens: input.cachedInputTokens,
    cacheWriteTokens: input.cacheWriteTokens, reasoningTokens: input.reasoningTokens, webSearchCalls: input.webSearchCalls,
    costUsd: cost.costUsd === null ? null : cost.costUsd.toFixed(10), costSource: cost.costSource, pricing: cost.pricing,
    errorCode: input.errorCode ?? null,
  }).catch(error => log({ event: 'ai_request_usage_failed', level: 'warn', error }));
  pending.add(promise); void promise.finally(() => pending.delete(promise));
}
/** Workers/tests can drain metrics at shutdown without blocking the AI request. */
export async function flushAiRequestUsage() { await Promise.all(Array.from(pending)); }
