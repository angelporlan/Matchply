import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { companies, companyNotes, jobOffers } from '@/db/schema';
import {
  companyListColumns,
  companyLookupColumns,
  companyNoteColumns,
  type CompanyListRow,
  type CompanyLookupItem,
  type CompanyNoteItem,
} from '@/lib/job-offer-queries';

export const COMPANY_NAME_MAX = 120;
export const COMPANY_FIELD_MAX = 160;
export const COMPANY_NOTE_MAX = 4000;

export class CompanyNotFoundError extends Error {
  constructor() {
    super('COMPANY_NOT_FOUND');
    this.name = 'CompanyNotFoundError';
  }
}

export class CompanyNameConflictError extends Error {
  constructor() {
    super('COMPANY_NAME_CONFLICT');
    this.name = 'CompanyNameConflictError';
  }
}

export class CompanyHasApplicationsError extends Error {
  readonly applicationCount: number;

  constructor(applicationCount: number) {
    super('COMPANY_HAS_APPLICATIONS');
    this.name = 'CompanyHasApplicationsError';
    this.applicationCount = applicationCount;
  }
}

export class CompanyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyValidationError';
  }
}

function collapseWhitespace(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompanyName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = collapseWhitespace(raw);
  if (!name || name.length > COMPANY_NAME_MAX) return null;
  return name;
}

export function companyNameKey(name: string): string {
  return name.toLowerCase();
}

function optionalField(raw: unknown, max = COMPANY_FIELD_MAX): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const value = collapseWhitespace(raw);
  if (!value) return null;
  if (value.length > max) {
    throw new CompanyValidationError('COMPANY_FIELD_TOO_LONG');
  }
  return value;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505');
}

export async function findOrCreateCompany(userId: string, rawName: string) {
  const name = normalizeCompanyName(rawName);
  if (!name) return null;
  const nameNormalized = companyNameKey(name);

  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.nameNormalized, nameNormalized)))
    .limit(1);
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(companies)
      .values({ userId, name, nameNormalized })
      .returning();
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [again] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.userId, userId), eq(companies.nameNormalized, nameNormalized)))
      .limit(1);
    if (again) return again;
    throw error;
  }
}

export async function listCompanyLookups(userId: string): Promise<CompanyLookupItem[]> {
  return db
    .select(companyLookupColumns)
    .from(companies)
    .where(eq(companies.userId, userId))
    .orderBy(asc(companies.name));
}

export async function listCompaniesForUser(userId: string): Promise<CompanyListRow[]> {
  const rows = await db
    .select({
      ...companyListColumns,
      applicationCount: sql<number>`cast(count(distinct ${jobOffers.id}) as int)`,
      noteCount: sql<number>`cast(count(distinct ${companyNotes.id}) as int)`,
    })
    .from(companies)
    .leftJoin(jobOffers, eq(jobOffers.companyId, companies.id))
    .leftJoin(companyNotes, eq(companyNotes.companyId, companies.id))
    .where(eq(companies.userId, userId))
    .groupBy(companies.id)
    .orderBy(asc(companies.name));

  return rows.map((row) => ({
    ...row,
    applicationCount: Number(row.applicationCount) || 0,
    noteCount: Number(row.noteCount) || 0,
  }));
}

export async function getOwnedCompany(userId: string, companyId: string) {
  const [company] = await db
    .select(companyListColumns)
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);
  if (!company) throw new CompanyNotFoundError();
  return company;
}

export async function countCompanyApplications(userId: string, companyId: string) {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(jobOffers)
    .where(and(eq(jobOffers.userId, userId), eq(jobOffers.companyId, companyId)));
  return Number(row?.count) || 0;
}

export async function createCompany(
  userId: string,
  input: { name: string; website?: string | null; location?: string | null; sector?: string | null },
) {
  const name = normalizeCompanyName(input.name);
  if (!name) throw new CompanyValidationError('COMPANY_NAME_REQUIRED');
  const nameNormalized = companyNameKey(name);

  try {
    const [created] = await db
      .insert(companies)
      .values({
        userId,
        name,
        nameNormalized,
        website: optionalField(input.website),
        location: optionalField(input.location),
        sector: optionalField(input.sector),
      })
      .returning(companyListColumns);
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new CompanyNameConflictError();
    throw error;
  }
}

export async function updateCompany(
  userId: string,
  companyId: string,
  input: { name: string; website?: string | null; location?: string | null; sector?: string | null },
) {
  const existing = await getOwnedCompany(userId, companyId);
  const name = normalizeCompanyName(input.name);
  if (!name) throw new CompanyValidationError('COMPANY_NAME_REQUIRED');
  const nameNormalized = companyNameKey(name);

  try {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(companies)
        .set({
          name,
          nameNormalized,
          website: optionalField(input.website),
          location: optionalField(input.location),
          sector: optionalField(input.sector),
          updatedAt: new Date(),
        })
        .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
        .returning(companyListColumns);

      if (!row) throw new CompanyNotFoundError();

      if (existing.name !== name) {
        await tx
          .update(jobOffers)
          .set({ company: name, updatedAt: new Date() })
          .where(and(eq(jobOffers.userId, userId), eq(jobOffers.companyId, companyId)));
      }

      return row;
    });

    return updated;
  } catch (error) {
    if (error instanceof CompanyNotFoundError) throw error;
    if (isUniqueViolation(error)) throw new CompanyNameConflictError();
    throw error;
  }
}

export async function deleteCompany(userId: string, companyId: string) {
  await getOwnedCompany(userId, companyId);
  const applicationCount = await countCompanyApplications(userId, companyId);
  if (applicationCount > 0) {
    throw new CompanyHasApplicationsError(applicationCount);
  }

  await db.delete(companies).where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
}

export async function listCompanyNotes(userId: string, companyId: string): Promise<CompanyNoteItem[]> {
  await getOwnedCompany(userId, companyId);
  return db
    .select(companyNoteColumns)
    .from(companyNotes)
    .where(and(eq(companyNotes.companyId, companyId), eq(companyNotes.userId, userId)))
    .orderBy(desc(companyNotes.createdAt));
}

export async function createCompanyNote(userId: string, companyId: string, rawContent: string) {
  await getOwnedCompany(userId, companyId);
  const content = collapseWhitespace(rawContent);
  if (!content) throw new CompanyValidationError('COMPANY_NOTE_REQUIRED');
  if (content.length > COMPANY_NOTE_MAX) throw new CompanyValidationError('COMPANY_NOTE_TOO_LONG');

  const [created] = await db
    .insert(companyNotes)
    .values({ userId, companyId, content })
    .returning(companyNoteColumns);

  await db
    .update(companies)
    .set({ updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  return created;
}

export async function deleteCompanyNote(userId: string, noteId: string) {
  const [note] = await db
    .select({ id: companyNotes.id, companyId: companyNotes.companyId })
    .from(companyNotes)
    .where(and(eq(companyNotes.id, noteId), eq(companyNotes.userId, userId)))
    .limit(1);
  if (!note) throw new CompanyNotFoundError();

  await db.delete(companyNotes).where(eq(companyNotes.id, noteId));
  await db
    .update(companies)
    .set({ updatedAt: new Date() })
    .where(eq(companies.id, note.companyId));

  return note;
}
