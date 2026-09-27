import { and, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { companyNotes, cvs, jobOffers } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import {
  applicationWritePlan,
  decodeApplicationCursor,
  encodeApplicationCursor,
  assertResourceId,
  buildAgentMatchScore,
  parseAgentStatus,
  type AgentMatchScoreWrite,
  parseBatchEvaluationsBody,
  parseCreateApplicationBody,
  parsePatchApplicationBody,
  type CreateApplicationInput,
  type PatchApplicationInput,
} from '@/lib/agent-api/validate';
import { findOrCreateCompany } from '@/lib/company-service';
import { applicationSummaryColumns, currentMatchScore, type ApplicationSummary } from '@/lib/job-offer-queries';

const AGENT_SOURCE = 'agent_api';

const detailColumns = {
  id: jobOffers.id,
  cvId: jobOffers.cvId,
  title: jobOffers.title,
  company: jobOffers.company,
  companyId: jobOffers.companyId,
  url: jobOffers.url,
  platform: jobOffers.platform,
  status: jobOffers.status,
  description: jobOffers.description,
  source: jobOffers.source,
  scoreOverall: currentMatchScore,
  tldr: jobOffers.tldr,
  nextFollowupDate: jobOffers.nextFollowupDate,
  createdAt: jobOffers.createdAt,
  updatedAt: jobOffers.updatedAt,
};

function publicStatus(status: string) {
  return status.startsWith('archived:') ? 'archived' : status;
}

function toSummary(row: ApplicationSummary) {
  return {
    id: row.id,
    cvId: row.cvId,
    title: row.title,
    company: row.company,
    companyId: row.companyId,
    url: row.url,
    platform: row.platform,
    status: publicStatus(row.status),
    scoreOverall: row.scoreOverall,
    tldr: row.tldr,
    legitimacyTier: row.legitimacyTier,
    livenessStatus: row.livenessStatus,
    nextFollowupDate: row.nextFollowupDate,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === '23505' || candidate.cause?.code === '23505';
}

async function loadSummary(userId: string, offerId: string) {
  const [row] = await db
    .select(applicationSummaryColumns)
    .from(jobOffers)
    .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
    .limit(1);
  return row ? toSummary(row) : null;
}

async function assertOwnedCv(userId: string, cvId: string | null | undefined) {
  if (!cvId) return;
  const [cv] = await db
    .select({ id: cvs.id })
    .from(cvs)
    .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
    .limit(1);
  if (!cv) throw new AgentApiError(400, 'invalid_cv', 'El currículum indicado no pertenece a esta cuenta.');
}

function revalidateApplication(companyId?: string | null, cvId?: string | null) {
  revalidatePath('/dashboard/applications');
  revalidatePath('/dashboard/applications/companies');
  if (companyId) revalidatePath(`/dashboard/applications/companies/${companyId}`);
  if (cvId) revalidatePath('/dashboard');
}

async function findByExternalId(userId: string, externalId: string) {
  const [row] = await db
    .select(applicationSummaryColumns)
    .from(jobOffers)
    .where(and(
      eq(jobOffers.userId, userId),
      eq(jobOffers.externalSource, AGENT_SOURCE),
      eq(jobOffers.externalId, externalId),
    ))
    .limit(1);
  return row ?? null;
}

async function findByUrl(userId: string, url: string) {
  const [row] = await db
    .select(applicationSummaryColumns)
    .from(jobOffers)
    .where(and(eq(jobOffers.userId, userId), eq(jobOffers.url, url)))
    .limit(1);
  return row ?? null;
}

export async function listAgentApplications(
  userId: string,
  query: { status?: string | null; limit: number; cursor?: string | null },
) {
  const filters: SQL[] = [eq(jobOffers.userId, userId)];
  if (query.status) {
    const status = parseAgentStatus(query.status);
    const statusSql = status === 'archived'
      ? or(eq(jobOffers.status, 'archived'), sql`${jobOffers.status} like 'archived:%'`)
      : eq(jobOffers.status, status);
    if (statusSql) filters.push(statusSql);
  }
  if (query.cursor) {
    const decoded = decodeApplicationCursor(query.cursor);
    if (!decoded) throw new AgentApiError(400, 'invalid_cursor', 'El cursor no es válido.');
    const page = or(
      lt(jobOffers.updatedAt, decoded.updatedAt),
      and(eq(jobOffers.updatedAt, decoded.updatedAt), lt(jobOffers.id, decoded.id)),
    );
    if (page) filters.push(page);
  }

  const rows = await db
    .select(applicationSummaryColumns)
    .from(jobOffers)
    .where(and(...filters))
    .orderBy(desc(jobOffers.updatedAt), desc(jobOffers.id))
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit).map(toSummary);
  const last = page[page.length - 1];
  const nextCursor = rows.length > query.limit && last
    ? encodeApplicationCursor(new Date(last.updatedAt), last.id)
    : null;
  return { data: page, nextCursor };
}

export async function getAgentApplication(userId: string, offerId: string) {
  assertResourceId(offerId, 'No se ha encontrado la candidatura.');
  const [row] = await db
    .select(detailColumns)
    .from(jobOffers)
    .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
    .limit(1);
  if (!row) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la candidatura.');
  return { ...row, status: publicStatus(row.status) };
}

async function insertApplication(userId: string, input: CreateApplicationInput, company: { id: string; name: string }) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(jobOffers)
      .values({
        userId,
        title: input.title,
        company: company.name,
        companyId: company.id,
        url: input.url,
        platform: input.platform,
        description: input.description,
        status: input.status,
        source: AGENT_SOURCE,
        externalSource: input.externalId ? AGENT_SOURCE : null,
        externalId: input.externalId,
        cvId: input.cvId,
        nextFollowupDate: input.nextFollowupDate,
        livenessStatus: 'active',
      })
      .returning({ id: jobOffers.id });

    if (input.note) {
      await tx.insert(companyNotes).values({
        userId,
        companyId: company.id,
        content: input.note,
      });
    }
    return created.id;
  });
}

// No usa upsertExternalApplication: si la candidatura ya existe, ese camino
// reescribe descripción, puntuaciones y cartas con null cuando el cuerpo no las trae.
export async function createAgentApplication(userId: string, body: unknown) {
  const input = parseCreateApplicationBody(body);
  await assertOwnedCv(userId, input.cvId);

  const existingExternal = input.externalId ? await findByExternalId(userId, input.externalId) : null;
  const existingUrl = !input.externalId && input.url ? await findByUrl(userId, input.url) : null;
  const plan = applicationWritePlan({
    externalId: input.externalId,
    url: input.url,
    existingByExternalId: Boolean(existingExternal),
    existingByUrl: Boolean(existingUrl),
  });
  if (plan === 'return_existing') {
    const existing = existingExternal ?? existingUrl;
    if (!existing) throw new AgentApiError(500, 'internal', 'No se pudo completar la operación.');
    return { data: toSummary(existing), created: false as const };
  }

  const company = await findOrCreateCompany(userId, input.company);
  if (!company) throw new AgentApiError(400, 'invalid_company', 'El nombre de la empresa no es válido.');
  if (input.note && !company.id) {
    throw new AgentApiError(400, 'note_requires_company', 'La nota necesita una empresa.');
  }

  let offerId: string;
  try {
    offerId = await insertApplication(userId, input, company);
  } catch (error) {
    if (!input.externalId || !isUniqueViolation(error)) throw error;
    const raced = await findByExternalId(userId, input.externalId);
    if (!raced) throw error;
    return { data: toSummary(raced), created: false as const };
  }

  const summary = await loadSummary(userId, offerId);
  if (!summary) throw new AgentApiError(500, 'internal', 'No se pudo completar la operación.');
  revalidateApplication(company.id, input.cvId);
  return { data: summary, created: true as const, note: Boolean(input.note) };
}

export async function updateAgentApplication(userId: string, offerId: string, body: unknown) {
  const input: PatchApplicationInput = parsePatchApplicationBody(body);
  const current = await getAgentApplication(userId, offerId);
  await assertOwnedCv(userId, input.cvId);

  let companyId = current.companyId;
  let companyName = current.company;
  if (input.company) {
    const company = await findOrCreateCompany(userId, input.company);
    if (!company) throw new AgentApiError(400, 'invalid_company', 'El nombre de la empresa no es válido.');
    companyId = company.id;
    companyName = company.name;
  }

  if (input.note && !companyId) {
    throw new AgentApiError(400, 'note_requires_company', 'Esta candidatura no tiene empresa y no admite notas.');
  }

  const fields: {
    updatedAt: Date;
    title?: string;
    company?: string;
    companyId?: string | null;
    url?: string | null;
    platform?: string;
    description?: string | null;
    status?: string;
    cvId?: string | null;
    nextFollowupDate?: Date | null;
    externalSource?: string | null;
    externalId?: string | null;
    scoreOverall?: number | null;
    matchInputHash?: string | null;
    matchEvidence?: AgentMatchScoreWrite['matchEvidence'] | null;
    matchKind?: string | null;
    matchEvaluatedAt?: Date | null;
    tldr?: string | null;
  } = { updatedAt: new Date() };
  const changed: string[] = [];
  if (input.title !== undefined) { fields.title = input.title; changed.push('title'); }
  if (input.company !== undefined) {
    fields.company = companyName;
    fields.companyId = companyId;
    changed.push('company');
  }
  if (input.url !== undefined) { fields.url = input.url; changed.push('url'); }
  if (input.platform !== undefined) { fields.platform = input.platform; changed.push('platform'); }
  if (input.description !== undefined) { fields.description = input.description; changed.push('description'); }
  if (input.status !== undefined) { fields.status = input.status; changed.push('status'); }
  if (input.cvId !== undefined) { fields.cvId = input.cvId; changed.push('cvId'); }
  if (input.nextFollowupDate !== undefined) { fields.nextFollowupDate = input.nextFollowupDate; changed.push('nextFollowupDate'); }
  if (input.externalId !== undefined) {
    fields.externalSource = input.externalId ? AGENT_SOURCE : null;
    fields.externalId = input.externalId;
    changed.push('externalId');
  }
  if (input.scoreOverall !== undefined) {
    if (input.scoreOverall === null) {
      fields.scoreOverall = null;
      fields.matchInputHash = null;
      fields.matchEvidence = null;
      fields.matchKind = null;
      fields.matchEvaluatedAt = null;
    } else {
      const scored = buildAgentMatchScore(userId, current.id, input.scoreOverall);
      fields.scoreOverall = scored.scoreOverall;
      fields.matchInputHash = scored.matchInputHash;
      fields.matchEvidence = scored.matchEvidence;
      fields.matchKind = scored.matchKind;
      fields.matchEvaluatedAt = new Date();
    }
    changed.push('scoreOverall');
  }
  if (input.tldr !== undefined) {
    fields.tldr = input.tldr;
    changed.push('tldr');
  }

  if (input.note && companyId) changed.push('note');

  try {
    await db.transaction(async (tx) => {
      if (changed.some((field) => field !== 'note')) {
        await tx
          .update(jobOffers)
          .set(fields)
          .where(and(eq(jobOffers.id, current.id), eq(jobOffers.userId, userId)));
      } else if (input.note) {
        await tx
          .update(jobOffers)
          .set({ updatedAt: new Date() })
          .where(and(eq(jobOffers.id, current.id), eq(jobOffers.userId, userId)));
      }
      if (input.note && companyId) {
        await tx.insert(companyNotes).values({ userId, companyId, content: input.note });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AgentApiError(400, 'invalid_external_id', 'Ya existe una candidatura con ese identificador.');
    }
    throw error;
  }

  revalidateApplication(companyId, input.cvId ?? current.cvId);
  const data = await getAgentApplication(userId, offerId);
  return { data, changed };
}

export async function batchEvaluateAgentApplications(userId: string, body: unknown) {
  const evaluations = parseBatchEvaluationsBody(body);
  const ids = evaluations.map((item) => item.id);
  const owned = await db
    .select({ id: jobOffers.id })
    .from(jobOffers)
    .where(and(eq(jobOffers.userId, userId), inArray(jobOffers.id, ids)));
  if (owned.length !== ids.length) {
    throw new AgentApiError(404, 'not_found', 'Alguna candidatura no existe o no pertenece a esta cuenta.');
  }

  const now = new Date();
  const updatedCount = await db.transaction(async (tx) => {
    let count = 0;
    for (const item of evaluations) {
      const scored = buildAgentMatchScore(userId, item.id, item.scoreOverall);
      const [updated] = await tx
        .update(jobOffers)
        .set({
          scoreOverall: scored.scoreOverall,
          matchInputHash: scored.matchInputHash,
          matchEvidence: scored.matchEvidence,
          matchKind: scored.matchKind,
          matchEvaluatedAt: now,
          updatedAt: now,
          ...(item.tldr !== undefined ? { tldr: item.tldr } : {}),
        })
        .where(and(eq(jobOffers.id, item.id), eq(jobOffers.userId, userId)))
        .returning({ id: jobOffers.id });
      if (updated) count += 1;
    }
    return count;
  });

  revalidatePath('/dashboard/applications');
  return { updatedCount };
}
