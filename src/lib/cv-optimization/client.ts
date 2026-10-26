import { userErrorMessage } from '@/lib/user-errors';
import type { OptimizeProgress } from './types';

export class CvOptimizationClientError extends Error {
  constructor(readonly code: string, readonly terminal = false, readonly requestId?: string) {
    super(userErrorMessage(code, 'es', terminal ? 'OPTIMIZATION_FAILED' : 'OPTIMIZATION_CONNECTION_LOST'));
  }
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Two bounded retries, including broken response bodies. POST callers keep their idempotency key. */
export async function fetchOptimizationResponse(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    init.signal?.addEventListener('abort', abort, { once: true });
    if (init.signal?.aborted) abort();
    const timeout = setTimeout(abort, 20_000);
    try {
      if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const response = await fetch(url, { ...init, signal: controller.signal });
      if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
        await response.body?.cancel();
        throw new CvOptimizationClientError('OPTIMIZATION_TEMPORARILY_UNAVAILABLE');
      }
      if (!response.ok) return response; // Permissions and invalid input need user action, not another POST.
      const body = await response.text();
      JSON.parse(body); // A body may disconnect after fetch() has already resolved.
      return new Response(body, { status: response.status, headers: response.headers });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (attempt >= 2) throw new CvOptimizationClientError('OPTIMIZATION_CONNECTION_LOST');
      await wait(500 * 2 ** attempt, init.signal ?? undefined);
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener('abort', abort);
    }
  }
}

export async function consumeCvOptimization(response: Response, onProgress?: (progress: OptimizeProgress) => void, signal?: AbortSignal) {
  const created = await response.json() as { jobId?: string; cvId?: string; error?: string; requestId?: string };
  if (!response.ok || !created.jobId || !created.cvId) throw new Error(created.error || 'No se pudo iniciar la optimización.');
  while (true) {
    const result = await fetchOptimizationResponse(`/api/ai/jobs/${created.jobId}`, { cache: 'no-store', signal });
    const job = await result.json();
    if (!result.ok) throw new Error(job.error || 'No se pudo recuperar la optimización.');
    if (job.result) onProgress?.(job.result);
    if (job.status === 'completed') return { cvId: created.cvId, optimizationId: job.result.optimizationId as string };
    if (job.status === 'failed') throw new CvOptimizationClientError('OPTIMIZATION_FAILED', true, created.requestId);
    await wait(650, signal);
  }
}
