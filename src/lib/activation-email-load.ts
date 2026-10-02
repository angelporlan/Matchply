import { and, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, jobOffers, users } from '@/db/schema';
import { auditRowValues } from '@/lib/audit';
import {
  ACTIVATION_EMAIL_DAY1,
  ACTIVATION_EMAIL_FOLLOWUP,
  ACTIVATION_EMAIL_OPT_OUT,
  activationOptOutPath,
  assembleActivationCandidates,
  buildActivationEmail,
  cvIdFromAuditDetails,
  DAY1_MAX_AGE_MS,
  DAY1_MIN_AGE_MS,
  FOLLOWUP_LOOKBACK_MS,
  isActivationEmailEnabled,
  type ActivationEmailCandidate,
  type ActivationEmailPlan,
  type ActivationMarkerRow,
  type ActivationOfferRow,
  type ActivationPdfRow,
  type ActivationUserRow,
} from '@/lib/activation-email';

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function queryRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

async function firstPdfsInDay1Window(now: Date): Promise<Array<{ userId: string; firstPdfAt: Date }>> {
  const from = new Date(now.getTime() - DAY1_MAX_AGE_MS);
  const to = new Date(now.getTime() - DAY1_MIN_AGE_MS);
  const result = await db.execute(sql`
    SELECT "userId" AS "userId", MIN("createdAt") AS "firstPdfAt"
    FROM audit_log
    WHERE action = 'cv_download_pdf' AND "userId" IS NOT NULL
    GROUP BY "userId"
    HAVING MIN("createdAt") >= ${from} AND MIN("createdAt") < ${to}
  `);
  return queryRows(result).flatMap((row) => {
    const userId = typeof row.userId === 'string' ? row.userId : null;
    const firstPdfAt = asDate(row.firstPdfAt);
    if (!userId || !firstPdfAt) return [];
    return [{ userId, firstPdfAt }];
  });
}

export async function loadActivationEmailCandidates(now: Date): Promise<ActivationEmailCandidate[]> {
  const firstPdfs = await firstPdfsInDay1Window(now);
  const followupFrom = new Date(now.getTime() - FOLLOWUP_LOOKBACK_MS);
  const offers = await db
    .select({
      id: jobOffers.id,
      userId: jobOffers.userId,
      cvId: jobOffers.cvId,
      status: jobOffers.status,
      nextFollowupDate: jobOffers.nextFollowupDate,
    })
    .from(jobOffers)
    .where(and(
      eq(jobOffers.status, 'applied'),
      isNotNull(jobOffers.nextFollowupDate),
      gte(jobOffers.nextFollowupDate, followupFrom),
      lte(jobOffers.nextFollowupDate, now),
    ));

  const userIds = Array.from(new Set([
    ...firstPdfs.map((row) => row.userId),
    ...offers.map((offer) => offer.userId),
  ]));
  if (userIds.length === 0) return [];

  const people = await db
    .select({ id: users.id, email: users.email, isGuest: users.isGuest })
    .from(users)
    .where(inArray(users.id, userIds));

  const pdfUserIds = firstPdfs.map((row) => row.userId);
  const downloads = pdfUserIds.length === 0 ? [] : await db
    .select({
      userId: auditLogs.userId,
      createdAt: auditLogs.createdAt,
      details: auditLogs.details,
    })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.action, 'cv_download_pdf'),
      inArray(auditLogs.userId, pdfUserIds),
    ));
  const linkedOffers = pdfUserIds.length === 0 ? [] : await db
    .select({
      id: jobOffers.id,
      userId: jobOffers.userId,
      cvId: jobOffers.cvId,
      updatedAt: jobOffers.updatedAt,
    })
    .from(jobOffers)
    .where(inArray(jobOffers.userId, pdfUserIds));

  const markers = await db
    .select({
      userId: auditLogs.userId,
      action: auditLogs.action,
      details: auditLogs.details,
    })
    .from(auditLogs)
    .where(and(
      inArray(auditLogs.userId, userIds),
      inArray(auditLogs.action, [ACTIVATION_EMAIL_OPT_OUT, ACTIVATION_EMAIL_DAY1, ACTIVATION_EMAIL_FOLLOWUP]),
    ));

  const earliestDownload = new Map<string, { createdAt: Date; details: string | null }>();
  for (const row of downloads) {
    if (!row.userId) continue;
    const current = earliestDownload.get(row.userId);
    if (!current || row.createdAt.getTime() < current.createdAt.getTime()) {
      earliestDownload.set(row.userId, { createdAt: row.createdAt, details: row.details });
    }
  }

  const offerByCv = new Map<string, { id: string; updatedAt: number }>();
  for (const offer of linkedOffers) {
    if (!offer.cvId) continue;
    const key = `${offer.userId}:${offer.cvId}`;
    const current = offerByCv.get(key);
    const updatedAt = offer.updatedAt.getTime();
    if (!current || updatedAt >= current.updatedAt) offerByCv.set(key, { id: offer.id, updatedAt });
  }

  const pdfs: ActivationPdfRow[] = firstPdfs.map((row) => {
    const cvId = cvIdFromAuditDetails(earliestDownload.get(row.userId)?.details || null);
    return {
      userId: row.userId,
      firstPdfAt: row.firstPdfAt,
      cvId,
      offerId: cvId ? offerByCv.get(`${row.userId}:${cvId}`)?.id || null : null,
    };
  });

  const offerRows: ActivationOfferRow[] = offers.flatMap((offer) => {
    if (!offer.nextFollowupDate) return [];
    return [{
      id: offer.id,
      userId: offer.userId,
      cvId: offer.cvId,
      status: offer.status,
      nextFollowupDate: offer.nextFollowupDate,
    }];
  });

  const userRows: ActivationUserRow[] = people;
  const markerRows: ActivationMarkerRow[] = markers;
  return assembleActivationCandidates({
    users: userRows,
    pdfs,
    offers: offerRows,
    markers: markerRows,
  });
}

export async function recordActivationEmailAudit(input: {
  action: typeof ACTIVATION_EMAIL_OPT_OUT | typeof ACTIVATION_EMAIL_DAY1 | typeof ACTIVATION_EMAIL_FOLLOWUP;
  userId: string;
  email: string | null;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values(auditRowValues({
    action: input.action,
    userId: input.userId,
    userEmail: input.email,
    details: input.details,
  }));
}

export async function deliverActivationEmail(plan: ActivationEmailPlan) {
  const env = process.env;
  if (!isActivationEmailEnabled(env)) {
    throw new Error('activation_email_disabled');
  }
  const appUrl = (env.NEXTAUTH_URL || env.APP_URL || '').replace(/\/$/, '');
  const secret = env.NEXTAUTH_SECRET || '';
  const message = buildActivationEmail({
    kind: plan.kind,
    language: 'es',
    appUrl,
    cvId: plan.cvId,
    offerId: plan.offerId,
    optOutUrl: `${appUrl}${activationOptOutPath(plan.userId, secret)}`,
  });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.ACTIVATION_EMAIL_FROM,
      to: [plan.email],
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`activation_email_provider_${response.status}`);
  }
  await recordActivationEmailAudit({
    action: plan.kind === 'day1_pdf' ? ACTIVATION_EMAIL_DAY1 : ACTIVATION_EMAIL_FOLLOWUP,
    userId: plan.userId,
    email: plan.email,
    details: { kind: plan.kind, cvId: plan.cvId, offerId: plan.offerId },
  });
}
