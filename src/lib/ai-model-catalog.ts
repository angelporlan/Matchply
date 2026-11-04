import { fetchWithTimeout } from '@/lib/http';
import type { AiProvider } from '@/lib/models';

export type CatalogModel = {
  id: string;
  provider: AiProvider;
  name: string;
  description?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  pricing?: { prompt?: string; completion?: string };
  updatedAt?: string;
};

type CatalogCache = { value: CatalogModel[]; fetchedAt: number; error?: string };
const cache = new Map<AiProvider, CatalogCache>();
const TTL_MS = 60 * 60_000;

export class CatalogError extends Error {
  constructor(public readonly code: 'invalid_key' | 'catalog_unavailable', public readonly status?: number) {
    super(code);
    this.name = 'CatalogError';
  }
}

function credentialStatus() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('mock')),
    gemini: Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('mock')),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('mock')),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY.includes('mock')),
  };
}

function envKey(provider: AiProvider): string | undefined {
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY;
  if (provider === 'deepseek') return process.env.DEEPSEEK_API_KEY;
  return process.env.OPENROUTER_API_KEY;
}

function isNonChatModel(id: string) {
  const lower = id.toLowerCase();
  return lower.includes('whisper') || lower.includes('tts') || lower.includes('dall-e')
    || lower.includes('embedding') || lower.includes('moderation') || lower.includes('realtime')
    || lower.includes('audio') || lower.includes('babbage') || lower.includes('davinci');
}

function catalogFailure(error: unknown, status?: number): CatalogError {
  if (error instanceof CatalogError) return error;
  if (status === 401 || status === 403) return new CatalogError('invalid_key', status);
  return new CatalogError('catalog_unavailable', status);
}

async function fetchOpenAI(apiKey: string): Promise<CatalogModel[]> {
  const res = await fetchWithTimeout('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  }, 12_000);
  if (res.status === 401 || res.status === 403) throw new CatalogError('invalid_key', res.status);
  if (!res.ok) throw new CatalogError('catalog_unavailable', res.status);
  const json = await res.json() as { data?: Array<{ id?: string; owned_by?: string }> };
  const rawList = (json.data || []).map((m) => m.id || '').filter(Boolean);

  const filtered = rawList.filter((id) => {
    if (isNonChatModel(id)) return false;
    if (id.toLowerCase() === 'gpt-5.6-luna') return false;
    const lower = id.toLowerCase();
    return lower.includes('gpt') || lower.includes('luna') || lower.includes('o1') || lower.includes('o3') || lower.includes('chat');
  });

  filtered.sort((a, b) => {
    if (a === 'gpt-6-luna') return -1;
    if (b === 'gpt-6-luna') return 1;
    if (a.includes('luna') && !b.includes('luna')) return -1;
    if (!a.includes('luna') && b.includes('luna')) return 1;
    return a.localeCompare(b);
  });

  return filtered.map((id) => ({
    id,
    provider: 'openai' as const,
    name: id === 'gpt-6-luna' ? 'GPT-6 Luna (OpenAI)' : id,
  }));
}

async function fetchGemini(apiKey: string): Promise<CatalogModel[]> {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { headers: { Accept: 'application/json' } },
    12_000,
  );
  if (res.status === 401 || res.status === 403) throw new CatalogError('invalid_key', res.status);
  if (!res.ok) throw new CatalogError('catalog_unavailable', res.status);
  const json = await res.json() as { models?: Array<{ name?: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }> };
  return (json.models || []).map((model) => ({
    id: (model.name || '').replace(/^models\//, ''),
    provider: 'gemini' as const,
    name: model.displayName || model.name || 'unknown',
    description: model.description,
  })).filter((model) => model.id && !isNonChatModel(model.id));
}

async function fetchDeepSeek(apiKey: string): Promise<CatalogModel[]> {
  const res = await fetchWithTimeout('https://api.deepseek.com/models', {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  }, 12_000);
  if (res.status === 401 || res.status === 403) throw new CatalogError('invalid_key', res.status);
  if (!res.ok) throw new CatalogError('catalog_unavailable', res.status);
  const json = await res.json() as { data?: Array<{ id?: string; owned_by?: string }> };
  return (json.data || []).map((model) => ({
    id: model.id || '',
    provider: 'deepseek' as const,
    name: model.id || 'unknown',
  })).filter((model) => model.id && !isNonChatModel(model.id));
}

async function fetchOpenRouter(apiKey: string): Promise<CatalogModel[]> {
  const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  }, 12_000);
  if (res.status === 401 || res.status === 403) throw new CatalogError('invalid_key', res.status);
  if (!res.ok) throw new CatalogError('catalog_unavailable', res.status);
  const json = await res.json() as { data?: Array<{ id?: string; name?: string; description?: string; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }> };
  return (json.data || []).map((model) => ({
    id: model.id || '',
    provider: 'openrouter' as const,
    name: model.name || model.id || 'unknown',
    description: model.description,
    pricing: model.pricing,
    inputModalities: model.architecture?.input_modalities,
    outputModalities: model.architecture?.output_modalities,
  })).filter((model) => model.id && !isNonChatModel(model.id));
}

const FETCHERS: Record<AiProvider, (apiKey: string) => Promise<CatalogModel[]>> = {
  openai: fetchOpenAI,
  gemini: fetchGemini,
  deepseek: fetchDeepSeek,
  openrouter: fetchOpenRouter,
};

export async function fetchProviderModels(provider: AiProvider, apiKey: string): Promise<CatalogModel[]> {
  if (!apiKey) throw new CatalogError('invalid_key');
  try {
    return await FETCHERS[provider](apiKey);
  } catch (error: unknown) {
    throw catalogFailure(error);
  }
}

export async function getProviderCatalog(provider: AiProvider, force = false) {
  const hit = cache.get(provider);
  const now = Date.now();
  if (!force && hit && now - hit.fetchedAt < TTL_MS) return hit;
  try {
    const key = envKey(provider);
    if (!key) throw new Error(`${provider} API key no configurada`);
    const value = await FETCHERS[provider](key);
    const next = { value, fetchedAt: now };
    cache.set(provider, next);
    return next;
  } catch (error: any) {
    const fallback = hit || { value: [], fetchedAt: 0, error: error.message || 'Catálogo no disponible' };
    const next = { ...fallback, error: error.message || 'Catálogo no disponible' };
    cache.set(provider, next);
    return next;
  }
}

export async function getAllProviderCatalogs(force = false) {
  const [openai, gemini, deepseek, openrouter] = await Promise.all([
    getProviderCatalog('openai', force),
    getProviderCatalog('gemini', force),
    getProviderCatalog('deepseek', force),
    getProviderCatalog('openrouter', force),
  ]);
  return {
    catalogs: { openai, gemini, deepseek, openrouter },
    credentials: credentialStatus(),
  };
}

export function modelInCatalog(catalog: CatalogModel[], provider: AiProvider, model: string) {
  return catalog.some((item) => item.provider === provider && item.id === model);
}

export function publicCatalogModels(models: CatalogModel[]): Array<{ id: string; name: string }> {
  return models.map((model) => ({ id: model.id, name: model.name }));
}
