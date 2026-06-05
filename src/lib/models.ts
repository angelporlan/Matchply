export interface ModelOption {
  value: string;
  label: string;
}

export const GLOBAL_FREE_MODELS: Record<string, ModelOption[]> = {
  openrouter: [
    { value: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B (Free)' }
  ]
};

export const GLOBAL_PRO_MODELS: Record<string, ModelOption[]> = {
  openrouter: [
    { value: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B (Free)' },
    { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
  ]
};

// Defaults
export const DEFAULT_FREE_PROVIDER = 'openrouter';
export const DEFAULT_FREE_MODEL = 'openai/gpt-oss-120b:free';

export const DEFAULT_PRO_PROVIDER = 'openrouter';
export const DEFAULT_PRO_MODEL = 'deepseek/deepseek-v4-flash';

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
