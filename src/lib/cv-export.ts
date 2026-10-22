import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cvExports, cvExportData, cvs } from '@/db/schema';
import { lockCvUser } from '@/lib/cv-access';
import { assertUsagePublication } from '@/lib/ai-cv-publication';

export async function storePdfExport(input: { userId: string; cvId: string; buffer: Buffer; filename: string; pages: number; operationId?: string; optimizationId?: string; modeId?: string }) {
  return db.transaction(async tx => {
    await lockCvUser(tx, input.userId);
    const ownerId = input.operationId ? await assertUsagePublication(tx, input.userId, input.operationId) : input.userId;
    const [cv] = await tx.select({ id: cvs.id }).from(cvs).where(and(eq(cvs.id, input.cvId), eq(cvs.userId, ownerId)));
    if (!cv) throw new Error('EXPORT_SOURCE_UNAVAILABLE');
    const hash = createHash('sha256').update(input.buffer).digest('hex');
    const [existing] = await tx.select({ id: cvExports.id }).from(cvExports).where(and(eq(cvExports.userId, ownerId), eq(cvExports.hash, hash), sql`(${cvExports.expiresAt} is null or ${cvExports.expiresAt} > now())`)).limit(1);
    if (existing) return existing.id;
    const provenance = { cvId: cv.id, ...(input.optimizationId ? { optimizationId: input.optimizationId } : {}), ...(input.modeId ? { modeId: input.modeId } : {}) };
    const [document] = await tx.insert(cvExports).values({ userId: ownerId, cvId: cv.id, provenance, hash, filename: input.filename, byteSize: input.buffer.length, pages: input.pages, expiresAt: new Date(Date.now() + 30 * 86400000) }).returning({ id: cvExports.id });
    await tx.insert(cvExportData).values({ exportId: document.id, bytes: input.buffer.toString('base64') });
    return document.id;
  });
}

/** Bounded maintenance; confirmed exports live while at least one submission references them. */
export async function cleanupPdfExports() {
  const result = await db.execute(sql`delete from cv_export where id in (
    select e.id from cv_export e where
      (e."expiresAt" is not null and e."expiresAt" < now())
      or (e."expiresAt" is null and not exists (select 1 from application_event a where a."exportId" = e.id))
    order by e."createdAt" limit 100
  ) returning id`);
  return result.rows.length;
}
