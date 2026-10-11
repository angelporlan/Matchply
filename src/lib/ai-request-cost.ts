export type TokenUsage = {
  inputTokens: number | null; outputTokens: number | null;
  cachedInputTokens: number | null; cacheWriteTokens: number | null; reasoningTokens: number | null;
  reportedCostUsd: number | null; webSearchCalls: number;
};
export type TokenPrices = {
  input: number; output: number; cachedInput: number; cacheWrite?: number;
  longContextAbove?: number; longInputMultiplier?: number; longOutputMultiplier?: number;
  source: string; verifiedAt: string;
};
export const PRICING_VERIFIED_AT = '2026-10-11';
const OPENAI_PRICING = 'https://developers.openai.com/api/docs/pricing';
const GEMINI_PRICING = 'https://ai.google.dev/gemini-api/docs/pricing';
// USD per million tokens, standard processing, text only. Save the tariff with
// each request so future price changes never recalculate historical spending.
const PRICES: Record<string, TokenPrices> = {
  'openai:gpt-6-luna': { input: .1, output: .5, cachedInput: .01, cacheWrite: .125, longContextAbove: 272_000, longInputMultiplier: 2, longOutputMultiplier: 1.5, source: OPENAI_PRICING, verifiedAt: PRICING_VERIFIED_AT },
  'openai:gpt-6.1-sol': { input: 2, output: 10, cachedInput: .1, cacheWrite: 2.5, longContextAbove: 272_000, longInputMultiplier: 2, longOutputMultiplier: 1.5, source: OPENAI_PRICING, verifiedAt: PRICING_VERIFIED_AT },
  'openai:gpt-6-astra': { input: 10, output: 50, cachedInput: 1, cacheWrite: 12.5, longContextAbove: 272_000, longInputMultiplier: 2, longOutputMultiplier: 1.5, source: OPENAI_PRICING, verifiedAt: PRICING_VERIFIED_AT },
  'openai:gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25, source: 'https://developers.openai.com/api/docs/models/gpt-4o', verifiedAt: PRICING_VERIFIED_AT },
  'openai:gpt-4o-mini': { input: .15, output: .6, cachedInput: .075, source: 'https://developers.openai.com/api/docs/models/gpt-4o-mini', verifiedAt: PRICING_VERIFIED_AT },
  'gemini:gemini-3.5-flash-lite': { input: .3, output: 2.5, cachedInput: .03, source: GEMINI_PRICING, verifiedAt: PRICING_VERIFIED_AT },
  'gemini:gemini-2.5-flash-lite': { input: .1, output: .4, cachedInput: .01, source: GEMINI_PRICING, verifiedAt: PRICING_VERIFIED_AT },
  'gemini:gemini-2.5-flash': { input: .3, output: 2.5, cachedInput: .03, source: GEMINI_PRICING, verifiedAt: PRICING_VERIFIED_AT },
  'gemini:gemini-2.5-pro': { input: 1.25, output: 10, cachedInput: .125, longContextAbove: 200_000, longInputMultiplier: 2, longOutputMultiplier: 1.5, source: GEMINI_PRICING, verifiedAt: PRICING_VERIFIED_AT },
};
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};
const tokens = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : null;

export function readTokenUsage(payload: unknown): TokenUsage {
  const data = object(payload); const u = object(data.usage); const g = object(data.usageMetadata);
  const inputTokens = tokens(u.input_tokens ?? u.prompt_tokens ?? g.promptTokenCount);
  const reasoningTokens = tokens(u.output_tokens_details?.reasoning_tokens ?? u.completion_tokens_details?.reasoning_tokens ?? g.thoughtsTokenCount);
  const candidates = tokens(g.candidatesTokenCount);
  // OpenAI/OpenRouter already include reasoning in output. Gemini reports it separately.
  const outputTokens = tokens(u.output_tokens ?? u.completion_tokens ?? (candidates === null ? undefined : candidates + (reasoningTokens ?? 0)));
  return {
    inputTokens, outputTokens, reasoningTokens,
    cachedInputTokens: tokens(u.input_tokens_details?.cached_tokens ?? u.prompt_tokens_details?.cached_tokens ?? u.prompt_cache_hit_tokens ?? g.cachedContentTokenCount),
    cacheWriteTokens: tokens(u.input_tokens_details?.cache_write_tokens ?? u.prompt_tokens_details?.cache_write_tokens),
    reportedCostUsd: typeof u.cost === 'number' && Number.isFinite(u.cost) && u.cost >= 0 ? u.cost : null,
    webSearchCalls: Array.isArray(data.output) ? data.output.filter((item: any) => item?.type === 'web_search_call').length : 0,
  };
}

export function calculateRequestCost(provider: string, model: string, endpoint: string, usage: TokenUsage, tier = 'default', overrides: Record<string, TokenPrices> = {}) {
  const unknown = (reason: string) => ({ costUsd: null, costSource: 'unknown' as const, pricing: { reason } });
  if (provider === 'openrouter' && usage.reportedCostUsd !== null) {
    return { costUsd: usage.reportedCostUsd, costSource: 'reported' as const, pricing: { source: 'provider_usage' } };
  }
  if (usage.inputTokens === null) return unknown('usage_not_reported');
  // A dated snapshot may have a different price (e.g. early GPT-4o versions).
  // Require its exact tariff rather than silently pricing it as the current alias.
  const canonical = model;
  const prices = overrides[`${provider}:${model}`] ?? PRICES[`${provider}:${canonical}`];
  if (!prices) return unknown('model_price_unavailable');
  if (!['default', 'auto', 'standard', 'flex', 'priority', 'fast'].includes(tier)) return unknown('service_tier_unavailable');
  if (provider === 'openai' && ['priority', 'fast', 'flex'].includes(tier) && !canonical.startsWith('gpt-6')) return unknown('service_tier_price_unavailable');
  const longContext = prices.longContextAbove !== undefined && usage.inputTokens > prices.longContextAbove;
  const inputMultiplier = longContext ? prices.longInputMultiplier ?? 1 : 1;
  const outputMultiplier = longContext ? prices.longOutputMultiplier ?? 1 : 1;
  const tierMultiplier = provider === 'openai' ? (tier === 'flex' ? .5 : ['priority', 'fast'].includes(tier) ? 2 : 1) : 1;
  // Decisions has a separate input-only tariff: no cache or output surcharges.
  if (provider === 'openai' && endpoint === 'decisions') {
    if (canonical !== 'gpt-6-luna') return unknown('decisions_price_unavailable');
    return { costUsd: usage.inputTokens * prices.input * inputMultiplier / 1_000_000, costSource: 'estimated' as const,
      pricing: { ...prices, source: 'https://developers.openai.com/api/docs/guides/decisions', endpoint, inputMultiplier, output: 0, cachedInput: 0, cacheWrite: 0 } };
  }
  if (usage.outputTokens === null) return unknown('usage_incomplete');
  if (provider === 'openai' && usage.webSearchCalls > 0 && ['gpt-4o-mini', 'gpt-4.1-mini'].includes(canonical)) return unknown('web_search_content_price_unavailable');
  const cached = usage.cachedInputTokens ?? 0; const written = usage.cacheWriteTokens ?? 0;
  if (cached + written > usage.inputTokens || (written > 0 && prices.cacheWrite == null)) return unknown('cache_usage_unavailable');
  const tokenCost = ((usage.inputTokens - cached - written) * prices.input + cached * prices.cachedInput + written * (prices.cacheWrite ?? 0)) * inputMultiplier
    + usage.outputTokens * prices.output * outputMultiplier;
  const webCost = provider === 'openai' ? usage.webSearchCalls * .01 : 0;
  return { costUsd: tokenCost * tierMultiplier / 1_000_000 + webCost, costSource: 'estimated' as const,
    pricing: { ...prices, inputMultiplier, outputMultiplier, tier, tierMultiplier, webSearchUsdPerCall: provider === 'openai' ? .01 : 0 } };
}
