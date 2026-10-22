/** Screen-local request coalescing. An invalidation during a read schedules one fresh read. */
export function createRequestRefresh<T>(
  load: (signal: AbortSignal) => Promise<T>,
  publish: (value: T) => void,
  failed: () => void,
) {
  const controller = new AbortController();
  let running: Promise<void> | null = null;
  let dirty = false;
  return {
    refresh(invalidate = false): Promise<void> {
      if (controller.signal.aborted) return Promise.resolve();
      if (running) { dirty ||= invalidate; return running; }
      running = (async () => {
        do {
          dirty = false;
          try {
            const result = await load(controller.signal);
            if (!controller.signal.aborted && !dirty) publish(result);
          } catch {
            if (!controller.signal.aborted && !dirty) failed();
          }
        } while (dirty && !controller.signal.aborted);
      })().finally(() => { running = null; });
      return running;
    },
    dispose() { controller.abort(); },
  };
}
