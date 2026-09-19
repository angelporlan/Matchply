import { and, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { canGuestDownloadPdf } from '@/lib/subscription';

export const GUEST_PDF_DOWNLOAD_ACTION = 'cv_download_pdf';

export async function countGuestPdfDownloads(userId: string) {
  const [row] = await db
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
  return canGuestDownloadPdf(await countGuestPdfDownloads(userId));
}

export async function recordGuestPdfDownload(
  userId: string,
  userEmail: string | null,
  details: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
    userId,
    userEmail,
    action: GUEST_PDF_DOWNLOAD_ACTION,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
}
