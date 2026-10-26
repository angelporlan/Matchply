import type { AiProvider } from './models';

const keys: Record<AiProvider, string> = {
  openai: 'OPENAI_API_KEY', openrouter: 'OPENROUTER_API_KEY', gemini: 'GEMINI_API_KEY', deepseek: 'DEEPSEEK_API_KEY',
};

/** Server transport only. Never return this value from a route or server action. */
export function providerCredential(provider: AiProvider, env: Record<string, string | undefined> = process.env): string | null {
  const key = env[keys[provider]]?.trim();
  return key && !/mock|your_api_key|\.\.\./i.test(key) ? key : null;
}
