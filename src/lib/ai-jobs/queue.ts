import { and, eq, gt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, type AiJob } from '@/db/schema';
import type { AiJobKind, AiJobPayload, MatchBatchPayload } from './types';

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60_000;

export async function enqueueAiJob(input: {
  userId: string;
  kind: AiJobKind;
  payload: AiJobPayload;
}) {
  const now = new Date();
  const [job] = await db.insert(aiJobs).values({
    userId: input.userId,
    kind: input.kind,
    status: 'queued',
    attempt: 0,
    payload: input.payload,
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
export async function enqueueMatchBatchJob(userId: string, payload: MatchBatchPayload) {
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
      userId, kind: 'match_batch', status: 'queued', attempt: 0, payload,
      result: { total: payload.offerIds.length, items: [], errors: [] },
      nextAttemptAt: now, createdAt: now, updatedAt: now,
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
      WHERE "kind" = 'match_batch' AND "status" = 'running'
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
  }).where(owner?.kind === 'match_batch' ? ownedAttempt(owner) : and(eq(aiJobs.id, jobId), sql`${aiJobs.kind} <> 'match_batch'`)).returning();
  return updated;
}

export async function failAiJob(job: AiJob, error: unknown) {
  const terminal = job.attempt >= MAX_ATTEMPTS;
  const now = new Date();
  const [updated] = await db.update(aiJobs).set({
    status: terminal ? 'failed' : 'queued',
    lastError: error instanceof Error ? error.message.slice(0, 1_000) : 'AI_JOB_FAILED',
    nextAttemptAt: terminal ? null : new Date(Date.now() + Math.min(60_000, job.attempt * 10_000)),
    leaseUntil: null,
    completedAt: terminal ? now : null,
    updatedAt: now,
  }).where(job.kind === 'match_batch' ? ownedAttempt(job) : eq(aiJobs.id, job.id)).returning();
  return updated;
}

export function isTerminalAiJob(job: AiJob) {
  return job.status === 'completed' || job.status === 'failed';
}
