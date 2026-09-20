export class RateLimitError extends Error {
  readonly status = 429;

  constructor(message = 'Too many requests; try again later') {
    super(message);
    this.name = 'RateLimitError';
  }
}

type Bucket = { startedAt: number; count: number; windowMs: number };

// Process-local limiter (single web instance). Bounded so unique keys such as
// `login:<email>` cannot grow the map forever.
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;
const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;

function sweepExpired(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;
  lastSweepAt = now;
  buckets.forEach((bucket, key) => {
    if (now - bucket.startedAt >= bucket.windowMs) buckets.delete(key);
  });
  // Still too large after dropping expired windows: evict the oldest entries (Map preserves insertion order).
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweepExpired(now);
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1, windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new RateLimitError();
  }
  current.count += 1;
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
  lastSweepAt = 0;
}
