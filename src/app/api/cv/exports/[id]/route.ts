import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cvExports, cvExportData, applicationEvents } from '@/db/schema';
import { requireProductContext } from '@/lib/request-context';
import { log } from '@/lib/logger';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireProductContext({ allowGuest: true });
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(params.id)) return new Response(null, { status: 404 });
    const [document] = await db.select({ filename: cvExports.filename, bytes: cvExportData.bytes }).from(cvExports)
      .innerJoin(cvExportData, eq(cvExports.id, cvExportData.exportId))
      .where(and(eq(cvExports.id, params.id), eq(cvExports.userId, ctx.effectiveUser!.id), sql`(${cvExports.expiresAt} is null or ${cvExports.expiresAt} > now())`));
    if (!document) return new Response(null, { status: 404 });
    try {
      const [submission] = await db.select({ offerId: applicationEvents.offerId }).from(applicationEvents).where(and(eq(applicationEvents.userId, ctx.effectiveUser!.id), eq(applicationEvents.exportId, params.id), eq(applicationEvents.kind, 'sent'))).limit(1);
      if (submission) await db.insert(applicationEvents).values({ userId: ctx.effectiveUser!.id, offerId: submission.offerId, kind: 'document_viewed', commandId: randomUUID(), inputHash: params.id });
    } catch { log({ event: 'cv_export_view_measurement_failed', level: 'warn' }); }
    return new Response(new Uint8Array(Buffer.from(document.bytes, 'base64')), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { log({ event: 'cv_export_read_failed', level: 'warn', error }); return new Response(null, { status: 403 }); }
}
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireProductContext({ allowGuest: true });
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(params.id)) return new Response(null, { status: 404 });
    const deleted = await db.delete(cvExports).where(and(eq(cvExports.id, params.id), eq(cvExports.userId, ctx.effectiveUser!.id))).returning({ id: cvExports.id });
    return new Response(null, { status: deleted.length ? 204 : 404 });
  } catch (error) { log({ event: 'cv_export_delete_failed', level: 'warn', error }); return new Response(null, { status: 403 }); }
}
