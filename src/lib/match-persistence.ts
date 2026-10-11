import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, cvs, jobOffers, users } from '@/db/schema';
import { parseMatchConstraints } from '@/lib/curation-constraints';
import { baseCvForAiColumns, curateOfferColumns } from '@/lib/job-offer-queries';
import {
  buildCandidateEvidence, buildOfferCard, matchSourceHash,
  isMatchEvidenceSnapshot, isMatchDetails, type CuratedMatchItem,
} from '@/lib/matching';
import { log } from '@/lib/logger';
import { consumeUsageItem } from '@/lib/usage';
import { getCvAccess } from '@/lib/cv-access';

export function mayPersistMatch(input: {
  sourceHash: string; currentSourceHash: string; startedAt: Date;
  previousStartedAt: Date | null; score: number;
}) {
  return Number.isFinite(input.score) && input.score >= 0 && input.score <= 100
    && Number.isFinite(input.startedAt.getTime())
    && input.sourceHash === input.currentSourceHash
    && (!input.previousStartedAt || input.startedAt >= input.previousStartedAt);
}

/** Save only a validated result for the current sources and request generation. */
export async function persistMatchResult(
  userId: string,
  item: CuratedMatchItem,
  lease?: { jobId: string; attempt: number; usageOperationId?: string | null },
): Promise<boolean> {
  if (!isMatchEvidenceSnapshot(item.evidence) || item.evidence.inputHash !== item.inputHash
    || item.evidence.sourceHash !== item.sourceHash || item.evidence.score !== item.score) {
    throw new Error('INVALID_MATCH_SNAPSHOT');
  }
  if (item.details && !isMatchDetails(item.details, item.evidence)) throw new Error('INVALID_MATCH_DETAILS');
  const startedAt = new Date(item.evaluationStartedAt || '');
  const saved = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${userId}`}))`);
    if (lease) {
      const [active] = await tx.select({ id: aiJobs.id }).from(aiJobs).where(and(
        eq(aiJobs.id, lease.jobId), eq(aiJobs.userId, userId), eq(aiJobs.attempt, lease.attempt),
        eq(aiJobs.status, 'running'), gt(aiJobs.leaseUntil, new Date()),
      )).limit(1).for('share');
      if (!active) return false;
    }
    const [user] = await tx.select({ profile: users.careerProfile }).from(users)
      .where(eq(users.id, userId)).limit(1).for('share');
    if (!user) return false;
    const cvAccess = await getCvAccess(userId, tx);
    const [base] = await tx.select(baseCvForAiColumns).from(cvs).where(and(eq(cvs.userId, userId), cvAccess.baseCvId ? eq(cvs.id, cvAccess.baseCvId) : cvAccess.activeIds.length ? inArray(cvs.id, cvAccess.activeIds) : sql`false`))
      .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt), desc(cvs.id)).limit(1).for('share');
    const [offer] = await tx.select(curateOfferColumns).from(jobOffers).where(and(
      eq(jobOffers.id, item.id), eq(jobOffers.userId, userId),
    )).limit(1).for('update');
    if (!offer) return false;
    const constraints = parseMatchConstraints((user.profile as any) || {});
    const candidateEvidence = buildCandidateEvidence(user.profile, base?.content || '', constraints);
    const currentSourceHash = matchSourceHash({ candidateEvidence, offerCard: buildOfferCard(offer, 'triage'), constraints });
    if (!mayPersistMatch({ sourceHash: item.sourceHash, currentSourceHash, startedAt,
      previousStartedAt: offer.matchEvaluatedAt, score: item.score })) return false;
    const compatibleDetails = offer.matchInputHash === item.inputHash && isMatchDetails(offer.matchDetails, item.evidence)
      ? offer.matchDetails : null;
    const details = item.details || compatibleDetails;
    await tx.update(jobOffers).set({
      scoreOverall: item.score, scoreBreakdown: item.scoreBreakdown,
      matchInputHash: item.inputHash, matchEvidence: item.evidence, matchDetails: details,
      matchKind: details ? 'deep' : 'triage', matchEvaluatedAt: startedAt,
      // Existing research text belongs to research, not to the matching cache.
      updatedAt: new Date(),
    }).where(and(eq(jobOffers.id, item.id), eq(jobOffers.userId, userId)));
    if (lease?.usageOperationId) await consumeUsageItem(tx, lease.usageOperationId, item.id, { offerId: item.id, score: item.score });
    return true;
  });
  if (!saved) log({ event: 'match_result_superseded', userId, offerId: item.id });
  return saved;
}
