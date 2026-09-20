'use server';

import { eq, gte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { aiRuntimeConfigHistory, aiRuntimeConfigs, aiRunStats } from '@/db/schema';
import { insertCriticalAuditLog } from '@/lib/audit';
import { AIService } from '@/lib/ai-service';
import {
  collectActiveModelRefs,
  defaultAiRuntimeConfig,
  hasSuccessfulModelTest,
  newlyActivatedRefs,
  parseAiRuntimeConfig,
} from '@/lib/ai-runtime-config';
import { clearAiRuntimeCache, getResolvedAiRuntime } from '@/lib/ai-runtime-store';
import { AiConfigConflictError } from '@/lib/request-errors';
import { requireAdminContext, auditActorFields } from '@/lib/request-context';
import { getAllProviderCatalogs } from '@/lib/ai-model-catalog';

export async function loadAiAdminState() {
  await requireAdminContext();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [config, catalogs, history, runStats] = await Promise.all([
    getResolvedAiRuntime(true),
    getAllProviderCatalogs(),
    db.select({
      id: aiRuntimeConfigHistory.id,
      version: aiRuntimeConfigHistory.version,
      createdAt: aiRuntimeConfigHistory.createdAt,
    }).from(aiRuntimeConfigHistory).orderBy(aiRuntimeConfigHistory.version).limit(20),
    db.select({
      functionKey: aiRunStats.functionKey,
      success: aiRunStats.success,
      count: sql<number>`cast(count(*) as int)`,
      avgLatencyMs: sql<number>`avg(${aiRunStats.latencyMs})`,
    }).from(aiRunStats).where(gte(aiRunStats.createdAt, since)).groupBy(aiRunStats.functionKey, aiRunStats.success),
  ]);
  const [row] = await db.select({ version: aiRuntimeConfigs.version, updatedAt: aiRuntimeConfigs.updatedAt }).from(aiRuntimeConfigs).where(eq(aiRuntimeConfigs.id, 1)).limit(1);
  return { config, catalogs, history: history.reverse(), version: row?.version ?? 0, updatedAt: row?.updatedAt ?? null, runStats };
}

export async function testAiModelAction(provider: string, model: string) {
  await requireAdminContext();
  const started = Date.now();
  try {
    const text = await AIService.probeModel(provider, model);
    return {
      success: true,
      sample: (text || '').slice(0, 280),
      latencyMs: Date.now() - started,
      warning: 'Esta prueba consume tokens del proveedor.',
      testedAt: new Date().toISOString(),
      provider,
      model,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'La prueba falló', latencyMs: Date.now() - started };
  }
}

export async function saveAiRuntimeConfigAction(input: { expectedVersion: number; config: unknown }) {
  const { admin, ...ctx } = await requireAdminContext();
  const next = parseAiRuntimeConfig(input.config);
  const current = await getResolvedAiRuntime(true);
  const newRefs = newlyActivatedRefs(current, next);
  for (const ref of newRefs) {
    if (!hasSuccessfulModelTest(next, ref)) {
      return { success: false, error: `Prueba el modelo ${ref.provider}:${ref.model} antes de activarlo.` };
    }
  }

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx.select().from(aiRuntimeConfigs).where(eq(aiRuntimeConfigs.id, 1)).for('update').limit(1);
      const currentVersion = row?.version ?? 0;
      if (currentVersion !== input.expectedVersion) {
        throw new AiConfigConflictError();
      }
      const version = currentVersion + 1;
      const payload = { ...next, version };
      if (row) {
        await tx.update(aiRuntimeConfigs).set({
          version,
          config: payload,
          updatedByUserId: admin.id,
          updatedAt: new Date(),
        }).where(eq(aiRuntimeConfigs.id, 1));
      } else {
        await tx.insert(aiRuntimeConfigs).values({
          id: 1,
          version,
          config: payload,
          updatedByUserId: admin.id,
          updatedAt: new Date(),
        });
      }
      await tx.insert(aiRuntimeConfigHistory).values({
        version,
        config: payload,
        updatedByUserId: admin.id,
      });
      await insertCriticalAuditLog(tx as any, {
        action: 'admin_ai_config_save',
        userId: admin.id,
        userEmail: admin.email,
        details: { version, models: collectActiveModelRefs(payload).map((ref) => `${ref.provider}:${ref.model}`) },
        ...auditActorFields(ctx),
        category: 'admin',
      });
    });
    clearAiRuntimeCache();
    revalidatePath('/admin/ai');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'No se pudo guardar la configuración.' };
  }
}

export async function restoreAiRuntimeConfigAction(version: number) {
  const { admin, ...ctx } = await requireAdminContext();
  const [historic] = await db.select().from(aiRuntimeConfigHistory).where(eq(aiRuntimeConfigHistory.version, version)).limit(1);
  if (!historic) return { success: false, error: 'Versión no encontrada.' };
  return saveAiRuntimeConfigAction({
    expectedVersion: (await db.select({ version: aiRuntimeConfigs.version }).from(aiRuntimeConfigs).where(eq(aiRuntimeConfigs.id, 1)).limit(1))[0]?.version ?? 0,
    config: historic.config,
  });
}

export async function resetAiRuntimeConfigAction() {
  const { admin } = await requireAdminContext();
  void admin;
  const [row] = await db.select({ version: aiRuntimeConfigs.version }).from(aiRuntimeConfigs).where(eq(aiRuntimeConfigs.id, 1)).limit(1);
  return saveAiRuntimeConfigAction({
    expectedVersion: row?.version ?? 0,
    config: defaultAiRuntimeConfig(),
  });
}
