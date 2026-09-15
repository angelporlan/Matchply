import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers, type AiJob } from '@/db/schema';
import { addMatchBatchError, readMatchBatchResult, type MatchBatchResult } from './match-batch-state';

/** These hashes stay in the durable job; observers receive only scores and public errors. */
export function readMatchBatchInputHashes(value: unknown): Record<string, string> {
  const hashes = value && typeof value === 'object' ? (value as { inputHashes?: unknown }).inputHashes : null;
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) return {};
  return Object.fromEntries(Object.entries(hashes).filter(([, hash]) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)));
}

/** DB triggers clear the row hash on profile, selected CV, or offer input changes. */
export async function readCurrentMatchBatchResult(job: Pick<AiJob, 'userId' | 'result'>): Promise<MatchBatchResult> {
  const stored = readMatchBatchResult(job.result);
  if (!stored.items.length) return stored;
  const hashes = readMatchBatchInputHashes(job.result);
  const rows = await db.select({ id: jobOffers.id, score: jobOffers.scoreOverall, inputHash: jobOffers.matchInputHash })
    .from(jobOffers).where(and(eq(jobOffers.userId, job.userId), inArray(jobOffers.id, stored.items.map(item => item.id))));
  const current = new Map(rows.map(row => [row.id, row]));
  const valid = stored.items.filter(item => {
    const row = current.get(item.id);
    return row && Boolean(hashes[item.id]) && row.inputHash === hashes[item.id] && row.score === item.score;
  });
  const validIds = new Set(valid.map(item => item.id));
  let result: MatchBatchResult = { ...stored, items: valid };
  for (const item of stored.items) {
    if (!validIds.has(item.id)) result = addMatchBatchError(result, {
      id: item.id, code: 'outdated', message: 'Los datos han cambiado. Esta puntuación necesita un nuevo cálculo.',
    });
  }
  return result;
}
