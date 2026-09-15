import type { HardConstraints } from '@/lib/curation-constraints';
import { evidenceHash } from './canonical';
import { isMatchEvidenceSnapshot } from './evidence';
import { MATCH_EXTRACTOR_VERSION, MATCH_PROMPT_VERSION, type CandidateEvidence, type MatchKind, type MatchOfferCard } from './types';

export function matchSourceHash(input: {
  candidateEvidence: CandidateEvidence;
  offerCard: MatchOfferCard;
  constraints?: HardConstraints;
}): string {
  return evidenceHash({ candidate: input.candidateEvidence.sourceHash, offer: input.offerCard.sourceHash, constraints: input.constraints ?? {} });
}

export function matchInputHash(input: {
  candidateCard?: string;
  candidateEvidence?: CandidateEvidence;
  offerCard: MatchOfferCard;
  constraints?: HardConstraints;
  sourceHash?: string;
  provider?: string;
  model: string;
  /** Retained for call compatibility; presentation depth never changes scoring inputs. */
  kind?: MatchKind;
}): string {
  const sourceHash = input.sourceHash ?? (input.candidateEvidence
    ? matchSourceHash({ candidateEvidence: input.candidateEvidence, offerCard: input.offerCard, constraints: input.constraints })
    : evidenceHash({ candidate: input.candidateCard?.match(/candidate_source_hash:([a-f0-9]{64})/)?.[1] ?? input.candidateCard ?? '', offer: input.offerCard.sourceHash, constraints: input.constraints ?? {} }));
  return evidenceHash({ sourceHash, provider: input.provider ?? '', model: input.model, scoringVersion: MATCH_PROMPT_VERSION, extractionVersion: MATCH_EXTRACTOR_VERSION });
}

export function canReuseCachedMatch(input: {
  hash: string;
  cachedHash?: string | null;
  scoreOverall?: number | null;
  scoreBreakdown?: unknown;
  hasDescription: boolean;
  canonicalBreakdown: boolean;
  evidence?: unknown;
}): boolean {
  if (!input.hasDescription || !input.cachedHash || input.cachedHash !== input.hash) return false;
  if (typeof input.scoreOverall !== 'number' || !Number.isFinite(input.scoreOverall) || input.scoreOverall < 0 || input.scoreOverall > 100) return false;
  if (!input.canonicalBreakdown || !input.evidence || typeof input.evidence !== 'object') return false;
  return isMatchEvidenceSnapshot(input.evidence) && input.evidence.inputHash === input.hash && input.evidence.score === input.scoreOverall;
}
