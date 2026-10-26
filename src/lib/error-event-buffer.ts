import type { ErrorEventInput } from '@/lib/diagnostics-schema';

/** Error collection must not queue indefinitely or recursively fail during a DB outage. */
export function createErrorRecorder(write: (event: ErrorEventInput) => Promise<unknown>, enabled: () => boolean, now = Date.now) {
  const pending = new Set<Promise<unknown>>();
  let retryAt = 0;
  return {
    record(event: ErrorEventInput) {
      if (!enabled() || pending.size >= 4 || now() < retryAt) return;
      const task = Promise.resolve().then(() => write(event)).catch(() => { retryAt = now() + 60_000; }).finally(() => { pending.delete(task); });
      pending.add(task);
    },
    async drain() { await Promise.all(Array.from(pending)); },
  };
}
