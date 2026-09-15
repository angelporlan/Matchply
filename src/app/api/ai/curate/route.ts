import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { jobOffers } from '@/db/schema';
import { requireUserFeature } from '@/lib/permissions';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { enqueueMatchBatchJob, getAiJobForUser, isTerminalAiJob } from '@/lib/ai-jobs/queue';
import { matchBatchCounts } from '@/lib/ai-jobs/match-batch-state';
import { log } from '@/lib/logger';
import { readCurrentMatchBatchResult } from '@/lib/ai-jobs/match-batch-progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBSERVER_WINDOW_MS = 50_000;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new NextResponse('Invalid request', { status: 400 });
  }
  if (body.offerIds !== undefined && (!Array.isArray(body.offerIds)
    || body.offerIds.some((id: unknown) => typeof id !== 'string' || !UUID_PATTERN.test(id)))) {
    return new NextResponse('Invalid offer IDs', { status: 400 });
  }
  if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !UUID_PATTERN.test(body.requestId))) {
    return new NextResponse('Invalid request ID', { status: 400 });
  }
  const requestedIds: string[] | undefined = body.offerIds === undefined ? undefined : Array.from(new Set<string>(body.offerIds));
  const targetThreshold = typeof body.targetThreshold === 'number' && Number.isFinite(body.targetThreshold)
    ? Math.max(0, Math.min(100, Math.round(body.targetThreshold))) : 65;

  try {
    await requireUserFeature(userId, 'applications');
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }
  try {
    consumeRateLimit(`ai:curate:${userId}`, 10, 10 * 60_000);
  } catch (error) {
    if (error instanceof RateLimitError) return new NextResponse(error.message, { status: 429 });
    throw error;
  }

  // The producer selects IDs only. The worker loads descriptions once it owns the job lease.
  const offers = requestedIds?.length === 0 ? [] : await db.select({ id: jobOffers.id }).from(jobOffers)
    .where(and(eq(jobOffers.userId, userId), requestedIds
      ? inArray(jobOffers.id, requestedIds) : eq(jobOffers.status, 'interested')))
    .orderBy(desc(jobOffers.createdAt));
  if (requestedIds && offers.length !== requestedIds.length) {
    return new NextResponse('One or more offers are unavailable', { status: 404 });
  }
  const job = await enqueueMatchBatchJob(userId, {
    offerIds: offers.map(offer => offer.id), targetThreshold,
    requestId: body.requestId || randomUUID(),
  });

  const encoder = new TextEncoder();
  let cancelled = false;
  let stopWait: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const stop = () => { cancelled = true; stopWait?.(); };
      req.signal.addEventListener('abort', stop, { once: true });
      if (req.signal.aborted) stop();
      const delivered = new Set<string>();
      const deliveredErrors = new Map<string, string>();
      const started = Date.now();
      let previousStatus = '';
      try {
        send({ type: 'start', jobId: job.id, total: offers.length });
        while (!cancelled && Date.now() - started < OBSERVER_WINDOW_MS) {
          const current = await getAiJobForUser(userId, job.id);
          if (!current) throw new Error('No se pudo recuperar el cálculo.');
          const result = await readCurrentMatchBatchResult(current);
          for (const item of result.items) {
            if (!delivered.has(item.id)) {
              send({ id: item.id, score: item.score });
              delivered.add(item.id);
              deliveredErrors.delete(item.id);
            }
          }
          for (const error of result.errors) {
            if (deliveredErrors.get(error.id) !== error.message) {
              send({ type: 'offer_error', ...error });
              if (error.code === 'outdated') delivered.delete(error.id);
              deliveredErrors.set(error.id, error.message);
            }
          }
          if (current.status !== previousStatus) {
            send({ type: 'progress', status: current.status, evaluated: result.items.length, total: result.total });
            previousStatus = current.status;
          }
          if (isTerminalAiJob(current)) {
            send({ type: 'done', status: current.status, ...matchBatchCounts(result, targetThreshold) });
            return;
          }
          await new Promise<void>(resolve => {
            const timer = setTimeout(() => { stopWait = undefined; resolve(); }, 1_500);
            stopWait = () => { clearTimeout(timer); stopWait = undefined; resolve(); };
            if (cancelled) stopWait();
          });
        }
        if (!cancelled) send({ type: 'pending', jobId: job.id });
      } catch (error) {
        log({ event: 'match_batch_observer_failed', level: 'warn', userId, jobId: job.id });
        send({ type: 'error', message: 'Se interrumpió la conexión. El cálculo continúa y puede recuperarse.', jobId: job.id });
      } finally {
        req.signal.removeEventListener('abort', stop);
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      stopWait?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
