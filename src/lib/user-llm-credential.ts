import { AsyncLocalStorage } from 'async_hooks';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userLlmCredentials } from '@/db/schema';
import { CatalogError, fetchProviderModels, publicCatalogModels } from '@/lib/ai-model-catalog';
import { providerCredential } from '@/lib/ai-provider-credentials';
import type { AiFunctionKey, AiRuntimeConfig } from '@/lib/ai-runtime-config';
import type { AiProvider } from '@/lib/models';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';

const PROVIDERS: AiProvider[] = ['openai', 'openrouter', 'deepseek', 'gemini'];
const ENV_TO_PROVIDER: Record<string, AiProvider> = {
  OPENAI_API_KEY: 'openai',
  OPENROUTER_API_KEY: 'openrouter',
  DEEPSEEK_API_KEY: 'deepseek',
  GEMINI_API_KEY: 'gemini',
};

export type AgentKind = 'scout' | 'research' | 'cv';

export type PublicLlmCredential = {
  connected: boolean;
  provider: AiProvider | null;
  lastChars: string | null;
  updatedAt: string | null;
  scoutModel: string | null;
  researchModel: string | null;
  cvModel: string | null;
};

export type PublicCatalogModel = { id: string; name: string };

export class LlmCredentialError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'LlmCredentialError';
  }
}

export function llmCredentialWriteBlocked(input: { authenticated: boolean; impersonation: boolean; isGuest: boolean }): 'unauthorized' | 'forbidden' | null {
  if (!input.authenticated) return 'unauthorized';
  if (input.impersonation || input.isGuest) return 'forbidden';
  return null;
}

type UserLlmStore = {
  userId: string;
  provider: AiProvider | null;
  key: string | null;
};

const als = new AsyncLocalStorage<UserLlmStore>();

export const publicLlmCredentialColumns = {
  provider: userLlmCredentials.provider,
  lastChars: userLlmCredentials.lastChars,
  updatedAt: userLlmCredentials.updatedAt,
  scoutModel: userLlmCredentials.scoutModel,
  researchModel: userLlmCredentials.researchModel,
  cvModel: userLlmCredentials.cvModel,
};

export function emptyPublicLlmCredential(): PublicLlmCredential {
  return { connected: false, provider: null, lastChars: null, updatedAt: null, scoutModel: null, researchModel: null, cvModel: null };
}

export function toPublicLlmCredential(row: {
  provider: AiProvider;
  lastChars: string;
  updatedAt: Date;
  scoutModel?: string | null;
  researchModel?: string | null;
  cvModel?: string | null;
} | null): PublicLlmCredential {
  if (!row) return emptyPublicLlmCredential();
  return {
    connected: true,
    provider: row.provider,
    lastChars: row.lastChars,
    updatedAt: row.updatedAt.toISOString(),
    scoutModel: row.scoutModel ?? null,
    researchModel: row.researchModel ?? null,
    cvModel: row.cvModel ?? null,
  };
}

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && (PROVIDERS as string[]).includes(value);
}

export function validateLlmApiKey(provider: unknown, apiKey: unknown): { provider: AiProvider; apiKey: string; lastChars: string } {
  if (!isAiProvider(provider)) throw new LlmCredentialError('invalid_provider');
  if (typeof apiKey !== 'string') throw new LlmCredentialError('invalid_key');
  const trimmed = apiKey.trim();
  if (trimmed.length < 20) throw new LlmCredentialError('too_short');
  if (trimmed.length > 256) throw new LlmCredentialError('too_long');
  if (/\s/.test(trimmed)) throw new LlmCredentialError('invalid_key');
  if (/mock|your_api_key|\.\.\./i.test(trimmed)) throw new LlmCredentialError('mock_key');
  if ((provider === 'openai' || provider === 'deepseek') && !trimmed.startsWith('sk-')) throw new LlmCredentialError('prefix');
  if (provider === 'openrouter' && !trimmed.startsWith('sk-or-')) throw new LlmCredentialError('prefix');
  return { provider, apiKey: trimmed, lastChars: trimmed.slice(-4) };
}

export async function getPublicLlmCredential(userId: string): Promise<PublicLlmCredential> {
  const [row] = await db
    .select(publicLlmCredentialColumns)
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);
  return toPublicLlmCredential(row ?? null);
}

export async function saveLlmCredential(userId: string, input: { provider: unknown; apiKey: unknown }): Promise<PublicLlmCredential> {
  const parsed = validateLlmApiKey(input.provider, input.apiKey);
  const keyCipher = encryptSecret(parsed.apiKey);
  const now = new Date();
  const [existing] = await db
    .select({ provider: userLlmCredentials.provider })
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);
  const providerChanged = Boolean(existing && existing.provider !== parsed.provider);
  const [row] = await db
    .insert(userLlmCredentials)
    .values({
      userId,
      provider: parsed.provider,
      keyCipher,
      lastChars: parsed.lastChars,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userLlmCredentials.userId,
      set: {
        provider: parsed.provider,
        keyCipher,
        lastChars: parsed.lastChars,
        updatedAt: now,
        ...(providerChanged ? { scoutModel: null, researchModel: null, cvModel: null } : {}),
      },
    })
    .returning(publicLlmCredentialColumns);
  return toPublicLlmCredential(row);
}

export async function deleteLlmCredential(userId: string): Promise<PublicLlmCredential> {
  await db.delete(userLlmCredentials).where(eq(userLlmCredentials.userId, userId));
  return emptyPublicLlmCredential();
}

export function credentialKeyForProvider(
  row: { provider: AiProvider; keyCipher: string } | null,
  provider: AiProvider,
): string | null {
  if (!row || row.provider !== provider) return null;
  try {
    return decryptSecret(row.keyCipher);
  } catch {
    return null;
  }
}

async function loadStore(userId: string): Promise<UserLlmStore> {
  const [row] = await db
    .select({
      provider: userLlmCredentials.provider,
      keyCipher: userLlmCredentials.keyCipher,
    })
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);
  if (!row) return { userId, provider: null, key: null };
  return {
    userId,
    provider: row.provider,
    key: credentialKeyForProvider(row, row.provider),
  };
}

export function bindUserLlmContext<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return loadStore(userId).then(store => als.run(store, fn));
}

export function userLlmStore(): UserLlmStore | undefined {
  return als.getStore();
}

export function userLlmKeyForProvider(provider: AiProvider): string | null {
  const store = als.getStore();
  if (store?.provider === provider && store.key) return store.key;
  return null;
}

export function userLlmKeyForEnvVar(envVar: string): string | null {
  const provider = ENV_TO_PROVIDER[envVar];
  return provider ? userLlmKeyForProvider(provider) : null;
}

export async function resolveUserOrEnvCredential(provider: AiProvider, userId?: string): Promise<string | null> {
  const store = als.getStore();
  if (store && (!userId || store.userId === userId) && store.provider === provider && store.key) {
    return store.key;
  }
  if (userId) {
    const loaded = store?.userId === userId ? store : await loadStore(userId);
    if (loaded.provider === provider && loaded.key) return loaded.key;
  }
  return providerCredential(provider);
}

async function decryptUserKey(userId: string): Promise<{ provider: AiProvider; apiKey: string } | null> {
  const [row] = await db
    .select({
      provider: userLlmCredentials.provider,
      keyCipher: userLlmCredentials.keyCipher,
    })
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);
  if (!row) return null;
  const apiKey = credentialKeyForProvider(row, row.provider);
  if (!apiKey) return null;
  return { provider: row.provider, apiKey };
}

export async function listUserProviderModels(userId: string): Promise<PublicCatalogModel[]> {
  const credential = await decryptUserKey(userId);
  if (!credential) throw new LlmCredentialError('PROVIDER_REQUIRED');
  try {
    const models = await fetchProviderModels(credential.provider, credential.apiKey);
    return publicCatalogModels(models);
  } catch (error) {
    if (error instanceof CatalogError) throw new LlmCredentialError(error.code);
    throw new LlmCredentialError('catalog_unavailable');
  }
}

export function validateAgentModels(
  catalogIds: Iterable<string>,
  input: { scout?: unknown; research?: unknown; cv?: unknown },
): { scoutModel: string | null; researchModel: string | null; cvModel: string | null } {
  const ids = new Set(catalogIds);
  const parse = (value: unknown, fallback: string | null = null) => {
    if (value === undefined) return fallback;
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !ids.has(value)) throw new LlmCredentialError('invalid_model');
    return value;
  };
  return {
    scoutModel: parse(input.scout),
    researchModel: parse(input.research),
    cvModel: parse(input.cv),
  };
}

export async function saveAgentModels(
  userId: string,
  input: { scout?: unknown; research?: unknown; cv?: unknown },
): Promise<PublicLlmCredential> {
  const [row] = await db
    .select(publicLlmCredentialColumns)
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);
  if (!row) throw new LlmCredentialError('PROVIDER_REQUIRED');
  const models = await listUserProviderModels(userId);
  const ids = new Set(models.map(model => model.id));
  const keep = (value: string | null) => (value && ids.has(value) ? value : null);
  const assigned = validateAgentModels(ids, {
    scout: input.scout === undefined ? keep(row.scoutModel) : input.scout,
    research: input.research === undefined ? keep(row.researchModel) : input.research,
    cv: input.cv === undefined ? keep(row.cvModel) : input.cv,
  });
  const [updated] = await db
    .update(userLlmCredentials)
    .set({ ...assigned, updatedAt: new Date() })
    .where(eq(userLlmCredentials.userId, userId))
    .returning(publicLlmCredentialColumns);
  return toPublicLlmCredential(updated);
}

export async function agentModelRef(userId: string, agent: AgentKind): Promise<{ provider: AiProvider; model: string } | null> {
  const [row] = await db
    .select({
      provider: userLlmCredentials.provider,
      scoutModel: userLlmCredentials.scoutModel,
      researchModel: userLlmCredentials.researchModel,
      cvModel: userLlmCredentials.cvModel,
    })
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);
  if (!row) return null;
  const model = agent === 'scout' ? row.scoutModel : agent === 'research' ? row.researchModel : row.cvModel;
  if (!model) return null;
  return { provider: row.provider, model };
}

const AGENT_FUNCTION: Record<AgentKind, AiFunctionKey> = {
  scout: 'matching',
  research: 'research',
  cv: 'optimize_cv',
};

export function mergeAgentOverride(
  runtime: AiRuntimeConfig,
  agent: AgentKind,
  ref: { provider: AiProvider; model: string } | null,
): AiRuntimeConfig {
  if (!ref) return runtime;
  const key = AGENT_FUNCTION[agent];
  return { ...runtime, overrides: { ...runtime.overrides, [key]: { free: ref, pro: ref } } };
}
