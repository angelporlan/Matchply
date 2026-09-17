'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';
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
import { requireUserFeature } from '@/lib/permissions';

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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  await requireUserFeature(session.user.id, 'applications');
  return session;
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
    const session = await requireCompanyUser();
    const company = await createCompany(session.user.id, input);
    await createAuditLog('company_create', session.user.id, session.user.email || null, {
      companyId: company.id,
      name: company.name,
    });
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
    const session = await requireCompanyUser();
    const company = await updateCompany(session.user.id, companyId, input);
    await createAuditLog('company_update', session.user.id, session.user.email || null, {
      companyId: company.id,
      name: company.name,
    });
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
    const session = await requireCompanyUser();
    await deleteCompany(session.user.id, companyId);
    await createAuditLog('company_delete', session.user.id, session.user.email || null, {
      companyId,
    });
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
    const session = await requireCompanyUser();
    let deletedCount = 0;
    let skippedCount = 0;
    for (const companyId of companyIds) {
      try {
        await deleteCompany(session.user.id, companyId);
        deletedCount++;
      } catch (err: unknown) {
        if (err instanceof CompanyHasApplicationsError) {
          skippedCount++;
        } else {
          throw err;
        }
      }
    }
    await createAuditLog('company_bulk_delete', session.user.id, session.user.email || null, {
      totalRequested: companyIds.length,
      deletedCount,
      skippedCount,
    });
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
    const session = await requireCompanyUser();
    const note = await createCompanyNote(session.user.id, companyId, content);
    await createAuditLog('company_note_create', session.user.id, session.user.email || null, {
      companyId,
      noteId: note.id,
    });
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
    const session = await requireCompanyUser();
    const note = await deleteCompanyNote(session.user.id, noteId);
    await createAuditLog('company_note_delete', session.user.id, session.user.email || null, {
      companyId: note.companyId,
      noteId,
    });
    revalidateCompanies(note.companyId);
    return { success: true as const };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: 'Unauthorized' };
    }
    return mapCompanyError(error);
  }
}
