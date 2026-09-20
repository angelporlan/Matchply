import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { prompts } from '@/db/schema';
import { UnknownOptimizeModeError } from '@/lib/request-errors';
import {
  getDefaultOptimizeMode,
  isOptimizeModeId,
  looksLikeLegacyPromptId,
  resolveOptimizeModeFromName,
  type OptimizeModeId,
} from '@/lib/optimize-modes';
import { getBuiltInPrompt, getOptimizePrompt, type BuiltInPrompt, type BuiltInPromptKey } from '@/lib/prompt-defaults';

export type ResolvedPrompt = BuiltInPrompt & {
  modeId?: OptimizeModeId;
};

const legacyModeCache = new Map<string, OptimizeModeId | 'unknown'>();

async function mapLegacyPromptId(promptId: string): Promise<OptimizeModeId | null> {
  const cached = legacyModeCache.get(promptId);
  if (cached === 'unknown') return null;
  if (cached) return cached;
  try {
    const [row] = await db
      .select({ id: prompts.id, name: prompts.name, nameEn: prompts.nameEn, isActive: prompts.isActive })
      .from(prompts)
      .where(eq(prompts.id, promptId))
      .limit(1);
    const mapped = resolveOptimizeModeFromName(row?.name) || resolveOptimizeModeFromName(row?.nameEn);
    if (mapped) {
      legacyModeCache.set(promptId, mapped);
      return mapped;
    }
    if (row?.isActive) {
      const def = getDefaultOptimizeMode().id;
      legacyModeCache.set(promptId, def);
      return def;
    }
  } catch {
    // historical table may be unavailable; treat as unknown
  }
  legacyModeCache.set(promptId, 'unknown');
  return null;
}

export async function resolveOptimizeModeId(modeOrPromptId?: string | null): Promise<OptimizeModeId> {
  if (!modeOrPromptId) return getDefaultOptimizeMode().id;
  if (isOptimizeModeId(modeOrPromptId)) return modeOrPromptId;
  if (looksLikeLegacyPromptId(modeOrPromptId)) {
    const mapped = await mapLegacyPromptId(modeOrPromptId);
    if (mapped) return mapped;
  }
  throw new UnknownOptimizeModeError();
}

export async function resolveAiPrompt(key: BuiltInPromptKey, promptId?: string): Promise<ResolvedPrompt> {
  if (key === 'optimize_cv') {
    const modeId = await resolveOptimizeModeId(promptId);
    return getOptimizePrompt(modeId);
  }
  return getBuiltInPrompt(key);
}

export function clearAiPromptsCache() {
  legacyModeCache.clear();
}
