import type { NetworkingPayload } from '@/lib/people/types';
export const AI_JOB_KINDS = [
  'match_batch',
  'import_offer',
  'networking',
] as const;

export type AiJobKind = typeof AI_JOB_KINDS[number];
export type AiJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type MatchBatchPayload = {
  offerIds: string[];
  targetThreshold: number;
  requestId: string;
  kind?: 'triage' | 'deep';
};

export type ImportOfferPayload = { url: string; requestId: string };
export type AiJobPayload = MatchBatchPayload | ImportOfferPayload | NetworkingPayload;
