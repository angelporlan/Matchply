import { createHash } from 'crypto';
import { MATCH_PROMPT_VERSION, type MatchKind, type MatchOfferCard } from './types';
import { serializeOfferCard } from './offer-card';

export function matchInputHash(input: {
  candidateCard: string;
  offerCard: MatchOfferCard;
  model: string;
  kind: MatchKind;
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      v: MATCH_PROMPT_VERSION,
      candidateCard: input.candidateCard,
      offer: serializeOfferCard(input.offerCard),
      model: input.model,
      kind: input.kind,
    }))
    .digest('hex');
}

export function canReuseCachedMatch(input: {
  hash: string;
  cachedHash?: string | null;
  scoreOverall?: number | null;
  scoreBreakdown?: unknown;
  hasDescription: boolean;
  canonicalBreakdown: boolean;
}): boolean {
  if (!input.hasDescription) return false;
  if (!input.cachedHash || input.cachedHash !== input.hash) return false;
  if (typeof input.scoreOverall !== 'number' || !Number.isFinite(input.scoreOverall)) return false;
  return input.canonicalBreakdown;
}
