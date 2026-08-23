export interface ModelOption {
  value: string;
  label: string;
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
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
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
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
  ]
};

// Defaults
export const DEFAULT_FREE_PROVIDER = 'openrouter';
export const DEFAULT_FREE_MODEL = 'google/gemini-2.5-flash-lite';

export const DEFAULT_PRO_PROVIDER = 'openrouter';
export const DEFAULT_PRO_MODEL = 'google/gemini-2.5-flash-lite';

/**
 * Returns the default model for a given provider if the provider changes
 */
export function getDefaultModelForProvider(plan: 'free' | 'pro', provider: string): string {
  const models = plan === 'free' ? GLOBAL_FREE_MODELS : GLOBAL_PRO_MODELS;
  const list = models[provider] || [];
  if (list.length > 0) {
    return list[0].value;
  }
  return plan === 'free' ? DEFAULT_FREE_MODEL : DEFAULT_PRO_MODEL;
}
