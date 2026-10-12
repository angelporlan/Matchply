export const DISCOVERY_MODEL = 'gpt-6-luna';
export const DISCOVERY_MAX_OFFERS = 5;
export const DISCOVERY_MAX_CANDIDATES = 8;
export const DISCOVERY_MIN_SCORE = 65;

export type DiscoverOffersPayload = { requestId: string };
export type DiscoveryStage = 'queued' | 'searching' | 'scoring' | 'saving' | 'completed';
export type DiscoveryItem = { id: string; title: string; company: string; url: string; score: number };
export type DiscoveryProgress = {
  stage: DiscoveryStage;
  found: number;
  added: DiscoveryItem[];
  duplicates: number;
  belowThreshold: number;
  evaluationErrors: number;
  published?: boolean;
};

export function initialDiscoveryProgress(): DiscoveryProgress {
  return { stage: 'queued', found: 0, added: [], duplicates: 0, belowThreshold: 0, evaluationErrors: 0 };
}

export class DiscoveryError extends Error {
  constructor(code: string, readonly retryable = false) { super(code); this.name = 'DiscoveryError'; }
}
