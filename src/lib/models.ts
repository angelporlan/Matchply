export type AiProvider = 'openrouter' | 'deepseek' | 'gemini';

export interface ModelOption {
  value: string;
  label: string;
}

export interface CustomModelConfig {
  id: string;
  provider: AiProvider;
  value: string;
  label: string;
  plans: ('free' | 'pro')[];
  description?: string;
  isBuiltin?: boolean;
}

export const GLOBAL_FREE_MODELS: Record<string, ModelOption[]> = {
  openrouter: [
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (OpenRouter)' },
    { value: 'openrouter/free', label: 'OpenRouter Auto (Gratuito)' },
    { value: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B (Free)' },
    { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
    { value: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (Free)' }
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek-V3' },
    { value: 'deepseek-reasoner', label: 'DeepSeek-R1' }
  ],
  gemini: [
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
  ]
};

export const GLOBAL_PRO_MODELS: Record<string, ModelOption[]> = {
  openrouter: [
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (OpenRouter)' },
    { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (OpenRouter)' },
    { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (OpenRouter)' },
    { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (OpenRouter)' },
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (OpenRouter)' },
    { value: 'openrouter/free', label: 'OpenRouter Auto (Free Tier)' }
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek-V3' },
    { value: 'deepseek-reasoner', label: 'DeepSeek-R1' }
  ],
  gemini: [
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
  ]
};

// Defaults
export const DEFAULT_FREE_PROVIDER = 'gemini';
export const DEFAULT_FREE_MODEL = 'gemini-3.5-flash-lite';

export const DEFAULT_PRO_PROVIDER = 'gemini';
export const DEFAULT_PRO_MODEL = 'gemini-3.5-flash-lite';

/**
 * Builds the initial default model catalog from GLOBAL_FREE_MODELS and GLOBAL_PRO_MODELS
 */
export function getDefaultModelCatalog(): CustomModelConfig[] {
  const map = new Map<string, CustomModelConfig>();
  const providers: AiProvider[] = ['openrouter', 'deepseek', 'gemini'];

  for (const provider of providers) {
    const freeList = GLOBAL_FREE_MODELS[provider] || [];
    for (const m of freeList) {
      const key = `${provider}:${m.value}`;
      map.set(key, {
        id: `builtin-${provider}-${m.value.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        provider,
        value: m.value,
        label: m.label,
        plans: ['free'],
        isBuiltin: true,
      });
    }

    const proList = GLOBAL_PRO_MODELS[provider] || [];
    for (const m of proList) {
      const key = `${provider}:${m.value}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.plans.includes('pro')) {
          existing.plans.push('pro');
        }
      } else {
        map.set(key, {
          id: `builtin-${provider}-${m.value.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          provider,
          value: m.value,
          label: m.label,
          plans: ['pro'],
          isBuiltin: true,
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Parses the raw ai_models_catalog setting JSON, with safe fallback to default catalog
 */
export function parseModelCatalog(raw: string | null | undefined): CustomModelConfig[] {
  if (!raw) return getDefaultModelCatalog();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned: CustomModelConfig[] = [];
      const seenKeys = new Set<string>();
      const seenIds = new Set<string>();

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        const val = String(item?.value || '').trim();
        const prov = (item?.provider === 'openrouter' || item?.provider === 'deepseek' || item?.provider === 'gemini')
          ? (item.provider as AiProvider)
          : 'openrouter';

        if (!val) continue;
        const dedupeKey = `${prov}:${val}`;
        const id = item?.id ? String(item.id).trim() : '';

        if (seenKeys.has(dedupeKey)) continue;
        if (id && seenIds.has(id)) continue;

        seenKeys.add(dedupeKey);
        if (id) seenIds.add(id);

        const plans: ('free' | 'pro')[] = Array.isArray(item.plans)
          ? item.plans.filter((p: string) => p === 'free' || p === 'pro')
          : ['free', 'pro'];

        cleaned.push({
          id: id || `custom-${prov}-${val.replace(/[^a-zA-Z0-9_-]/g, '_')}-${i}`,
          provider: prov,
          value: val,
          label: String(item.label || item.name || val).trim(),
          plans: plans.length > 0 ? plans : ['free', 'pro'],
          description: item.description ? String(item.description).trim() : undefined,
          isBuiltin: Boolean(item.isBuiltin),
        });
      }

      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  } catch (err) {
    console.error('[models] Error al parsear ai_models_catalog:', err);
  }
  return getDefaultModelCatalog();
}

/**
 * Filters the catalog for a specific plan and provider
 */
export function getModelsForPlanAndProvider(
  catalog: CustomModelConfig[],
  plan: 'free' | 'pro',
  provider: string,
  currentSelectedValue?: string,
): ModelOption[] {
  const matching = catalog
    .filter((m) => m.provider === provider && m.plans.includes(plan))
    .map((m) => ({ value: m.value, label: m.label }));

  if (currentSelectedValue && !matching.some((m) => m.value === currentSelectedValue)) {
    return [
      ...matching,
      { value: currentSelectedValue, label: `${currentSelectedValue} (Actual / Personalizado)` },
    ];
  }

  return matching;
}

/**
 * Returns the default model for a given provider if the provider changes
 */
export function getDefaultModelForProvider(
  plan: 'free' | 'pro',
  provider: string,
  catalog?: CustomModelConfig[],
): string {
  if (catalog && catalog.length > 0) {
    const options = getModelsForPlanAndProvider(catalog, plan, provider);
    if (options.length > 0) {
      return options[0].value;
    }
  }
  const models = plan === 'free' ? GLOBAL_FREE_MODELS : GLOBAL_PRO_MODELS;
  const list = models[provider] || [];
  if (list.length > 0) {
    return list[0].value;
  }
  return plan === 'free' ? DEFAULT_FREE_MODEL : DEFAULT_PRO_MODEL;
}
