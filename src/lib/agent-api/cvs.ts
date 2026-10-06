import { getUserPlan } from '@/lib/plan-store';
import { and, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { cvs, cvVariants } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import {
  copyCvTitle,
  assertResourceId,
  parseCreateCvBody,
  parseCvStylePatch,
} from '@/lib/agent-api/validate';
import type { AgentPrincipal } from '@/lib/api-key-auth';
import { createManualCvForUser, requireEditableCv } from '@/lib/cv-access';
import { DEFAULT_CV_MARKDOWN } from '@/lib/default-cv';
import { cvListColumns, cvMetaColumns } from '@/lib/job-offer-queries';
import { canUseCvTemplate } from '@/lib/subscription';

async function countCvs(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(cvs)
    .where(eq(cvs.userId, userId));
  return Number(row?.count) || 0;
}

function entitlement(auth: AgentPrincipal) {
  return { isGuest: auth.isGuest, proGrantedUntil: auth.proGrantedUntil };
}

export async function listAgentCvs(userId: string, limit: number) {
  return db
    .select(cvListColumns)
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.updatedAt))
    .limit(limit);
}

async function ownedCv(userId: string, cvId: string) {
  assertResourceId(cvId, 'No se ha encontrado el currículum.');
  const [cv] = await db
    .select(cvMetaColumns)
    .from(cvs)
    .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
    .limit(1);
  if (!cv) throw new AgentApiError(404, 'not_found', 'No se ha encontrado el currículum.');
  return cv;
}

export async function getAgentCv(userId: string, cvId: string) {
  assertResourceId(cvId, 'No se ha encontrado el currículum.');
  const [cv] = await db
    .select({ ...cvMetaColumns, content: cvs.content })
    .from(cvs)
    .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
    .limit(1);
  if (!cv) throw new AgentApiError(404, 'not_found', 'No se ha encontrado el currículum.');
  return cv;
}

export async function createAgentCv(auth: AgentPrincipal, body: unknown) {
  const input = parseCreateCvBody(body);
  let content = input.content ?? DEFAULT_CV_MARKDOWN;
  let title = input.title ?? '';
  let templateName = 'harvard';
  let accentColor: string | null = '#1a5f7a';
  let fontFamily: string | null = 'helvetica';
  let pageMargin = 36;
  let scale = 1;

  if (input.duplicateFromId) {
    const source = await getAgentCv(auth.userId, input.duplicateFromId);
    content = input.content ?? source.content;
    title = input.title ?? copyCvTitle(source.title);
    templateName = source.templateName;
    accentColor = source.accentColor;
    fontFamily = source.fontFamily;
    pageMargin = source.pageMargin ?? 36;
    scale = source.scale ?? 1;
  }
  if (!title) {
    throw new AgentApiError(400, 'invalid_title', 'El título del currículum no es válido.');
  }

  const cv = await createManualCvForUser(auth.userId, { title, content, templateName, accentColor, fontFamily, pageMargin, scale });
  const created = { id: cv.id, title: cv.title, isBase: cv.isBase, isPrincipal: cv.isPrincipal };

  revalidatePath('/dashboard');
  return created;
}

export async function updateAgentCv(auth: AgentPrincipal, cvId: string, body: unknown) {
  const existing = await ownedCv(auth.userId, cvId);
  const patch = parseCvStylePatch(body && typeof body === 'object' ? body as Record<string, unknown> : {});
  if (patch.templateName && !canUseCvTemplate(auth.subscriptionStatus, patch.templateName, entitlement(auth))) {
    throw new AgentApiError(400, 'invalid_template', 'La única plantilla disponible es Harvard.');
  }

  const fields = { ...patch };
  const makePrincipal = fields.isPrincipal === true;
  delete fields.isPrincipal;

  await db.transaction(async (tx) => {
    const editable = await requireEditableCv(tx, auth.userId, cvId);
    if (editable.pendingUsageOperationId) throw new AgentApiError(409, 'operation_in_progress', 'This resume is being generated');
    if (fields.isBase !== undefined && fields.isBase !== editable.isBase) {
      const { limits } = await getUserPlan(auth.userId, tx);
      const [{ count }] = await tx.select({ count: sql<number>`cast(count(*) as int)` }).from(cvs).where(and(eq(cvs.userId, auth.userId), eq(cvs.isBase, fields.isBase)));
      const cap = fields.isBase ? limits.maxBaseCvs : limits.maxAdaptedCvs;
      if (cap !== null && count >= cap) throw new AgentApiError(403, "cv_limit", "Your resume capacity is exhausted");
    }
    if (makePrincipal) {
      await tx.update(cvs).set({ isPrincipal: false, updatedAt: sql`${cvs.updatedAt}` }).where(eq(cvs.userId, auth.userId));
    }
    await tx
      .update(cvs)
      .set({ ...fields, ...(makePrincipal ? { isPrincipal: true } : {}) })
      .where(and(eq(cvs.id, existing.id), eq(cvs.userId, auth.userId)));
    if (fields.content !== undefined) {
      const [current] = await tx.select({ optimizationId: cvs.optimizationId, modeId: cvs.activeOptimizeMode }).from(cvs).where(eq(cvs.id, existing.id)).limit(1);
      if (current.optimizationId && current.modeId) await tx.update(cvVariants).set({ content: fields.content, revision: sql`${cvVariants.revision} + 1`, updatedAt: new Date() }).where(and(eq(cvVariants.optimizationId, current.optimizationId), eq(cvVariants.modeId, current.modeId)));
    }
  });

  revalidatePath('/dashboard');
  revalidatePath(`/editor/${existing.id}`);

  return {
    id: existing.id,
    title: patch.title ?? existing.title,
    isBase: patch.isBase ?? existing.isBase,
    isPrincipal: makePrincipal ? true : existing.isPrincipal,
    updatedFields: [...Object.keys(patch), ...(makePrincipal ? ['isPrincipal'] : [])],
  };
}
