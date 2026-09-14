"use server";

import { and, eq, inArray } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { jobOffers, cvs } from '@/db/schema';

export async function getOffersExportDataAction(
  offerIds: string[],
): Promise<{ success: boolean; data?: Record<string, unknown>[]; error?: string }> {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (!offerIds || offerIds.length === 0) {
      return { success: true, data: [] };
    }

    // Limit to reasonable batch size
    const safeIds = offerIds.slice(0, 1000);

    const rows = await db
      .select({
        id: jobOffers.id,
        title: jobOffers.title,
        company: jobOffers.company,
        status: jobOffers.status,
        url: jobOffers.url,
        platform: jobOffers.platform,
        scoreOverall: jobOffers.scoreOverall,
        createdAt: jobOffers.createdAt,
        updatedAt: jobOffers.updatedAt,
        nextFollowupDate: jobOffers.nextFollowupDate,
        description: jobOffers.description,
        tldr: jobOffers.tldr,
        coverLetter: jobOffers.coverLetter,
        outreachMessage: jobOffers.outreachMessage,
        cvTitle: cvs.title,
      })
      .from(jobOffers)
      .leftJoin(cvs, eq(jobOffers.cvId, cvs.id))
      .where(and(
        eq(jobOffers.userId, session.user.id),
        inArray(jobOffers.id, safeIds),
      ));

    // Preserve the selection order
    const rowMap = new Map(rows.map((r) => [r.id, r]));
    const ordered = safeIds
      .map((id) => rowMap.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    return { success: true, data: ordered };
  } catch (error: any) {
    console.error('[export-actions] Error fetching export data:', error);
    return { success: false, error: error.message || 'FAILED_TO_EXPORT' };
  }
}
