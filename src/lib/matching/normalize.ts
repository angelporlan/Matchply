import {
  enforceCurationConstraints,
  type HardConstraints,
} from '@/lib/curation-constraints';
import { matchInputHash } from './fingerprint';
import { clampMatchScore, computeOverall, matchScoreLabel, resolveMatchBreakdown } from './rubric';
import type {
  CuratedMatchItem,
  LlmMatchItem,
  MatchKind,
  MatchOfferCard,
  MatchRedFlag,
} from './types';

function stringList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function parseRedFlags(value: unknown): MatchRedFlag[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as { title?: unknown; description?: unknown };
      const title = String(row.title || '').trim();
      const description = String(row.description || '').trim();
      if (!title && !description) return null;
      return {
        title: (title || description).slice(0, 80),
        description: (description || title).slice(0, 240),
      };
    })
    .filter((item): item is MatchRedFlag => Boolean(item))
    .slice(0, 3);
}

function groundedSkills(
  proposed: string[],
  candidateCard: string,
  offerCard: MatchOfferCard,
): string[] {
  const haystack = `${candidateCard} ${offerCard.requirementsExtract} ${offerCard.title}`.toLowerCase();
  return proposed
    .filter((skill) => haystack.includes(skill.toLowerCase()))
    .slice(0, 4);
}

export function normalizeMatchItem(input: {
  offer: { id: string; title: string; company: string; description?: string | null };
  offerCard: MatchOfferCard;
  candidateCard: string;
  llm?: LlmMatchItem | null;
  constraints: HardConstraints;
  targetThreshold: number;
  kind: MatchKind;
  model: string;
}): CuratedMatchItem {
  const llm = input.llm || {};
  const breakdown = resolveMatchBreakdown(llm);
  const overall = computeOverall(breakdown);
  const enforced = enforceCurationConstraints({
    score: overall,
    fitReason: typeof llm.fitReason === 'string' ? llm.fitReason : undefined,
    violatedRules: Array.isArray(llm.violatedRules) ? llm.violatedRules.map((item) => String(item)) : [],
    offerLanguage: input.offerCard.language,
    offerWorkplace: input.offerCard.workplace,
    offerSalaryMax: input.offerCard.salaryMax,
    constraints: input.constraints,
    targetThreshold: input.targetThreshold,
  });

  const hash = matchInputHash({
    candidateCard: input.candidateCard,
    offerCard: input.offerCard,
    model: input.model,
    kind: input.kind,
  });

  const result: CuratedMatchItem = {
    id: input.offer.id,
    title: input.offer.title,
    company: input.offer.company,
    score: enforced.score,
    scoreLabel: matchScoreLabel(enforced.score),
    decision: enforced.decision,
    fitReason: enforced.fitReason,
    highlightSkills: groundedSkills(stringList(llm.highlightSkills, 8), input.candidateCard, input.offerCard),
    scoreBreakdown: breakdown,
    inputHash: hash,
    kind: input.kind,
  };

  if (input.kind === 'deep') {
    result.presentKeywords = stringList(llm.presentKeywords, 5);
    result.missingKeywords = stringList(llm.missingKeywords, 5);
    result.redFlags = parseRedFlags(llm.redFlags);
    if (typeof llm.verdict === 'string' && llm.verdict.trim()) {
      result.verdict = llm.verdict.trim().slice(0, 400);
    }
  }

  return result;
}

export function cachedMatchItem(input: {
  offer: { id: string; title: string; company: string };
  score: number;
  scoreBreakdown: CuratedMatchItem['scoreBreakdown'];
  fitReason?: string | null;
  hash: string;
  kind: MatchKind;
  targetThreshold: number;
}): CuratedMatchItem {
  const score = clampMatchScore(input.score, 50);
  const decision = score >= input.targetThreshold ? 'keep' : 'archive';
  return {
    id: input.offer.id,
    title: input.offer.title,
    company: input.offer.company,
    score,
    scoreLabel: matchScoreLabel(score),
    decision,
    fitReason: (input.fitReason || (decision === 'keep' ? `Afinidad alta (${score}%).` : `Afinidad baja (${score}%).`)).slice(0, 180),
    highlightSkills: [],
    scoreBreakdown: input.scoreBreakdown,
    inputHash: input.hash,
    kind: input.kind,
  };
}
