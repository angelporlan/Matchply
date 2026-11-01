import { revalidatePath } from 'next/cache';
import { AgentApiError } from '@/lib/agent-api/errors';
import { asRecord, assertResourceId, parseCompanyWrite } from '@/lib/agent-api/validate';
import { CompanyNotFoundError, createCompany, createCompanyNote, deleteCompany, deleteCompanyNote, getOwnedCompany, listCompaniesForUser, listCompanyNotes, updateCompany } from '@/lib/company-service';

function revalidateCompany(companyId?: string) {
  revalidatePath('/dashboard/applications');
  revalidatePath('/dashboard/applications/companies');
  if (companyId) revalidatePath(`/dashboard/applications/companies/${companyId}`);
}

export async function listAgentCompanies(userId: string) {
  return { data: await listCompaniesForUser(userId) };
}

export async function getAgentCompany(userId: string, companyId: string) {
  assertResourceId(companyId, 'No se ha encontrado la empresa.');
  return { data: await getOwnedCompany(userId, companyId) };
}

export async function createAgentCompany(userId: string, body: unknown) {
  const input = parseCompanyWrite(body);
  const created = await createCompany(userId, input);
  revalidateCompany(created.id);
  return { data: created };
}

export async function updateAgentCompany(userId: string, companyId: string, body: unknown) {
  assertResourceId(companyId, 'No se ha encontrado la empresa.');
  const record = asRecord(body);
  const input = parseCompanyWrite(record);
  const current = await getOwnedCompany(userId, companyId);
  const updated = await updateCompany(userId, companyId, {
    name: input.name,
    website: input.website === undefined ? current.website : input.website,
    location: input.location === undefined ? current.location : input.location,
    sector: input.sector === undefined ? current.sector : input.sector,
  });
  revalidateCompany(companyId);
  return { data: updated };
}

export async function deleteAgentCompany(userId: string, companyId: string) {
  assertResourceId(companyId, 'No se ha encontrado la empresa.');
  await deleteCompany(userId, companyId);
  revalidateCompany(companyId);
  return { data: { id: companyId, deleted: true } };
}

export async function listAgentCompanyNotes(userId: string, companyId: string) {
  assertResourceId(companyId, 'No se ha encontrado la empresa.');
  return { data: await listCompanyNotes(userId, companyId) };
}

export async function createAgentCompanyNote(userId: string, companyId: string, body: unknown) {
  assertResourceId(companyId, 'No se ha encontrado la empresa.');
  const record = asRecord(body);
  if (typeof record.content !== 'string') throw new AgentApiError(400, 'invalid_content', 'La nota no es válida.');
  const created = await createCompanyNote(userId, companyId, record.content);
  revalidateCompany(companyId);
  return { data: created };
}

export async function deleteAgentCompanyNote(userId: string, noteId: string) {
  assertResourceId(noteId, 'No se ha encontrado la nota.');
  try {
    const note = await deleteCompanyNote(userId, noteId);
    revalidateCompany(note.companyId);
    return { data: { id: noteId, deleted: true } };
  } catch (error) {
    if (error instanceof CompanyNotFoundError) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la nota.');
    throw error;
  }
}
