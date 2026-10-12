import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, cvs, jobOffers, users, type AiJob } from '@/db/schema';
import { getCvAccess } from '@/lib/cv-access';
import { baseCvForAiColumns } from '@/lib/job-offer-queries';
import { parseMatchConstraints } from '@/lib/curation-constraints';
import { buildCandidateEvidence, buildOfferCard, matchSourceHash, isMatchEvidenceSnapshot, type CuratedMatchItem } from '@/lib/matching';
import { getResolvedAiRuntime, bindAiRuntime } from '@/lib/ai-runtime-store';
import { requireUserFeature } from '@/lib/permissions';
import { reserveUsage, consumeUsage } from '@/lib/usage';
import { AiUsageHttpError } from '@/lib/ai-usage-http';
import { AIService } from '@/lib/ai-service';
import { effectiveSubscriptionStatus } from '@/lib/subscription';
import { saveAiJobProgress } from '@/lib/ai-jobs/queue';
import { findOrCreateCompany } from '@/lib/company-service';
import { linkedInJobId } from '@/lib/offer-import/types';
import { discoveryApiKey, discoveryIdentity, discoveredOfferDescription, offerPlatform, searchMatchingOffers, type DiscoveredOffer } from './search';
import { DISCOVERY_MAX_OFFERS, DISCOVERY_MIN_SCORE, DISCOVERY_MODEL, DiscoveryError, initialDiscoveryProgress, type DiscoverOffersPayload, type DiscoveryProgress } from './types';

async function loadCandidate(userId: string, executor: typeof db = db, lock = false) {
  const access = await getCvAccess(userId, executor);
  const userQuery = executor.select({ careerProfile: users.careerProfile, subscriptionStatus: users.subscriptionStatus,
    isGuest: users.isGuest, proGrantedUntil: users.proGrantedUntil, accountStatus: users.accountStatus,
  }).from(users).where(eq(users.id, userId)).limit(1);
  const [user] = await (lock ? userQuery.for('share') : userQuery);
  if (!user || user.accountStatus !== 'active') throw new DiscoveryError('DISCOVERY_FORBIDDEN');
  const cvQuery = executor.select(baseCvForAiColumns).from(cvs).where(and(eq(cvs.userId, userId),
    access.baseCvId ? eq(cvs.id, access.baseCvId) : sql`false`,
  )).orderBy(desc(cvs.isBase), desc(cvs.isPrincipal)).limit(1);
  const [cv] = await (lock ? cvQuery.for('share') : cvQuery);
  const evidence = buildCandidateEvidence(user.careerProfile, cv?.content || '', parseMatchConstraints(user.careerProfile || {}));
  if (!evidence.sufficient) throw new AiUsageHttpError(400, 'DISCOVERY_PROFILE_REQUIRED', 'Añade tu CV o completa tu experiencia en el perfil antes de buscar.');
  return { user, cv, evidence };
}

export async function enqueueDiscovery(userId: string, payload: DiscoverOffersPayload, initiatedByUserId: string) {
  await requireUserFeature(userId, 'applications');
  const runtime = await getResolvedAiRuntime();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`discovery:${userId}`}))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${userId}`}))`);
    const [existing] = await tx.select().from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'discover_offers'),
      sql`${aiJobs.payload}->>'requestId' = ${payload.requestId}`,
    )).limit(1);
    if (existing) return existing;
    // Double clicks and independent tabs join the ongoing search.
    const [active] = await tx.select().from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'discover_offers'),
      inArray(aiJobs.status, ['queued', 'running']),
    )).limit(1);
    if (active) return active;
    discoveryApiKey();
    await loadCandidate(userId, tx);
    const id = randomUUID();
    // One general AI operation includes discovery and its bounded initial scoring.
    const operation = await reserveUsage(tx, userId, { bucket: 'general', requestId: payload.requestId, action: 'discover_offers', input: payload, jobId: id });
    const ref = { provider: 'openai' as const, model: DISCOVERY_MODEL };
    const [job] = await tx.insert(aiJobs).values({ id, userId, initiatedByUserId, kind: 'discover_offers', payload,
      usageOperationId: operation.id, resolvedAiConfig: { ...runtime, overrides: { ...runtime.overrides, matching: { free: ref, pro: ref } } },
      status: 'queued', nextAttemptAt: new Date(), result: initialDiscoveryProgress(),
    }).returning();
    return job;
  });
}

export async function latestDiscovery(userId: string) {
  const [job] = await db.select({ id: aiJobs.id, status: aiJobs.status, result: aiJobs.result, lastError: aiJobs.lastError })
    .from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'discover_offers')))
    .orderBy(desc(aiJobs.createdAt)).limit(1);
  return job ?? null;
}

function externalIdentity(offer: DiscoveredOffer) {
  const linkedinId = linkedInJobId(offer.url);
  return linkedinId ? { externalSource: 'linkedin', externalId: linkedinId }
    : { externalSource: 'offer_discovery', externalId: createHash('sha256').update(discoveryIdentity(offer.url)).digest('hex') };
}

/** Query only matching URL paths/identities, including archived offers; never load the user's whole board. */
async function existingOfferKeys(userId: string, offers: DiscoveredOffer[], executor: typeof db = db) {
  if (!offers.length) return new Set<string>();
  const conditions = offers.map(offer => {
    const identity = externalIdentity(offer);
    const linkedinId = linkedInJobId(offer.url);
    const url = new URL(offer.url);
    const path = `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
    return or(and(eq(jobOffers.externalSource, identity.externalSource), eq(jobOffers.externalId, identity.externalId)),
      ...(linkedinId ? [sql`${jobOffers.url} ~* ${`^https?://([^/]+\.)?linkedin\.com/jobs/view/([^/]*-)?${linkedinId}([/?#]|$)`}`] : []),
      sql`rtrim(split_part(split_part(regexp_replace(${jobOffers.url}, '^https?://(www\.)?', ''), '?', 1), '#', 1), '/') = ${path}`);
  });
  const existing = await executor.select({ url: jobOffers.url, externalSource: jobOffers.externalSource, externalId: jobOffers.externalId })
    .from(jobOffers).where(and(eq(jobOffers.userId, userId), or(...conditions)));
  const keys = new Set<string>();
  for (const row of existing) {
    if (row.url) try { keys.add(discoveryIdentity(row.url)); } catch { /* Legacy URLs can be malformed. */ }
    if (row.externalSource === 'linkedin' && row.externalId) keys.add(`linkedin:${row.externalId}`);
    for (const offer of offers) {
      const identity = externalIdentity(offer);
      if (row.externalSource === identity.externalSource && row.externalId === identity.externalId) keys.add(discoveryIdentity(offer.url));
    }
  }
  return keys;
}

export function selectDiscoveryMatches(items: CuratedMatchItem[]) {
  return items.filter(item => item.score >= DISCOVERY_MIN_SCORE && item.decision === 'keep' &&
    isMatchEvidenceSnapshot(item.evidence) && item.evidence.score === item.score &&
    item.evidence.inputHash === item.inputHash && item.evidence.sourceHash === item.sourceHash)
    .sort((a, b) => b.score - a.score).slice(0, DISCOVERY_MAX_OFFERS);
}

export async function publishDiscovery(job: AiJob, candidateHash: string, offers: Array<DiscoveredOffer & { id: string }>, matches: CuratedMatchItem[], progress: DiscoveryProgress): Promise<DiscoveryProgress> {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`usage:${job.userId}`}))`);
    const [owned] = await tx.select({ result: aiJobs.result }).from(aiJobs).where(and(eq(aiJobs.id, job.id), eq(aiJobs.userId, job.userId),
      eq(aiJobs.status, 'running'), eq(aiJobs.attempt, job.attempt), gt(aiJobs.leaseUntil, new Date()),
    )).for('update').limit(1);
    if (!owned) throw new DiscoveryError('DISCOVERY_LEASE_LOST');
    const previous = owned.result as DiscoveryProgress | null;
    if (previous?.published) return previous;
    const current = await loadCandidate(job.userId, tx, true);
    if (current.evidence.sourceHash !== candidateHash) throw new DiscoveryError('DISCOVERY_PROFILE_CHANGED');
    const existing = await existingOfferKeys(job.userId, offers, tx);
    const result: DiscoveryProgress = { ...progress, added: [], stage: 'completed', published: true };
    // Offer data, validated score, result and usage commit together.
    for (const match of selectDiscoveryMatches(matches)) {
      const offer = offers.find(item => item.id === match.id);
      if (!offer) throw new DiscoveryError('DISCOVERY_INVALID_RESPONSE');
      const sourceHash = matchSourceHash({ candidateEvidence: current.evidence,
        offerCard: buildOfferCard({ ...offer, description: discoveredOfferDescription(offer), platform: offerPlatform(offer.url) }, 'triage'),
        constraints: parseMatchConstraints(current.user.careerProfile || {}),
      });
      if (sourceHash !== match.sourceHash) throw new DiscoveryError('DISCOVERY_INVALID_RESPONSE');
      if (existing.has(discoveryIdentity(offer.url))) { result.duplicates++; continue; }
      const company = await findOrCreateCompany(job.userId, offer.company, tx);
      const [created] = await tx.insert(jobOffers).values({
        id: match.id, userId: job.userId, title: offer.title, company: offer.company, companyId: company?.id ?? null,
        url: offer.url, platform: offerPlatform(offer.url), description: discoveredOfferDescription(offer), status: 'interested',
        source: 'openai_web_search', ...externalIdentity(offer), livenessStatus: 'active',
        sourceMetadata: { method: 'web_search', model: DISCOVERY_MODEL, discoveryJobId: job.id, retrievedAt: new Date().toISOString(),
          sources: offer.sources, location: offer.location, workplace: offer.workplace, salary: offer.salary,
          publishedAt: offer.publishedAt, closingDate: offer.closingDate },
        scoreOverall: match.score, scoreBreakdown: match.scoreBreakdown, matchInputHash: match.inputHash,
        matchEvidence: match.evidence, matchKind: 'triage', matchEvaluatedAt: new Date(match.evaluationStartedAt || job.createdAt),
        tldr: match.fitReason || null,
      }).onConflictDoNothing().returning({ id: jobOffers.id });
      if (created) result.added.push({ id: created.id, title: offer.title, company: offer.company, url: offer.url, score: match.score });
      else result.duplicates++;
    }
    if (job.usageOperationId) await consumeUsage(tx, job.usageOperationId, result);
    await tx.update(aiJobs).set({ result, updatedAt: new Date() }).where(eq(aiJobs.id, job.id));
    return result;
  });
}

export async function processDiscovery(job: AiJob, signal: AbortSignal, dependencies: {
  search?: typeof searchMatchingOffers;
  score?: typeof AIService.curateOffersBatch;
} = {}): Promise<DiscoveryProgress> {
  const previous = job.result as DiscoveryProgress | null;
  if (previous?.published) return previous;
  await requireUserFeature(job.userId, 'applications');
  const candidate = await loadCandidate(job.userId);
  let progress = { ...initialDiscoveryProgress(), stage: 'searching' as const } as DiscoveryProgress;
  const save = async (stage: DiscoveryProgress['stage']) => {
    signal.throwIfAborted();
    progress = { ...progress, stage };
    if (!await saveAiJobProgress(job, progress)) throw new DiscoveryError('DISCOVERY_LEASE_LOST');
  };
  await save('searching');
  const found = await (dependencies.search ?? searchMatchingOffers)(candidate.evidence.card, { signal });
  signal.throwIfAborted();
  progress.found = found.length;
  const existing = await existingOfferKeys(job.userId, found);
  progress.duplicates = found.filter(offer => existing.has(discoveryIdentity(offer.url))).length;
  const offers = found.filter(offer => !existing.has(discoveryIdentity(offer.url))).map(offer => ({ ...offer, id: randomUUID() }));
  await save('scoring');
  // Share the same rubric, evidence validation and versioned cache as manual matching.
  const ref = { provider: 'openai' as const, model: DISCOVERY_MODEL };
  const runtime = await getResolvedAiRuntime();
  const scoring = await bindAiRuntime({ ...runtime, overrides: { ...runtime.overrides, matching: { free: ref, pro: ref } } }, () =>
    (dependencies.score ?? AIService.curateOffersBatch.bind(AIService))({
      baseCvMarkdown: candidate.cv?.content || '', userCareerProfile: candidate.user.careerProfile,
      userSubscriptionStatus: effectiveSubscriptionStatus(candidate.user), targetThreshold: DISCOVERY_MIN_SCORE,
      offers: offers.map(offer => ({ ...offer, description: discoveredOfferDescription(offer), platform: offerPlatform(offer.url) })),
      kind: 'triage', evaluationStartedAt: job.createdAt.toISOString(),
    }),
  );
  progress.belowThreshold = scoring.curated.filter(item => item.score < DISCOVERY_MIN_SCORE || item.decision !== 'keep').length;
  progress.evaluationErrors = scoring.errors.length;
  if (offers.length && !scoring.curated.length && scoring.errors.length) throw new DiscoveryError('DISCOVERY_SCORING_FAILED', true);
  await save('saving');
  return publishDiscovery(job, candidate.evidence.sourceHash, offers, scoring.curated, progress);
}
