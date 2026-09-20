export const AI_JOB_KINDS = [
  'match_batch',
  'evaluate',
  'optimize_application',
] as const;

export type AiJobKind = typeof AI_JOB_KINDS[number];
export type AiJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type OfferJobPayload = {
  title: string;
  company: string;
  description: string;
  url?: string | null;
  platform?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
};

export type OptimizeApplicationPayload = {
  offerId: string;
  regenerate?: boolean;
};

export type MatchBatchPayload = {
  offerIds: string[];
  targetThreshold: number;
  requestId: string;
};

export type AiJobPayload = OfferJobPayload | OptimizeApplicationPayload | MatchBatchPayload;
