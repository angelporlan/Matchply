'use server';
import { log } from '@/lib/logger';
import { publicErrorBody } from '@/lib/public-errors';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs } from '@/db/schema';
import { requireAccountContext, requireProductContext } from '@/lib/request-context';
import {
  loadAccountSettings,
  loadIntegrationsSettings,
  loadProfileSettings,
  type SettingsTabPayload,
} from '@/lib/settings-data';

export async function loadSettingsTabAction(tab: 'profile' | 'integrations' | 'account'): Promise<
  { success: true; data: SettingsTabPayload } | { error: string }
> {
  try {
    if (tab === 'account' || tab === 'integrations') {
      const ctx = await requireAccountContext();
      const data = tab === 'account'
        ? await loadAccountSettings(ctx.realUser)
        : await loadIntegrationsSettings(ctx.realUser);
      return { success: true, data };
    }
    const ctx = await requireProductContext();
    const data = await loadProfileSettings(ctx.effectiveUser!.id);
    return { success: true, data };
  } catch (error) {
    log({ event: 'product_read_failed', level: 'error', error });
    return { ...publicErrorBody(error) };
  }
}

export async function getOwnedCvContentAction(cvId: string): Promise<
  { success: true; content: string } | { error: string }
> {
  try {
    const ctx = await requireProductContext();
    const userId = ctx.effectiveUser!.id;
    const [row] = await db
      .select({ content: cvs.content })
      .from(cvs)
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .limit(1);
    if (!row) return { error: 'NOT_FOUND' };
    return { success: true, content: row.content };
  } catch (error) {
    log({ event: 'product_read_failed', level: 'error', error });
    return { ...publicErrorBody(error) };
  }
}
