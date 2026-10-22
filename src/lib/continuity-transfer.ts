import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { applicationEvents, cvExports, cvExportData, profileEvidence } from '@/db/schema';
import type { ContinuityTx } from '@/lib/application-continuity';

type Row = Record<string, unknown>;
export type ContinuityPackage = { version: 1; exports: Row[]; events: Row[]; evidence: Row[] };
const id = (value: unknown): string => { if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new Error('INVALID_CONTINUITY_ID'); return value; };
const text = (value: unknown, max = 4000): string => { if (typeof value !== 'string' || value.length > max) throw new Error('INVALID_CONTINUITY_TEXT'); return value; };
const date = (value: unknown): Date => { const d = new Date(text(value, 100)); if (!Number.isFinite(d.getTime())) throw new Error('INVALID_CONTINUITY_DATE'); return d; };
export function normalizeContinuityPackage(value: unknown): ContinuityPackage | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || (value as Row).version !== 1) throw new Error('INVALID_CONTINUITY_VERSION');
  const input = value as Row;
  for (const key of ['exports', 'events', 'evidence']) if (!Array.isArray(input[key]) || (input[key] as unknown[]).length > (key === 'events' ? 50000 : 10000) || (input[key] as unknown[]).some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('INVALID_CONTINUITY_LIST');
  return value as ContinuityPackage;
}
export async function importContinuity(tx: ContinuityTx, userId: string, data: ContinuityPackage | null, cvIds: Map<string, string>, offerIds: Map<string, string>) {
  if (!data) return;
  let totalBytes = 0;
  for (const row of data.exports) {
    const exportId = id(row.id); const bytes = text(row.bytes, 16_000_000);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(bytes)) throw new Error('INVALID_CONTINUITY_BYTES');
    const buffer = Buffer.from(bytes, 'base64'); totalBytes += buffer.length;
    if (totalBytes > 50_000_000 || buffer.subarray(0, 5).toString() !== '%PDF-' || row.byteSize !== buffer.length || row.hash !== createHash('sha256').update(buffer).digest('hex')) throw new Error('INVALID_CONTINUITY_PDF');
    const sourceCv = row.cvId == null ? null : cvIds.get(id(row.cvId));
    if (row.cvId != null && !sourceCv) throw new Error('CONTINUITY_CV_NOT_INCLUDED');
    const [existing] = await tx.select({ userId: cvExports.userId, hash: cvExports.hash }).from(cvExports).where(eq(cvExports.id, exportId));
    if (existing) { if (existing.userId !== userId || existing.hash !== row.hash) throw new Error('CONTINUITY_EXPORT_CONFLICT'); continue; }
    if (!Number.isInteger(row.pages) || Number(row.pages) < 1 || Number(row.pages) > 10000) throw new Error('INVALID_CONTINUITY_PAGES');
    let provenance: Record<string, string> | null = null;
    if (row.provenance != null) {
      if (typeof row.provenance !== 'object' || Array.isArray(row.provenance)) throw new Error('INVALID_CONTINUITY_PROVENANCE');
      const original = row.provenance as Row;
      provenance = { cvId: id(original.cvId), ...(original.optimizationId ? { optimizationId: id(original.optimizationId) } : {}), ...(original.modeId ? { modeId: text(original.modeId, 80) } : {}) };
    }
    await tx.insert(cvExports).values({ id: exportId, userId, cvId: sourceCv || null, provenance, hash: text(row.hash, 64), filename: text(row.filename, 500), byteSize: buffer.length, pages: Number(row.pages), createdAt: date(row.createdAt), expiresAt: row.expiresAt == null ? null : date(row.expiresAt) });
    await tx.insert(cvExportData).values({ exportId, bytes });
  }
  const importedExports = new Set(data.exports.map(row => id(row.id)));
  for (const row of data.events) {
    const eventId = id(row.id); const offerId = offerIds.get(id(row.offerId));
    if (!offerId || (row.exportId != null && !importedExports.has(id(row.exportId)))) throw new Error('CONTINUITY_REFERENCE_NOT_INCLUDED');
    if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload) || JSON.stringify(row.payload).length > 20000) throw new Error('INVALID_CONTINUITY_PAYLOAD');
    const [existing] = await tx.select({ userId: applicationEvents.userId, offerId: applicationEvents.offerId, inputHash: applicationEvents.inputHash }).from(applicationEvents).where(eq(applicationEvents.id, eventId));
    if (existing && (existing.userId !== userId || existing.offerId !== offerId || existing.inputHash !== row.inputHash)) throw new Error('CONTINUITY_EVENT_CONFLICT');
    await tx.insert(applicationEvents).values({ id: eventId, userId, offerId, commandId: id(row.commandId), inputHash: text(row.inputHash, 128), kind: text(row.kind, 60), exportId: row.exportId == null ? null : id(row.exportId), payload: row.payload as Row, createdAt: date(row.createdAt) }).onConflictDoNothing();
  }
  for (const row of data.evidence) {
    const evidenceId = id(row.id);
    const [existing] = await tx.select({ userId: profileEvidence.userId, inputHash: profileEvidence.inputHash }).from(profileEvidence).where(eq(profileEvidence.id, evidenceId));
    if (existing && (existing.userId !== userId || existing.inputHash !== row.inputHash)) throw new Error('CONTINUITY_EVIDENCE_CONFLICT');
    await tx.insert(profileEvidence).values({ id: evidenceId, userId, commandId: id(row.commandId), inputHash: text(row.inputHash, 128), requirement: text(row.requirement), example: text(row.example), createdAt: date(row.createdAt) }).onConflictDoNothing();
  }
}
