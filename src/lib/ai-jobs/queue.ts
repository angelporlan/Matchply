import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, type AiJob } from '@/db/schema';
import type { AiJobKind, AiJobPayload } from './types';

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

async function markClaimed(tx: typeof db, candidate: AiJob, now: Date) {
  const leaseUntil = new Date(Date.now() + LEASE_MS);
  const [claimed] = await tx.update(aiJobs).set({
    status: 'running',
    attempt: candidate.attempt + 1,
    leaseUntil,
    startedAt: candidate.startedAt || now,
    updatedAt: now,
    lastError: null,
  }).where(and(
    eq(aiJobs.id, candidate.id),
    or(eq(aiJobs.status, 'queued'), eq(aiJobs.status, 'running')),
  )).returning();
  return claimed || null;
}

export async function claimNextAiJob(): Promise<AiJob | null> {
  const now = new Date();
  return db.transaction(async tx => {
    const result = await tx.execute(sql`
      SELECT * FROM "ai_job"
      WHERE (
        "status" = 'queued'
        OR ("status" = 'running' AND "leaseUntil" < ${now})
      )
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      AND "attempt" < ${MAX_ATTEMPTS}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const candidate = result.rows[0] as AiJob | undefined;
    if (!candidate) return null;

    const [userActive] = await tx.execute(sql`
      SELECT count(*)::int AS count FROM "ai_job"
      WHERE "userId" = ${candidate.userId} AND "status" = 'running' AND "leaseUntil" > ${now}
    `).then(res => res.rows as Array<{ count: number }>);
    if (Number(userActive?.count || 0) > 0) return null;

    return markClaimed(tx, candidate, now);
  });
}

export async function claimAiJobById(jobId: string): Promise<AiJob | null> {
  const now = new Date();
  return db.transaction(async tx => {
    const result = await tx.execute(sql`
      SELECT * FROM "ai_job"
      WHERE "id" = ${jobId}
      AND (
        "status" = 'queued'
        OR ("status" = 'running' AND "leaseUntil" < ${now})
      )
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
      AND "attempt" < ${MAX_ATTEMPTS}
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const candidate = result.rows[0] as AiJob | undefined;
    if (!candidate) return null;
    return markClaimed(tx, candidate, now);
  });
}

export async function completeAiJob(jobId: string, result: Record<string, unknown>) {
  const now = new Date();
  const [updated] = await db.update(aiJobs).set({
    status: 'completed',
    result,
    lastError: null,
    leaseUntil: null,
    completedAt: now,
    updatedAt: now,
  }).where(eq(aiJobs.id, jobId)).returning();
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
  }).where(eq(aiJobs.id, job.id)).returning();
  return updated;
}

export function isTerminalAiJob(job: AiJob) {
  return job.status === 'completed' || job.status === 'failed';
}
