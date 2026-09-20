/** Shared idle/backoff + SIGTERM handling for long-running Node workers. */

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function createWorkerShutdown() {
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return {
    get stopping() {
      return stopping;
    },
    waitUntilSignal() {
      if (stopping) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timer = setInterval(() => {}, 1 << 30);
        const done = () => {
          clearInterval(timer);
          resolve();
        };
        process.on('SIGTERM', done);
        process.on('SIGINT', done);
      });
    },
  };
}

/** First empty poll waits `minMs`; later empty polls wait `maxMs`. Resets when work is found. */
export function createIdleBackoff(minMs = 2_000, maxMs = 10_000) {
  let delay = minMs;
  return {
    reset() {
      delay = minMs;
    },
    async wait() {
      await sleep(delay);
      delay = maxMs;
    },
  };
}
