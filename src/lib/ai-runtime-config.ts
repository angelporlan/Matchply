import type { AiProvider } from '@/lib/models';
import {
  DEFAULT_FREE_MODEL,
  DEFAULT_FREE_PROVIDER,
  DEFAULT_PRO_MODEL,
  DEFAULT_PRO_PROVIDER,
} from '@/lib/models';

export const AI_RUNTIME_CONFIG_VERSION = 1;

export const AI_FUNCTION_KEYS = [
  'optimize_cv',
  'import_cv',
  'career_profile',
  'matching',
  'outreach',
  'research',
] as const;

export type AiFunctionKey = typeof AI_FUNCTION_KEYS[number];
export type AiPlan = 'free' | 'pro';

export type AiModelRef = {
  provider: AiProvider;
  model: string;
};

export type AiFunctionOverride = {
  free?: AiModelRef;
  pro?: AiModelRef;
};

export type AiRuntimeConfig = {
  version: number;
  general: { free: AiModelRef; pro: AiModelRef };
  overrides: Partial<Record<AiFunctionKey, AiFunctionOverride>>;
  tested: Array<{
    provider: AiProvider;
    model: string;
    testedAt: string;
    ok: boolean;
  }>;
};

export const AI_FUNCTION_LABELS: Record<AiFunctionKey, { es: string; needs: Array<'streaming' | 'json'> }> = {
  optimize_cv: { es: 'Optimización de CV', needs: ['streaming'] },
  import_cv: { es: 'Importación de CV', needs: [] },
  career_profile: { es: 'Perfil profesional', needs: ['json'] },
  matching: { es: 'Matching', needs: ['json'] },
  outreach: { es: 'Cartas y entrevistas', needs: [] },
  research: { es: 'Investigación', needs: [] },
};

const PROVIDERS: AiProvider[] = ['gemini', 'deepseek', 'openrouter'];

function isProvider(value: unknown): value is AiProvider {
  return value === 'gemini' || value === 'deepseek' || value === 'openrouter';
}

function parseModelRef(value: unknown, fallback: AiModelRef): AiModelRef {
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Record<string, unknown>;
  const provider = isProvider(raw.provider) ? raw.provider : fallback.provider;
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : fallback.model;
  return { provider, model };
}

export function defaultAiRuntimeConfig(): AiRuntimeConfig {
  return {
    version: AI_RUNTIME_CONFIG_VERSION,
    general: {
      free: { provider: DEFAULT_FREE_PROVIDER, model: DEFAULT_FREE_MODEL },
      pro: { provider: DEFAULT_PRO_PROVIDER, model: DEFAULT_PRO_MODEL },
    },
    overrides: {},
    tested: [],
  };
}

export function parseAiRuntimeConfig(raw: unknown): AiRuntimeConfig {
  const fallback = defaultAiRuntimeConfig();
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Record<string, unknown>;
  const generalRaw = (value.general && typeof value.general === 'object')
    ? value.general as Record<string, unknown>
    : {};
  const overridesRaw = (value.overrides && typeof value.overrides === 'object')
    ? value.overrides as Record<string, unknown>
    : {};
  const overrides: AiRuntimeConfig['overrides'] = {};
  for (const key of AI_FUNCTION_KEYS) {
    const item = overridesRaw[key];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const next: AiFunctionOverride = {};
    if (rec.free) next.free = parseModelRef(rec.free, fallback.general.free);
    if (rec.pro) next.pro = parseModelRef(rec.pro, fallback.general.pro);
    if (next.free || next.pro) overrides[key] = next;
  }
  const tested = Array.isArray(value.tested)
    ? value.tested.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const rec = item as Record<string, unknown>;
      if (!isProvider(rec.provider) || typeof rec.model !== 'string' || !rec.model.trim()) return [];
      return [{
        provider: rec.provider,
        model: rec.model.trim(),
        testedAt: typeof rec.testedAt === 'string' ? rec.testedAt : new Date(0).toISOString(),
        ok: rec.ok === true,
      }];
    })
    : [];

  return {
    version: Number.isFinite(Number(value.version)) ? Number(value.version) : fallback.version,
    general: {
      free: parseModelRef(generalRaw.free, fallback.general.free),
      pro: parseModelRef(generalRaw.pro, fallback.general.pro),
    },
    overrides,
    tested,
  };
}

export function resolveModelForFunction(
  config: AiRuntimeConfig,
  fn: AiFunctionKey,
  plan: AiPlan,
): { ref: AiModelRef; inherited: boolean } {
  const override = config.overrides[fn]?.[plan];
  if (override?.provider && override.model) {
    return { ref: override, inherited: false };
  }
  return { ref: config.general[plan], inherited: true };
}

export function modelKey(ref: AiModelRef) {
  return `${ref.provider}:${ref.model}`;
}

export function hasSuccessfulModelTest(config: AiRuntimeConfig, ref: AiModelRef) {
  return config.tested.some((item) => item.ok && item.provider === ref.provider && item.model === ref.model);
}

export function collectActiveModelRefs(config: AiRuntimeConfig): AiModelRef[] {
  const refs = [config.general.free, config.general.pro];
  for (const key of AI_FUNCTION_KEYS) {
    const item = config.overrides[key];
    if (item?.free) refs.push(item.free);
    if (item?.pro) refs.push(item.pro);
  }
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const id = modelKey(ref);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function newlyActivatedRefs(previous: AiRuntimeConfig, next: AiRuntimeConfig): AiModelRef[] {
  const prevKeys = new Set(collectActiveModelRefs(previous).map(modelKey));
  return collectActiveModelRefs(next).filter((ref) => !prevKeys.has(modelKey(ref)));
}

export function isSupportedProvider(value: string): value is AiProvider {
  return PROVIDERS.includes(value as AiProvider);
}
