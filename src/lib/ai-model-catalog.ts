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

function credentialStatus() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('mock')),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes('mock')),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY.includes('mock')),
  };
}

async function fetchGemini(): Promise<CatalogModel[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY no configurada');
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    { headers: { Accept: 'application/json' } },
    12_000,
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json() as { models?: Array<{ name?: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }> };
  return (json.models || []).map((model) => ({
    id: (model.name || '').replace(/^models\//, ''),
    provider: 'gemini' as const,
    name: model.displayName || model.name || 'unknown',
    description: model.description,
  })).filter((model) => model.id);
}

async function fetchDeepSeek(): Promise<CatalogModel[]> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY no configurada');
  const res = await fetchWithTimeout('https://api.deepseek.com/models', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  }, 12_000);
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const json = await res.json() as { data?: Array<{ id?: string; owned_by?: string }> };
  return (json.data || []).map((model) => ({
    id: model.id || '',
    provider: 'deepseek' as const,
    name: model.id || 'unknown',
  })).filter((model) => model.id);
}

async function fetchOpenRouter(): Promise<CatalogModel[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY no configurada');
  const res = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  }, 12_000);
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const json = await res.json() as { data?: Array<{ id?: string; name?: string; description?: string; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }> };
  return (json.data || []).map((model) => ({
    id: model.id || '',
    provider: 'openrouter' as const,
    name: model.name || model.id || 'unknown',
    description: model.description,
    pricing: model.pricing,
    inputModalities: model.architecture?.input_modalities,
    outputModalities: model.architecture?.output_modalities,
  })).filter((model) => model.id);
}

const FETCHERS: Record<AiProvider, () => Promise<CatalogModel[]>> = {
  gemini: fetchGemini,
  deepseek: fetchDeepSeek,
  openrouter: fetchOpenRouter,
};

export async function getProviderCatalog(provider: AiProvider, force = false) {
  const hit = cache.get(provider);
  const now = Date.now();
  if (!force && hit && now - hit.fetchedAt < TTL_MS) return hit;
  try {
    const value = await FETCHERS[provider]();
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
  const [gemini, deepseek, openrouter] = await Promise.all([
    getProviderCatalog('gemini', force),
    getProviderCatalog('deepseek', force),
    getProviderCatalog('openrouter', force),
  ]);
  return {
    catalogs: { gemini, deepseek, openrouter },
    credentials: credentialStatus(),
  };
}

export function modelInCatalog(catalog: CatalogModel[], provider: AiProvider, model: string) {
  return catalog.some((item) => item.provider === provider && item.id === model);
}
