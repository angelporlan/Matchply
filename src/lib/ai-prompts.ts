import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { prompts } from '@/db/schema';
import { getBuiltInPrompt, type BuiltInPromptKey } from '@/lib/prompt-defaults';

const TTL_MS = 60_000;

type ResolvedPrompt = ReturnType<typeof getBuiltInPrompt> & {
  systemPrompt: string;
  userPrompt: string;
  isStrict: boolean;
};

const cache = new Map<string, { value: ResolvedPrompt; expiresAt: number }>();

function cacheKey(key: BuiltInPromptKey, promptId?: string) {
  return promptId ? `id:${promptId}` : `active:${key}`;
}

/**
 * Admin-overridable prompts with the same 60s TTL pattern as AI provider settings.
 * Incomplete DB rows fall back to the versioned built-in prompt.
 */
export async function resolveAiPrompt(key: BuiltInPromptKey, promptId?: string): Promise<ResolvedPrompt> {
  const builtInPrompt = getBuiltInPrompt(key);
  const now = Date.now();
  const keyName = cacheKey(key, promptId);
  const hit = cache.get(keyName);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const [dbPrompt] = await db
      .select({
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        isStrict: prompts.isStrict,
      })
      .from(prompts)
      .where(
        promptId
          ? eq(prompts.id, promptId)
          : and(eq(prompts.key, key), eq(prompts.isActive, true))
      )
      .limit(1);

    const value: ResolvedPrompt = dbPrompt?.systemPrompt?.trim() && dbPrompt.userPrompt?.trim()
      ? {
          ...builtInPrompt,
          systemPrompt: dbPrompt.systemPrompt,
          userPrompt: dbPrompt.userPrompt,
          isStrict: dbPrompt.isStrict,
        }
      : builtInPrompt;

    cache.set(keyName, { value, expiresAt: now + TTL_MS });
    return value;
  } catch (error) {
    console.error(`[AIService] Error al obtener prompt "${key}" de la DB. Usando prompt integrado:`, error);
    return hit?.value ?? builtInPrompt;
  }
}

export function clearAiPromptsCache() {
  cache.clear();
}
