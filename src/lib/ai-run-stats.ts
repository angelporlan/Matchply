import { db } from '@/db';
import { aiRunStats } from '@/db/schema';
import { log } from '@/lib/logger';

export function recordAiRunStat(input: {
  functionKey: string;
  provider: string;
  model: string;
  plan: string;
  success: boolean;
  latencyMs?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  errorCode?: string | null;
}) {
  void db.insert(aiRunStats).values({
    functionKey: input.functionKey,
    provider: input.provider,
    model: input.model,
    plan: input.plan,
    success: input.success,
    latencyMs: input.latencyMs ?? null,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    estimatedCostUsd: input.estimatedCostUsd ?? null,
    errorCode: input.errorCode ?? null,
  }).catch((error) => {
    log({ event: 'ai_run_stat_failed', level: 'warn', error });
  });
}
