export type PlanLimits = {
  maxCvs: number | null; maxBaseCvs: number | null; maxAdaptedCvs: number | null;
  generalAiMonthly: number; matchingMonthly: number; researchMonthly: number;
  matchBatchSize: number; apiKeys: number; apiRequestsPerMinute: number;
};
export type PaywallCopy = { title: string; body: string; cta: string };
export type PlanConfig = {
  version: number; free: PlanLimits; pro: PlanLimits; guest: PlanLimits;
  paywall: { experimentVersion: number; mode: 'ab' | 'a' | 'b' | 'paused'; copy: Record<'a' | 'b', Record<'es' | 'en', PaywallCopy>> };
};
export function defaultPlanConfig(): PlanConfig {
  const free: PlanLimits = { maxCvs: 3, maxBaseCvs: 1, maxAdaptedCvs: 2, generalAiMonthly: 10, matchingMonthly: 10, researchMonthly: 0, matchBatchSize: 1, apiKeys: 0, apiRequestsPerMinute: 0 };
  return { version: 1, free, guest: { ...free }, pro: { maxCvs: null, maxBaseCvs: null, maxAdaptedCvs: null, generalAiMonthly: 200, matchingMonthly: 300, researchMonthly: 10, matchBatchSize: 50, apiKeys: 3, apiRequestsPerMinute: 60 }, paywall: { experimentVersion: 1, mode: 'ab', copy: {
    a: { es: { title: 'Tu primer CV adaptado ya está listo', body: 'Conserva esta candidatura y prepara la siguiente. Con PRO puedes guardar {maxCvs} CVs y utilizar {generalAiMonthly} acciones de IA al mes.', cta: 'Probar PRO 7 días' }, en: { title: 'Your first tailored resume is ready', body: 'Keep this application and prepare the next. With PRO, save {maxCvs} resumes and use {generalAiMonthly} AI actions per month.', cta: 'Try PRO for 7 days' } },
    b: { es: { title: 'Avanza con más candidaturas', body: 'PRO incluye {matchingMonthly} matching al mes, análisis en lote y {researchMonthly} investigaciones profundas.', cta: 'Probar PRO 7 días' }, en: { title: 'Move forward with more applications', body: 'PRO includes {matchingMonthly} matches per month, batch analysis and {researchMonthly} deep research reports.', cta: 'Try PRO for 7 days' } },
  } } };
}
function integer(value: unknown, label: string, min = 0) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > 1_000_000) throw new Error(`Invalid ${label}`);
  return value;
}
function parseLimits(value: unknown, label: string): PlanLimits {
  if (!value || typeof value !== 'object') throw new Error(`Invalid ${label}`);
  const row = value as Record<string, unknown>;
  const cap = (key: string) => row[key] === null ? null : integer(row[key], `${label}.${key}`);
  const limits: PlanLimits = { maxCvs: cap('maxCvs'), maxBaseCvs: cap('maxBaseCvs'), maxAdaptedCvs: cap('maxAdaptedCvs'), generalAiMonthly: integer(row.generalAiMonthly, `${label}.generalAiMonthly`), matchingMonthly: integer(row.matchingMonthly, `${label}.matchingMonthly`), researchMonthly: integer(row.researchMonthly, `${label}.researchMonthly`), matchBatchSize: integer(row.matchBatchSize, `${label}.matchBatchSize`), apiKeys: integer(row.apiKeys, `${label}.apiKeys`), apiRequestsPerMinute: integer(row.apiRequestsPerMinute, `${label}.apiRequestsPerMinute`) };
  if (limits.matchBatchSize > limits.matchingMonthly) throw new Error(`${label}: batch exceeds monthly matching limit`);
  if ((limits.apiKeys === 0) !== (limits.apiRequestsPerMinute === 0)) throw new Error(`${label}: API keys and requests must both be enabled or disabled`);
  if (limits.maxCvs !== null && limits.maxBaseCvs !== null && limits.maxAdaptedCvs !== null && limits.maxBaseCvs + limits.maxAdaptedCvs > limits.maxCvs) throw new Error(`${label}: CV categories exceed total capacity`);
  return limits;
}
export function parsePlanConfig(value: unknown): PlanConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid plan configuration');
  const row = value as PlanConfig;
  if (!row.paywall || !['ab', 'a', 'b', 'paused'].includes(row.paywall.mode)) throw new Error('Invalid paywall mode');
  const copy = {} as PlanConfig['paywall']['copy'];
  for (const variant of ['a', 'b'] as const) {
    copy[variant] = {} as Record<'es' | 'en', PaywallCopy>;
    for (const locale of ['es', 'en'] as const) {
      const source = row.paywall.copy?.[variant]?.[locale];
      if (!source) throw new Error('Missing paywall translation');
      const parsed = {} as PaywallCopy;
      for (const key of ['title', 'body', 'cta'] as const) {
        const text = source[key];
        if (typeof text !== 'string' || !text.trim() || text.length > (key === 'body' ? 1000 : 160) || /[<>]/.test(text)) throw new Error(`Invalid paywall ${variant}.${locale}.${key}`);
        const variables = text.match(/\{[^}]+\}/g) || [];
        if (variables.some(item => !['{generalAiMonthly}', '{matchingMonthly}', '{researchMonthly}', '{maxCvs}', '{monthlyPrice}', '{annualPrice}'].includes(item))) throw new Error('Invalid paywall variable');
        parsed[key] = text.trim();
      }
      copy[variant][locale] = parsed;
    }
  }
  return { version: integer(row.version, 'version', 1), free: parseLimits(row.free, 'free'), pro: parseLimits(row.pro, 'pro'), guest: parseLimits(row.guest, 'guest'), paywall: { experimentVersion: integer(row.paywall.experimentVersion, 'experimentVersion', 1), mode: row.paywall.mode, copy } };
}
export function renderPaywallCopy(copy: PaywallCopy, limits: PlanLimits, prices: { monthlyPrice?: string; annualPrice?: string } = {}): PaywallCopy {
  const values: Record<string, string> = { generalAiMonthly: String(limits.generalAiMonthly), matchingMonthly: String(limits.matchingMonthly), researchMonthly: String(limits.researchMonthly), maxCvs: limits.maxCvs === null ? '∞' : String(limits.maxCvs), monthlyPrice: prices.monthlyPrice ?? '10 €', annualPrice: prices.annualPrice ?? '96 €' };
  const render = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
  return { title: render(copy.title), body: render(copy.body), cta: render(copy.cta) };
}
