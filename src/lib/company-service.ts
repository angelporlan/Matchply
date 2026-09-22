import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { companies, companyIcons, companyNotes, jobOffers, userCompanies } from '@/db/schema';
import {
  companyListColumns,
  companyLookupColumns,
  companyNoteColumns,
  type CompanyListRow,
  type CompanyLookupItem,
  type CompanyNoteItem,
} from '@/lib/job-offer-queries';
import { assertCompanyIcon, hashIconBytes } from '@/lib/company-icon';

export const COMPANY_NAME_MAX = 120;
export const COMPANY_FIELD_MAX = 160;
export const COMPANY_NOTE_MAX = 4000;

export type CompanyMissingField = 'website' | 'location' | 'sector' | 'icon';

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

export function missingCompanyFields(row: {
  website: string | null;
  location: string | null;
  sector: string | null;
  iconHash: string | null;
}): CompanyMissingField[] {
  const missing: CompanyMissingField[] = [];
  if (!row.website) missing.push('website');
  if (!row.location) missing.push('location');
  if (!row.sector) missing.push('sector');
  if (!row.iconHash) missing.push('icon');
  return missing;
}

async function ensureUserCompany(userId: string, companyId: string) {
  await db
    .insert(userCompanies)
    .values({ userId, companyId })
    .onConflictDoNothing();
}

async function findCompanyByNormalizedName(nameNormalized: string) {
  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.nameNormalized, nameNormalized))
    .limit(1);
  return existing ?? null;
}

export async function findOrCreateCompany(userId: string, rawName: string) {
  const name = normalizeCompanyName(rawName);
  if (!name) return null;
  const nameNormalized = companyNameKey(name);

  const existing = await findCompanyByNormalizedName(nameNormalized);
  if (existing) {
    await ensureUserCompany(userId, existing.id);
    return existing;
  }

  try {
    const [created] = await db
      .insert(companies)
      .values({ name, nameNormalized })
      .returning();
    await ensureUserCompany(userId, created.id);
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const again = await findCompanyByNormalizedName(nameNormalized);
    if (again) {
      await ensureUserCompany(userId, again.id);
      return again;
    }
    throw error;
  }
}

export async function listCompanyLookups(userId: string): Promise<CompanyLookupItem[]> {
  return db
    .select(companyLookupColumns)
    .from(userCompanies)
    .innerJoin(companies, eq(companies.id, userCompanies.companyId))
    .where(eq(userCompanies.userId, userId))
    .orderBy(asc(companies.name));
}

export async function listCompaniesForUser(userId: string): Promise<CompanyListRow[]> {
  const offerCounts = db
    .select({
      companyId: jobOffers.companyId,
      applicationCount: sql<number>`cast(count(*) as int)`.as('applicationCount'),
    })
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId))
    .groupBy(jobOffers.companyId)
    .as('offer_counts');
  const noteCounts = db
    .select({
      companyId: companyNotes.companyId,
      noteCount: sql<number>`cast(count(*) as int)`.as('noteCount'),
    })
    .from(companyNotes)
    .where(eq(companyNotes.userId, userId))
    .groupBy(companyNotes.companyId)
    .as('note_counts');

  const rows = await db
    .select({
      ...companyListColumns,
      applicationCount: sql<number>`cast(coalesce(${offerCounts.applicationCount}, 0) as int)`,
      noteCount: sql<number>`cast(coalesce(${noteCounts.noteCount}, 0) as int)`,
    })
    .from(userCompanies)
    .innerJoin(companies, eq(companies.id, userCompanies.companyId))
    .leftJoin(offerCounts, eq(offerCounts.companyId, companies.id))
    .leftJoin(noteCounts, eq(noteCounts.companyId, companies.id))
    .where(eq(userCompanies.userId, userId))
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
    .from(userCompanies)
    .innerJoin(companies, eq(companies.id, userCompanies.companyId))
    .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)))
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

async function fillEmptyCompanyFields(
  companyId: string,
  input: { website?: string | null; location?: string | null; sector?: string | null },
) {
  const [existing] = await db
    .select(companyListColumns)
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!existing) return null;

  const website = existing.website ?? optionalField(input.website);
  const location = existing.location ?? optionalField(input.location);
  const sector = existing.sector ?? optionalField(input.sector);
  if (website === existing.website && location === existing.location && sector === existing.sector) {
    return existing;
  }

  const [updated] = await db
    .update(companies)
    .set({ website, location, sector, updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning(companyListColumns);
  return updated ?? existing;
}

export async function createCompany(
  userId: string,
  input: { name: string; website?: string | null; location?: string | null; sector?: string | null },
) {
  const name = normalizeCompanyName(input.name);
  if (!name) throw new CompanyValidationError('COMPANY_NAME_REQUIRED');
  const nameNormalized = companyNameKey(name);

  const existing = await findCompanyByNormalizedName(nameNormalized);
  if (existing) {
    const [membership] = await db
      .select({ companyId: userCompanies.companyId })
      .from(userCompanies)
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, existing.id)))
      .limit(1);
    if (membership) throw new CompanyNameConflictError();
    await ensureUserCompany(userId, existing.id);
    return (await fillEmptyCompanyFields(existing.id, input)) ?? existing;
  }

  try {
    const [created] = await db
      .insert(companies)
      .values({
        name,
        nameNormalized,
        website: optionalField(input.website),
        location: optionalField(input.location),
        sector: optionalField(input.sector),
      })
      .returning(companyListColumns);
    await ensureUserCompany(userId, created.id);
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await findCompanyByNormalizedName(nameNormalized);
    if (!raced) throw error;
    const [membership] = await db
      .select({ companyId: userCompanies.companyId })
      .from(userCompanies)
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, raced.id)))
      .limit(1);
    if (membership) throw new CompanyNameConflictError();
    await ensureUserCompany(userId, raced.id);
    return (await fillEmptyCompanyFields(raced.id, input)) ?? raced;
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
        .where(eq(companies.id, companyId))
        .returning(companyListColumns);

      if (!row) throw new CompanyNotFoundError();

      if (existing.name !== name) {
        await tx
          .update(jobOffers)
          .set({ company: name, updatedAt: new Date() })
          .where(eq(jobOffers.companyId, companyId));
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

  await db
    .delete(companyNotes)
    .where(and(eq(companyNotes.companyId, companyId), eq(companyNotes.userId, userId)));
  await db
    .delete(userCompanies)
    .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)));

  const [[memberships], [offers], [notes]] = await Promise.all([
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(userCompanies).where(eq(userCompanies.companyId, companyId)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(jobOffers).where(eq(jobOffers.companyId, companyId)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(companyNotes).where(eq(companyNotes.companyId, companyId)),
  ]);

  if ((Number(memberships?.count) || 0) === 0 && (Number(offers?.count) || 0) === 0 && (Number(notes?.count) || 0) === 0) {
    await db.delete(companies).where(eq(companies.id, companyId));
  }
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

export async function listIncompleteCompanies(limit = 100) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const rows = await db
    .select(companyListColumns)
    .from(companies)
    .where(sql`coalesce(${companies.website}, '') = '' or coalesce(${companies.location}, '') = '' or coalesce(${companies.sector}, '') = '' or ${companies.iconHash} is null`)
    .orderBy(asc(companies.name))
    .limit(safeLimit);

  return rows.map((row) => ({
    ...row,
    missing: missingCompanyFields(row),
  }));
}

export async function applyCompanyEnrichment(
  companyId: string,
  input: { website?: string | null; location?: string | null; sector?: string | null },
  options: { overwrite?: boolean } = {},
) {
  const [existing] = await db
    .select(companyListColumns)
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!existing) throw new CompanyNotFoundError();

  const overwrite = Boolean(options.overwrite);
  const patch: {
    website?: string | null;
    location?: string | null;
    sector?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.website !== undefined && (overwrite || !existing.website)) {
    patch.website = optionalField(input.website);
  }
  if (input.location !== undefined && (overwrite || !existing.location)) {
    patch.location = optionalField(input.location);
  }
  if (input.sector !== undefined && (overwrite || !existing.sector)) {
    patch.sector = optionalField(input.sector);
  }

  const [updated] = await db
    .update(companies)
    .set(patch)
    .where(eq(companies.id, companyId))
    .returning(companyListColumns);

  return updated ?? existing;
}

export async function saveCompanyIcon(companyId: string, bytes: Buffer, mime?: string | null, options: { overwrite?: boolean } = {}) {
  const [existing] = await db
    .select(companyListColumns)
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!existing) throw new CompanyNotFoundError();
  if (existing.iconHash && !options.overwrite) return existing;

  const resolvedMime = assertCompanyIcon(bytes, mime);
  const iconHash = hashIconBytes(bytes);

  await db.transaction(async (tx) => {
    await tx
      .insert(companyIcons)
      .values({
        companyId,
        mime: resolvedMime,
        bytes: bytes.toString('base64'),
        byteSize: bytes.length,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: companyIcons.companyId,
        set: {
          mime: resolvedMime,
          bytes: bytes.toString('base64'),
          byteSize: bytes.length,
          updatedAt: new Date(),
        },
      });

    await tx
      .update(companies)
      .set({ iconHash, updatedAt: new Date() })
      .where(eq(companies.id, companyId));
  });

  return { ...existing, iconHash };
}

export async function getCompanyIcon(companyId: string) {
  const [row] = await db
    .select({
      mime: companyIcons.mime,
      bytes: companyIcons.bytes,
      byteSize: companyIcons.byteSize,
      iconHash: companies.iconHash,
    })
    .from(companyIcons)
    .innerJoin(companies, eq(companies.id, companyIcons.companyId))
    .where(eq(companyIcons.companyId, companyId))
    .limit(1);
  return row ?? null;
}
