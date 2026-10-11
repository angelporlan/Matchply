import type { OptimizeProgress } from './types';

export async function consumeCvOptimization(response: Response, onProgress?: (progress: OptimizeProgress) => void, signal?: AbortSignal) {
  const created = await response.json() as { jobId?: string; cvId?: string; error?: string };
  if (!response.ok || !created.jobId || !created.cvId) throw new Error(created.error || 'No se pudo iniciar la optimización.');
  while (true) {
    const result = await fetch(`/api/ai/jobs/${created.jobId}`, { cache: 'no-store', signal });
    const job = await result.json();
    if (!result.ok) throw new Error(job.error || 'No se pudo recuperar la optimización.');
    if (job.result) onProgress?.(job.result);
    if (job.status === 'completed') return { cvId: created.cvId, optimizationId: job.result.optimizationId as string };
    if (job.status === 'failed') throw new Error('No se pudo completar la optimización. Tu CV anterior se conserva.');
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 650);
      if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    });
  }
}
