import { enforceCurationConstraints, type HardConstraints } from '@/lib/curation-constraints';
import { matchInputHash, matchSourceHash } from './fingerprint';
import { applyEvidenceAdjustments, isMatchDetails, isMatchEvidenceSnapshot, readMatchBreakdown, validateRequirements } from './evidence';
import { matchScoreLabel } from './rubric';
import { evidenceHash } from './canonical';
import { MATCH_PROMPT_VERSION, MatchValidationError, type CandidateEvidence, type CuratedMatchItem, type LlmMatchItem, type MatchDetails, type MatchEvidenceSnapshot, type MatchKind, type MatchOfferCard } from './types';

export function normalizeMatchItem(input: {
  offer: { id: string; title: string; company: string; description?: string | null };
  offerCard: MatchOfferCard;
  candidateCard: string;
  candidateEvidence?: CandidateEvidence;
  llm?: LlmMatchItem | null;
  constraints: HardConstraints;
  targetThreshold: number;
  kind: MatchKind;
  model: string;
  provider?: string;
}): CuratedMatchItem {
  const candidate = input.candidateEvidence ?? {
    card: input.candidateCard, sourceHash: evidenceHash(input.candidateCard), sources: [{ id: 'profile', text: input.candidateCard }],
    complete: false, sufficient: Boolean(input.candidateCard.trim()), totalExperienceYears: null,
  };
  if (!candidate.sufficient || !input.offerCard.sufficient || !input.offerCard.complete) throw new MatchValidationError('No hay suficiente evidencia completa para evaluar esta oferta.', 'insufficient_input');
  if (!input.llm || input.llm.id !== input.offer.id) throw new MatchValidationError('La IA no devolvió la oferta solicitada.');
  const baseBreakdown = readMatchBreakdown(input.llm);
  const requirements = validateRequirements(input.llm.requirements, candidate, input.offerCard);
  const adjusted = applyEvidenceAdjustments(baseBreakdown, requirements, input.offerCard);
  // Only explicit rules parsed by the host can affect language scoring; LLM violatedRules is ignored.
  const enforcementInput = {
    score: adjusted.score, offerLanguage: input.offerCard.language,
    offerWorkplace: input.offerCard.workplace, offerSalaryMax: input.offerCard.salaryMax,
    offerRequiredEnglish: input.offerCard.requiredEnglish,
    ...(input.offerCard.languageRequirements ? { offerLanguageRequirements: input.offerCard.languageRequirements } : {}),
    constraints: input.constraints, targetThreshold: input.targetThreshold,
  };
  const enforced = enforceCurationConstraints(enforcementInput);
  const rejectedByPreference = enforceCurationConstraints({ ...enforcementInput, targetThreshold: 0 }).decision === 'archive';
  if (enforced.score < adjusted.score) adjusted.adjustments.push({ code: 'user_preference', requirementIds: [], overallCap: enforced.score, reason: enforced.fitReason });
  const sourceHash = matchSourceHash({ candidateEvidence: candidate, offerCard: input.offerCard, constraints: input.constraints });
  const inputHash = matchInputHash({ sourceHash, offerCard: input.offerCard, provider: input.provider, model: input.model });
  const evidence: MatchEvidenceSnapshot = {
    version: MATCH_PROMPT_VERSION, sourceHash, inputHash, score: enforced.score,
    baseScore: adjusted.baseScore, baseBreakdown, scoreBreakdown: adjusted.scoreBreakdown,
    requirements, adjustments: adjusted.adjustments, candidateComplete: candidate.complete, offerComplete: input.offerCard.complete, rejectedByPreference,
  };
  return {
    id: input.offer.id, title: input.offer.title, company: input.offer.company,
    score: enforced.score, scoreLabel: matchScoreLabel(enforced.score), decision: enforced.decision,
    // No explanation generation in the scoring pass; these legacy fields remain empty.
    fitReason: '', highlightSkills: [], scoreBreakdown: adjusted.scoreBreakdown,
    inputHash, sourceHash, kind: input.kind, evidence,
  };
}

export function cachedMatchItem(input: {
  offer: { id: string; title: string; company: string };
  score: number;
  scoreBreakdown: CuratedMatchItem['scoreBreakdown'];
  fitReason?: string | null;
  hash: string;
  kind: MatchKind;
  targetThreshold: number;
  evidence?: unknown;
  details?: MatchDetails;
}): CuratedMatchItem {
  if (!isMatchEvidenceSnapshot(input.evidence) || input.evidence.inputHash !== input.hash || input.evidence.score !== input.score) throw new MatchValidationError('La evaluación guardada no tiene evidencia válida.');
  const evidence = input.evidence;
  return {
    id: input.offer.id, title: input.offer.title, company: input.offer.company,
    score: evidence.score, scoreLabel: matchScoreLabel(evidence.score),
    decision: !evidence.rejectedByPreference && evidence.score >= input.targetThreshold ? 'keep' : 'archive',
    fitReason: '', highlightSkills: [], scoreBreakdown: evidence.scoreBreakdown,
    inputHash: evidence.inputHash, sourceHash: evidence.sourceHash, kind: input.kind, evidence,
    ...(input.details && isMatchDetails(input.details, evidence) ? { details: input.details } : {}),
  };
}
