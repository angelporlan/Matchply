import { AsyncLocalStorage } from 'async_hooks';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userLlmCredentials } from '@/db/schema';
import { providerCredential } from '@/lib/ai-provider-credentials';
import type { AiProvider } from '@/lib/models';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';

const PROVIDERS: AiProvider[] = ['openai', 'openrouter', 'deepseek', 'gemini'];
const ENV_TO_PROVIDER: Record<string, AiProvider> = {
  OPENAI_API_KEY: 'openai',
  OPENROUTER_API_KEY: 'openrouter',
  DEEPSEEK_API_KEY: 'deepseek',
  GEMINI_API_KEY: 'gemini',
};

export type PublicLlmCredential = {
  connected: boolean;
  provider: AiProvider | null;
  lastChars: string | null;
  updatedAt: string | null;
};

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
};

export function emptyPublicLlmCredential(): PublicLlmCredential {
  return { connected: false, provider: null, lastChars: null, updatedAt: null };
}

export function toPublicLlmCredential(row: {
  provider: AiProvider;
  lastChars: string;
  updatedAt: Date;
} | null): PublicLlmCredential {
  if (!row) return emptyPublicLlmCredential();
  return {
    connected: true,
    provider: row.provider,
    lastChars: row.lastChars,
    updatedAt: row.updatedAt.toISOString(),
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
