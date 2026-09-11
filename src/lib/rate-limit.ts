export class RateLimitError extends Error {
  readonly status = 429;

  constructor(message = 'Too many requests; try again later') {
    super(message);
    this.name = 'RateLimitError';
  }
}

const buckets = new Map<string, { startedAt: number; count: number }>();

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= limit) {
    throw new RateLimitError();
  }
  current.count += 1;
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
}
