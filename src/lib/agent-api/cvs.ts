import { and, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { cvs } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import {
  copyCvTitle,
  assertResourceId,
  parseCreateCvBody,
  parseCvStylePatch,
} from '@/lib/agent-api/validate';
import type { AgentPrincipal } from '@/lib/api-key-auth';
import { DEFAULT_CV_MARKDOWN } from '@/lib/default-cv';
import { cvListColumns, cvMetaColumns } from '@/lib/job-offer-queries';
import { canCreateCv, canUseCvTemplate } from '@/lib/subscription';

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
  const count = await countCvs(auth.userId);
  if (!canCreateCv(auth.subscriptionStatus, count, entitlement(auth))) {
    throw new AgentApiError(403, 'subscription_required', 'Tu plan no permite crear otro currículum.');
  }

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

  const isFirst = count === 0;
  const [created] = await db
    .insert(cvs)
    .values({
      userId: auth.userId,
      title,
      content,
      isBase: isFirst,
      isPrincipal: isFirst,
      templateName,
      accentColor,
      fontFamily,
      pageMargin,
      scale,
    })
    .returning({
      id: cvs.id,
      title: cvs.title,
      isBase: cvs.isBase,
      isPrincipal: cvs.isPrincipal,
    });

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
    if (makePrincipal) {
      await tx.update(cvs).set({ isPrincipal: false }).where(eq(cvs.userId, auth.userId));
    }
    await tx
      .update(cvs)
      .set({ ...fields, ...(makePrincipal ? { isPrincipal: true } : {}) })
      .where(and(eq(cvs.id, existing.id), eq(cvs.userId, auth.userId)));
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
