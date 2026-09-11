import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';

const TTL_MS = 60_000;
const cache = new Map<string, { value: string; expiresAt: number }>();

export async function getAiSetting(key: string, defaultValue: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    const value = setting ? setting.value : defaultValue;
    cache.set(key, { value, expiresAt: now + TTL_MS });
    return value;
  } catch (error) {
    console.error(`[ai-settings] Error al leer setting "${key}". Usando default "${defaultValue}":`, error);
    return hit?.value ?? defaultValue;
  }
}

export function clearAiSettingsCache() {
  cache.clear();
}
