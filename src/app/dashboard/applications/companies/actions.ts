'use server';

import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';
import { auditActorFields, requireProductContext } from '@/lib/request-context';
import {
  CompanyHasApplicationsError,
  CompanyNameConflictError,
  CompanyNotFoundError,
  CompanyValidationError,
  createCompany,
  createCompanyNote,
  deleteCompany,
  deleteCompanyNote,
  updateCompany,
} from '@/lib/company-service';

function mapCompanyError(error: unknown): { error: string; applicationCount?: number } {
  if (error instanceof CompanyNameConflictError) return { error: 'COMPANY_NAME_CONFLICT' };
  if (error instanceof CompanyNotFoundError) return { error: 'COMPANY_NOT_FOUND' };
  if (error instanceof CompanyHasApplicationsError) {
    return { error: 'COMPANY_HAS_APPLICATIONS', applicationCount: error.applicationCount };
  }
  if (error instanceof CompanyValidationError) return { error: error.message };
  throw error;
}

async function requireCompanyUser() {
  return requireProductContext({ feature: 'applications' });
}

function revalidateCompanies(companyId?: string) {
  revalidatePath('/dashboard/applications');
  revalidatePath('/dashboard/applications/companies');
  if (companyId) revalidatePath(`/dashboard/applications/companies/${companyId}`);
}

export async function createCompanyAction(input: {
  name: string;
  website?: string | null;
  location?: string | null;
  sector?: string | null;
}) {
  try {
    const ctx = await requireCompanyUser();
    const userId = ctx.effectiveUser!.id;
    const company = await createCompany(userId, input);
    await createAuditLog('company_create', userId, ctx.effectiveUser!.email || null, {
      companyId: company.id,
      name: company.name,
    }, auditActorFields(ctx));
    revalidateCompanies(company.id);
    return { success: true as const, company };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Unauthorized' };
    }
    return mapCompanyError(error);
  }
}

export async function updateCompanyAction(
  companyId: string,
  input: {
    name: string;
    website?: string | null;
    location?: string | null;
    sector?: string | null;
  },
) {
  try {
    const ctx = await requireCompanyUser();
    if (ctx.impersonation || ctx.effectiveUser!.role !== 'admin') {
      return { error: 'FORBIDDEN' };
    }
    const userId = ctx.effectiveUser!.id;
    const company = await updateCompany(userId, companyId, input);
    await createAuditLog('company_update', userId, ctx.effectiveUser!.email || null, {
      companyId: company.id,
      name: company.name,
    }, auditActorFields(ctx));
    revalidateCompanies(company.id);
    return { success: true as const, company };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Unauthorized' };
    }
    return mapCompanyError(error);
  }
}

export async function deleteCompanyAction(companyId: string) {
  try {
    const ctx = await requireCompanyUser();
    const userId = ctx.effectiveUser!.id;
    await deleteCompany(userId, companyId);
    await createAuditLog('company_delete', userId, ctx.effectiveUser!.email || null, {
      companyId,
    }, auditActorFields(ctx));
    revalidateCompanies();
    return { success: true as const };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Unauthorized' };
    }
    return mapCompanyError(error);
  }
}

export async function deleteCompaniesAction(companyIds: string[]) {
  try {
    const ctx = await requireCompanyUser();
    const userId = ctx.effectiveUser!.id;
    let deletedCount = 0;
    let skippedCount = 0;
    for (const companyId of companyIds) {
      try {
        await deleteCompany(userId, companyId);
        deletedCount++;
      } catch (err: unknown) {
        if (err instanceof CompanyHasApplicationsError) {
          skippedCount++;
        } else {
          throw err;
        }
      }
    }
    await createAuditLog('company_bulk_delete', userId, ctx.effectiveUser!.email || null, {
      totalRequested: companyIds.length,
      deletedCount,
      skippedCount,
    }, auditActorFields(ctx));
    revalidateCompanies();
    return { success: true as const, deletedCount, skippedCount };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Unauthorized' };
    }
    return mapCompanyError(error);
  }
}

export async function createCompanyNoteAction(companyId: string, content: string) {
  try {
    const ctx = await requireCompanyUser();
    const userId = ctx.effectiveUser!.id;
    const note = await createCompanyNote(userId, companyId, content);
    await createAuditLog('company_note_create', userId, ctx.effectiveUser!.email || null, {
      companyId,
      noteId: note.id,
    }, auditActorFields(ctx));
    revalidateCompanies(companyId);
    return { success: true as const, note };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Unauthorized' };
    }
    return mapCompanyError(error);
  }
}

export async function deleteCompanyNoteAction(noteId: string) {
  try {
    const ctx = await requireCompanyUser();
    const userId = ctx.effectiveUser!.id;
    const note = await deleteCompanyNote(userId, noteId);
    await createAuditLog('company_note_delete', userId, ctx.effectiveUser!.email || null, {
      companyId: note.companyId,
      noteId,
    }, auditActorFields(ctx));
    revalidateCompanies(note.companyId);
    return { success: true as const };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Unauthorized' };
    }
    return mapCompanyError(error);
  }
}
