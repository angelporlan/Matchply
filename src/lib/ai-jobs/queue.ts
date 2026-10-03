import { and, eq, gt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, type AiJob } from '@/db/schema';
import type { AiJobKind, AiJobPayload, MatchBatchPayload, ImportOfferPayload } from './types';
import { getResolvedAiRuntime } from '@/lib/ai-runtime-store';

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;

export async function enqueueImportOfferJob(userId: string, payload: ImportOfferPayload, initiatedByUserId: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`offer-import:${userId}:${payload.requestId}`}))`);
    const [existing] = await tx.select().from(aiJobs).where(and(
      eq(aiJobs.userId, userId), eq(aiJobs.kind, 'import_offer'),
      sql`${aiJobs.payload}->>'requestId' = ${payload.requestId}`,
    )).limit(1);
    if (existing) {
      if ((existing.payload as ImportOfferPayload).url !== payload.url) throw new Error('OFFER_REQUEST_CONFLICT');
      return existing;
    }
    const [job] = await tx.insert(aiJobs).values({
      userId, initiatedByUserId, kind: 'import_offer', payload,
      status: 'queued', attempt: 0, nextAttemptAt: new Date(), result: { stage: 'reading' },
    }).returning();
    return job;
  });
}

export async function enqueueAiJob(input: {
  userId: string;
  kind: AiJobKind;
  payload: AiJobPayload;
  initiatedByUserId?: string | null;
}) {
  const now = new Date();
  const resolvedAiConfig = await getResolvedAiRuntime();
  const [job] = await db.insert(aiJobs).values({
    userId: input.userId,
    initiatedByUserId: input.initiatedByUserId ?? input.userId,
    kind: input.kind,
    status: 'queued',
    attempt: 0,
    payload: input.payload,
    resolvedAiConfig,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return job;
}

export async function getAiJob(jobId: string) {
  const [job] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1);
  return job || null;
}

export async function getAiJobForUser(userId: string, jobId: string) {
  const [job] = await db.select().from(aiJobs).where(and(
    eq(aiJobs.id, jobId),
    eq(aiJobs.userId, userId),
  )).limit(1);
  return job || null;
}

/** requestId survives a lost POST response; the same request never starts a second batch. */
export async function enqueueMatchBatchJob(
  userId: string,
  payload: MatchBatchPayload,
  meta: { initiatedByUserId?: string | null } = {},
) {
  const resolvedAiConfig = await getResolvedAiRuntime();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`match-request:${userId}`}))`);
    const [existing] = await tx.select().from(aiJobs).where(and(
      eq(aiJobs.userId, userId),
      eq(aiJobs.kind, 'match_batch'),
      sql`${aiJobs.payload}->>'requestId' = ${payload.requestId}`,
    )).limit(1);
    if (existing) return existing;
    const now = new Date();
    const [job] = await tx.insert(aiJobs).values({
      userId,
      initiatedByUserId: meta.initiatedByUserId ?? userId,
      kind: 'match_batch',
      status: 'queued',
      attempt: 0,
      payload,
      resolvedAiConfig,
      result: { total: payload.offerIds.length, items: [], errors: [] },
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return job;
  });
}

async function markClaimed(tx: typeof db, candidate: AiJob, now: Date) {
  // Both worker claiming and the legacy inline path share the per-user limit.
  const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${`ai-claim:${candidate.userId}`})) AS acquired`);
  if (!lock.rows[0]?.acquired) return null;
  const active = await tx.execute(sql`
    SELECT 1 FROM "ai_job" WHERE "userId" = ${candidate.userId}
    AND "id" <> ${candidate.id} AND "status" = 'running' AND "leaseUntil" > ${now.toISOString()} LIMIT 1
  `);
  if (active.rows.length) return null;
  const [claimed] = await tx.update(aiJobs).set({
    status: 'running', attempt: candidate.attempt + 1,
    leaseUntil: new Date(Date.now() + LEASE_MS),
    startedAt: candidate.startedAt || now, updatedAt: now, lastError: null,
  }).where(and(
    eq(aiJobs.id, candidate.id), eq(aiJobs.attempt, candidate.attempt),
    or(eq(aiJobs.status, 'queued'), eq(aiJobs.status, 'running')),
  )).returning();
  return claimed || null;
}

export async function claimNextAiJob(): Promise<AiJob | null> {
  const now = new Date();
  return db.transaction(async tx => {
    // A dead worker's final attempt cannot be left in running forever.
    await tx.execute(sql`
      UPDATE "ai_job" SET "status" = 'failed', "leaseUntil" = NULL,
        "lastError" = 'AI_JOB_LEASE_EXPIRED', "completedAt" = ${now.toISOString()}, "updatedAt" = ${now.toISOString()}
      WHERE "kind" IN ('match_batch', 'import_offer', 'networking') AND "status" = 'running'
        AND "leaseUntil" < ${now.toISOString()} AND "attempt" >= ${MAX_ATTEMPTS}
    `);
    const result = await tx.execute(sql`
      SELECT candidate."id" FROM "ai_job" candidate
      WHERE (
        candidate."status" = 'queued'
        OR (candidate."status" = 'running' AND candidate."leaseUntil" < ${now.toISOString()})
      )
      AND (candidate."nextAttemptAt" IS NULL OR candidate."nextAttemptAt" <= ${now.toISOString()})
      AND candidate."attempt" < ${MAX_ATTEMPTS}
      AND NOT EXISTS (
        SELECT 1 FROM "ai_job" active WHERE active."userId" = candidate."userId"
        AND active."id" <> candidate."id" AND active."status" = 'running' AND active."leaseUntil" > ${now.toISOString()}
      )
      ORDER BY candidate."createdAt" ASC
      FOR UPDATE OF candidate SKIP LOCKED LIMIT 1
    `);
    const candidateId = result.rows[0]?.id as string | undefined;
    if (!candidateId) return null;
    const [candidate] = await tx.select().from(aiJobs).where(eq(aiJobs.id, candidateId)).limit(1);
    return candidate ? markClaimed(tx, candidate, now) : null;
  });
}

export async function claimAiJobById(jobId: string): Promise<AiJob | null> {
  const now = new Date();
  return db.transaction(async tx => {
    const result = await tx.execute(sql`
      SELECT "id" FROM "ai_job" WHERE "id" = ${jobId}
      AND ("status" = 'queued' OR ("status" = 'running' AND "leaseUntil" < ${now.toISOString()}))
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now.toISOString()})
      AND "attempt" < ${MAX_ATTEMPTS} FOR UPDATE SKIP LOCKED LIMIT 1
    `);
    const candidateId = result.rows[0]?.id as string | undefined;
    if (!candidateId) return null;
    const [candidate] = await tx.select().from(aiJobs).where(eq(aiJobs.id, candidateId)).limit(1);
    return candidate ? markClaimed(tx, candidate, now) : null;
  });
}

function ownedAttempt(job: AiJob) {
  return and(
    eq(aiJobs.id, job.id), eq(aiJobs.status, 'running'), eq(aiJobs.attempt, job.attempt),
    gt(aiJobs.leaseUntil, new Date()),
  );
}

export async function renewAiJobLease(job: AiJob): Promise<boolean> {
  const rows = await db.update(aiJobs).set({ leaseUntil: new Date(Date.now() + LEASE_MS), updatedAt: new Date() })
    .where(ownedAttempt(job)).returning({ id: aiJobs.id });
  return rows.length === 1;
}

export async function saveAiJobProgress(job: AiJob, result: Record<string, unknown>): Promise<boolean> {
  const rows = await db.update(aiJobs).set({ result, updatedAt: new Date() })
    .where(ownedAttempt(job)).returning({ id: aiJobs.id });
  return rows.length === 1;
}

export async function ownsAiJobLease(job: AiJob): Promise<boolean> {
  const [owned] = await db.select({ id: aiJobs.id }).from(aiJobs).where(ownedAttempt(job)).limit(1);
  return Boolean(owned);
}

export async function completeAiJob(jobId: string, result: Record<string, unknown>, owner?: AiJob) {
  const now = new Date();
  const [updated] = await db.update(aiJobs).set({
    status: 'completed',
    result,
    lastError: null,
    leaseUntil: null,
    completedAt: now,
    updatedAt: now,
  }).where(owner && ['match_batch', 'import_offer', 'networking'].includes(owner.kind) ? ownedAttempt(owner) : and(eq(aiJobs.id, jobId), sql`${aiJobs.kind} NOT IN ('match_batch', 'import_offer', 'networking')`)).returning();
  return updated;
}

export async function failAiJob(job: AiJob, error: unknown) {
  const retryableImport = error instanceof Error && 'retryable' in error && error.retryable === true;
  const terminal = job.attempt >= MAX_ATTEMPTS || (['import_offer', 'networking'].includes(job.kind) && !retryableImport);
  const now = new Date();
  const [updated] = await db.update(aiJobs).set({
    status: terminal ? 'failed' : 'queued',
    lastError: error instanceof Error ? error.message.slice(0, 1_000) : 'AI_JOB_FAILED',
    nextAttemptAt: terminal ? null : new Date(Date.now() + Math.min(60_000, job.attempt * 10_000)),
    leaseUntil: null,
    completedAt: terminal ? now : null,
    updatedAt: now,
  }).where(['match_batch', 'import_offer', 'networking'].includes(job.kind) ? ownedAttempt(job) : eq(aiJobs.id, job.id)).returning();
  return updated;
}

export function isTerminalAiJob(job: AiJob) {
  return job.status === 'completed' || job.status === 'failed';
}
