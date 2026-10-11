import { AsyncLocalStorage } from 'node:async_hooks';

export type AiUsageContext = { userId?: string; jobId?: string; functionKey: string };
const context = new AsyncLocalStorage<AiUsageContext>();

export function getAiUsageContext() { return context.getStore(); }
export function withAiUsageContext<T>(value: Partial<AiUsageContext> & Pick<AiUsageContext, 'functionKey'>, fn: () => T): T {
  return context.run({ ...context.getStore(), ...value }, fn);
}
