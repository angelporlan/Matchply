/** Small, non-narrative results persisted after each offer has been saved. */
export type MatchBatchScore = { id: string; score: number };
export type MatchBatchError = { id: string; message: string; code?: 'outdated' };
export type MatchBatchResult = {
  total: number;
  items: MatchBatchScore[];
  errors: MatchBatchError[];
};

export function readMatchBatchResult(value: unknown, total = 0): MatchBatchResult {
  const input = value && typeof value === 'object' ? value as Partial<MatchBatchResult> : {};
  const scores = new Map<string, MatchBatchScore>();
  for (const item of Array.isArray(input.items) ? input.items : []) {
    if (item && typeof item.id === 'string' && typeof item.score === 'number'
      && Number.isFinite(item.score) && item.score >= 0 && item.score <= 100) {
      scores.set(item.id, { id: item.id, score: item.score });
    }
  }
  const errors = new Map<string, MatchBatchError>();
  for (const error of Array.isArray(input.errors) ? input.errors : []) {
    if (error && typeof error.id === 'string' && typeof error.message === 'string' && !scores.has(error.id)) {
      errors.set(error.id, { id: error.id, message: error.message, ...(error.code === 'outdated' ? { code: 'outdated' as const } : {}) });
    }
  }
  return {
    total: typeof input.total === 'number' && Number.isInteger(input.total) && input.total >= 0 ? input.total : total,
    items: Array.from(scores.values()),
    errors: Array.from(errors.values()),
  };
}

export function pendingMatchOfferIds(offerIds: string[], result: MatchBatchResult): string[] {
  const saved = new Set(result.items.map(item => item.id));
  return Array.from(new Set(offerIds)).filter(id => !saved.has(id));
}

export function addMatchBatchScore(result: MatchBatchResult, item: MatchBatchScore): MatchBatchResult {
  if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) throw new Error('INVALID_MATCH_SCORE');
  return {
    ...result,
    items: [...result.items.filter(existing => existing.id !== item.id), { id: item.id, score: item.score }],
    errors: result.errors.filter(error => error.id !== item.id),
  };
}

export function addMatchBatchError(result: MatchBatchResult, error: MatchBatchError): MatchBatchResult {
  if (result.items.some(item => item.id === error.id)) return result;
  return {
    ...result,
    errors: [...result.errors.filter(existing => existing.id !== error.id), { id: error.id, message: error.message, ...(error.code === 'outdated' ? { code: 'outdated' as const } : {}) }],
  };
}

export function matchBatchCounts(result: MatchBatchResult, threshold = 65) {
  const kept = result.items.filter(item => item.score >= threshold).length;
  return { total: result.total, evaluated: result.items.length, failed: result.errors.length, kept, archived: result.items.length - kept };
}
