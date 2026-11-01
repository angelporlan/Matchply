import { revalidatePath } from 'next/cache';
import { AgentApiError } from '@/lib/agent-api/errors';
import { assertResourceId, parseCompanyRelation, parsePageValue, parsePeopleStatusBody, parsePersonBody } from '@/lib/agent-api/validate';
import { setPeopleStatus } from '@/lib/crm-service';
import { deletePerson, getPerson, linkCompany, linkOffer, listPeople, savePerson } from '@/lib/people/service';
import { PERSON_STATUSES, PeopleError } from '@/lib/people/types';

const PAGE_SIZE = 25;

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === '23505' || candidate.cause?.code === '23505';
}

function revalidatePerson(personId?: string) {
  revalidatePath('/dashboard/applications/people');
  if (personId) revalidatePath(`/dashboard/applications/people/${personId}`);
}

export async function listAgentPeople(userId: string, query: { query: string | null; status: string | null; page: string | null }) {
  if (query.status && !(PERSON_STATUSES as readonly string[]).includes(query.status)) {
    throw new AgentApiError(400, 'invalid_status', 'El estado no es válido.');
  }
  const page = parsePageValue(query.page);
  const result = await listPeople(userId, { query: query.query || undefined, status: query.status || undefined, page });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  return { data: result.items, page: result.page, pageSize: PAGE_SIZE, total: result.total, totalPages };
}

export async function getAgentPerson(userId: string, personId: string) {
  assertResourceId(personId, 'No se ha encontrado la persona.');
  return { data: await getPerson(userId, personId) };
}

async function save(userId: string, body: unknown, personId?: string) {
  const input = parsePersonBody(body);
  try {
    return await savePerson(userId, input, personId);
  } catch (error) {
    if (error instanceof PeopleError) throw error;
    if (isUniqueViolation(error)) throw new PeopleError('PEOPLE_PROFILE_EXISTS', 409);
    throw error;
  }
}

export async function createAgentPerson(userId: string, body: unknown) {
  const row = await save(userId, body);
  revalidatePerson(row.id);
  return { data: row };
}

export async function updateAgentPerson(userId: string, personId: string, body: unknown) {
  assertResourceId(personId, 'No se ha encontrado la persona.');
  const row = await save(userId, body, personId);
  revalidatePerson(personId);
  return { data: row };
}

export async function deleteAgentPerson(userId: string, personId: string) {
  assertResourceId(personId, 'No se ha encontrado la persona.');
  await deletePerson(userId, personId);
  revalidatePerson(personId);
  return { data: { id: personId, deleted: true } };
}

export async function batchSetAgentPeopleStatus(userId: string, body: unknown) {
  const { ids, status } = parsePeopleStatusBody(body);
  let rows: { id: string; status: string }[];
  try {
    rows = await setPeopleStatus(userId, ids, status);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      throw new AgentApiError(404, 'not_found', 'Alguna persona no existe o no pertenece a esta cuenta.');
    }
    throw error;
  }
  revalidatePerson(ids.length === 1 ? ids[0] : undefined);
  return { updatedCount: rows.length, status };
}

export async function linkAgentPersonCompany(userId: string, personId: string, body: unknown) {
  assertResourceId(personId, 'No se ha encontrado la persona.');
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  if (!record) throw new AgentApiError(400, 'invalid_body', 'El cuerpo tiene que ser un objeto JSON.');
  const companyId = record.companyId;
  if (typeof companyId !== 'string') throw new AgentApiError(400, 'invalid_body', 'Indica la empresa.');
  assertResourceId(companyId, 'No se ha encontrado la empresa.');
  const relation = parseCompanyRelation(record.relation);
  await linkCompany(userId, personId, companyId, relation);
  revalidatePerson(personId);
  return { data: { personId, companyId, relation } };
}

export async function linkAgentPersonOffer(userId: string, personId: string, body: unknown) {
  assertResourceId(personId, 'No se ha encontrado la persona.');
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  if (!record || typeof record.offerId !== 'string') throw new AgentApiError(400, 'invalid_body', 'Indica la candidatura.');
  assertResourceId(record.offerId, 'No se ha encontrado la candidatura.');
  await linkOffer(userId, personId, record.offerId);
  revalidatePerson(personId);
  return { data: { personId, offerId: record.offerId } };
}
