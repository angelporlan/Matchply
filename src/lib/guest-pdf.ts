import { randomUUID } from 'crypto';
import { and, count, eq, gt, lt } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, usageOperations, usagePeriods } from '@/db/schema';
import { canGuestDownloadPdf } from '@/lib/subscription';
import { lockCvUser } from '@/lib/cv-access';
import { assertUsagePublication } from '@/lib/ai-cv-publication';
import { getUserPlan, type PlanDb } from '@/lib/plan-store';
import { consumeUsage, releaseUsage, UsageError, usageInputHash, type UsageOperation } from '@/lib/usage';

export const GUEST_PDF_DOWNLOAD_ACTION = 'cv_download_pdf';
const PDF_BUCKET = 'guest_pdf';
const DEMO_PERIOD = new Date(0);

export async function countGuestPdfDownloads(userId: string, tx: PlanDb = db) {
  const [row] = await tx
    .select({ value: count() })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, userId),
        eq(auditLogs.action, GUEST_PDF_DOWNLOAD_ACTION),
      ),
    );
  return Number(row?.value || 0);
}

export async function guestHasPdfDownloadRemaining(userId: string) {
  const [downloaded, pending] = await Promise.all([
    countGuestPdfDownloads(userId),
    db.select({ value: count() }).from(usageOperations).where(and(eq(usageOperations.userId, userId), eq(usageOperations.bucket, PDF_BUCKET), eq(usageOperations.status, 'reserved'), gt(usageOperations.expiresAt, new Date()))),
  ]);
  return canGuestDownloadPdf(downloaded + Number(pending[0]?.value ?? 0));
}

/** Reserve the demo's only download before rendering, across processes and tabs. */
export async function beginGuestPdfDownload(userId: string, cvId: string): Promise<UsageOperation> {
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const { user, config } = await getUserPlan(userId, tx);
    if (!user.isGuest) throw new UsageError(409, 'GUEST_SESSION_CHANGED', 'The demo session has changed. Reload to download your resume.');
    // Download recovery must also work when AI workers are deliberately disabled.
    const stale = await tx.select({ id: usageOperations.id }).from(usageOperations).where(and(eq(usageOperations.userId, userId), eq(usageOperations.bucket, PDF_BUCKET), eq(usageOperations.status, 'reserved'), lt(usageOperations.expiresAt, new Date())));
    for (const operation of stale) await releaseUsage(tx, operation.id);
    await tx.insert(usagePeriods).values({ userId, bucket: PDF_BUCKET, periodStart: DEMO_PERIOD }).onConflictDoNothing();
    const [period] = await tx.select().from(usagePeriods).where(and(eq(usagePeriods.userId, userId), eq(usagePeriods.bucket, PDF_BUCKET), eq(usagePeriods.periodStart, DEMO_PERIOD))).for('update').limit(1);
    // Existing demo downloads were recorded in audit_log before reservations existed.
    const used = Math.max(period.used, await countGuestPdfDownloads(userId, tx));
    if (!canGuestDownloadPdf(used + period.reserved)) throw new UsageError(403, 'GUEST_DOWNLOAD_LIMIT', 'GUEST_DOWNLOAD_LIMIT');
    await tx.update(usagePeriods).set({ used, reserved: period.reserved + 1, updatedAt: new Date() }).where(eq(usagePeriods.id, period.id));
    const [operation] = await tx.insert(usageOperations).values({ userId, periodId: period.id, bucket: PDF_BUCKET, requestId: randomUUID(), action: GUEST_PDF_DOWNLOAD_ACTION,
      inputHash: usageInputHash({ cvId }), units: 1, configVersion: config.version, plan: 'guest', expiresAt: new Date(Date.now() + 10 * 60_000) }).returning();
    return operation;
  });
}

export async function completeGuestPdfDownload(
  operation: UsageOperation,
  userEmail: string | null,
  details: Record<string, unknown>,
) {
  await db.transaction(async tx => {
    const ownerId = await assertUsagePublication(tx, operation.userId, operation.id);
    await consumeUsage(tx, operation.id, details);
    await tx.insert(auditLogs).values({
      userId: ownerId,
      userEmail,
      action: GUEST_PDF_DOWNLOAD_ACTION,
      details: JSON.stringify(details),
      createdAt: new Date(),
    });
  });
}

export async function releaseGuestPdfDownload(operationId: string) {
  await db.transaction(tx => releaseUsage(tx, operationId));
}
