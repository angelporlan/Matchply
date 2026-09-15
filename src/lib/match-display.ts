import { MATCH_EXPLANATION_VERSION, MATCH_PROMPT_VERSION, type MatchDetails, type MatchEvidenceSnapshot } from './matching/types';

export function currentMatchEvidence(offer: {
  matchInputHash?: string | null; matchEvidence?: unknown; scoreOverall?: number | null;
}): MatchEvidenceSnapshot | null {
  const value = offer.matchEvidence as MatchEvidenceSnapshot | null;
  if (!value || !offer.matchInputHash || value.version !== MATCH_PROMPT_VERSION
    || value.inputHash !== offer.matchInputHash || value.score !== offer.scoreOverall
    || !Array.isArray(value.requirements) || !Array.isArray(value.adjustments)) return null;
  return value;
}

export function currentMatchDetails(value: unknown, evidence: MatchEvidenceSnapshot | null): MatchDetails | null {
  const detail = value as MatchDetails | null;
  return evidence && detail && detail.version === MATCH_EXPLANATION_VERSION && detail.inputHash === evidence.inputHash
    && Array.isArray(detail.dimensions) && Array.isArray(detail.requirements) && Array.isArray(detail.nextSteps) ? detail : null;
}
