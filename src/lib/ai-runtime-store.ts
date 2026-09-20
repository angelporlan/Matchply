import { AsyncLocalStorage } from 'async_hooks';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { aiRuntimeConfigs, settings } from '@/db/schema';
import {
  defaultAiRuntimeConfig,
  parseAiRuntimeConfig,
  resolveModelForFunction,
  type AiFunctionKey,
  type AiPlan,
  type AiRuntimeConfig,
} from '@/lib/ai-runtime-config';
import { getAiSetting, clearAiSettingsCache } from '@/lib/ai-settings';
import {
  DEFAULT_FREE_MODEL,
  DEFAULT_FREE_PROVIDER,
  DEFAULT_PRO_MODEL,
  DEFAULT_PRO_PROVIDER,
  getDefaultModelForProvider,
  type AiProvider,
} from '@/lib/models';

const TTL_MS = 60_000;
const als = new AsyncLocalStorage<AiRuntimeConfig>();

let memory: { value: AiRuntimeConfig; rowVersion: number; expiresAt: number } | null = null;

async function loadLegacyConfig(): Promise<AiRuntimeConfig> {
  const fallback = defaultAiRuntimeConfig();
  const [freeProvider, proProvider] = await Promise.all([
    getAiSetting('free_provider', DEFAULT_FREE_PROVIDER),
    getAiSetting('pro_provider', DEFAULT_PRO_PROVIDER),
  ]);
  const [freeModel, proModel] = await Promise.all([
    getAiSetting('free_model', getDefaultModelForProvider('free', freeProvider)),
    getAiSetting('pro_model', getDefaultModelForProvider('pro', proProvider)),
  ]);
  return {
    ...fallback,
    general: {
      free: { provider: freeProvider as AiProvider, model: freeModel },
      pro: { provider: proProvider as AiProvider, model: proModel },
    },
  };
}

async function loadFromDb(): Promise<{ config: AiRuntimeConfig; rowVersion: number }> {
  try {
    const [row] = await db.select().from(aiRuntimeConfigs).where(eq(aiRuntimeConfigs.id, 1)).limit(1);
    if (row?.config) {
      return { config: parseAiRuntimeConfig(row.config), rowVersion: row.version };
    }
  } catch {
    // table may not exist yet during migrate
  }
  return { config: await loadLegacyConfig(), rowVersion: 0 };
}

export async function getResolvedAiRuntime(force = false): Promise<AiRuntimeConfig> {
  const fromAls = als.getStore();
  if (fromAls) return fromAls;
  const now = Date.now();
  if (!force && memory && memory.expiresAt > now) return memory.value;
  const loaded = await loadFromDb();
  memory = { value: loaded.config, rowVersion: loaded.rowVersion, expiresAt: now + TTL_MS };
  return loaded.config;
}

export function getCachedAiRuntimeVersion() {
  return memory?.rowVersion ?? 0;
}

export function bindAiRuntime<T>(config: AiRuntimeConfig, fn: () => Promise<T>): Promise<T> {
  return als.run(config, fn);
}

export function clearAiRuntimeCache() {
  memory = null;
  clearAiSettingsCache();
}

export async function resolveRouteModel(
  fn: AiFunctionKey,
  isPro: boolean,
  snapshot?: AiRuntimeConfig,
) {
  const config = snapshot ?? await getResolvedAiRuntime();
  const plan: AiPlan = isPro ? 'pro' : 'free';
  const { ref, inherited } = resolveModelForFunction(config, fn, plan);
  return { provider: ref.provider, model: ref.model, inherited, plan, config };
}

export { DEFAULT_FREE_MODEL, DEFAULT_FREE_PROVIDER, DEFAULT_PRO_MODEL, DEFAULT_PRO_PROVIDER };
