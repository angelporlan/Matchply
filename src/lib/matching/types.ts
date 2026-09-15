import type { CefrLevel, OfferLanguage, OfferWorkplace } from '@/lib/curation-constraints';
export type { OfferWorkplace };

export const MATCH_PROMPT_VERSION = '2026-09-15-evidence-v1';
export const MATCH_EXTRACTOR_VERSION = '2026-09-15-sections-v1';
export const MATCH_EXPLANATION_VERSION = '2026-09-15-details-v1';
export const MATCH_DIMENSION_KEYS = ['tech_stack', 'experience_fit', 'work_mode', 'salary_fit', 'career_alignment'] as const;
export type MatchDimensionKey = (typeof MATCH_DIMENSION_KEYS)[number];
export type MatchKind = 'triage' | 'deep';
export type MatchBreakdown = Record<MatchDimensionKey, number>;
export const MATCH_DIMENSION_LABELS: Record<MatchDimensionKey, string> = {
  tech_stack: 'Competencias', experience_fit: 'Experiencia', work_mode: 'Modalidad', salary_fit: 'Salario', career_alignment: 'Alineación',
};
export const MATCH_WEIGHTS: Record<MatchDimensionKey, number> = {
  tech_stack: 0.3, experience_fit: 0.25, work_mode: 0.2, salary_fit: 0.15, career_alignment: 0.1,
};
export type MatchScoreLabel = 'Match Alto' | 'Match Medio' | 'Match Bajo';
export type MatchRedFlag = { title: string; description: string };
export type EvidenceSource = { id: string; text: string };
export type EvidenceQuote = { sourceId: string; quote: string };
export type CandidateEvidence = {
  card: string;
  sourceHash: string;
  sources: EvidenceSource[];
  /** True only when all supplied profile/CV evidence fits in the model context. */
  complete: boolean;
  sufficient: boolean;
  totalExperienceYears: number | null;
};
export type MatchOfferCard = {
  id: string; title: string; company: string; platform?: string;
  language: OfferLanguage; workplace: OfferWorkplace; salaryMax: number | null;
  requiredEnglish: CefrLevel | null; location?: string; tldr?: string; signals: string;
  requirementsExtract: string;
  sourceText: string;
  sourceHash: string;
  complete: boolean;
  sufficient: boolean;
  languageRequirements?: Array<{ language: string; minimumLevel: CefrLevel | null; required: boolean; evidence: string }>;
};
export type RequirementKind = 'skill' | 'experience' | 'seniority' | 'language' | 'other';
export type RequirementStatus = 'met' | 'missing' | 'partial' | 'unknown';
export type MatchRequirement = {
  id: string;
  name: string;
  kind: RequirementKind;
  importance: 'required' | 'preferred';
  core: boolean;
  status: RequirementStatus;
  offerEvidence: EvidenceQuote;
  candidateEvidence: EvidenceQuote[];
  alternatives: string[];
  requiredYears?: number;
  candidateYears?: number;
  candidateYearsIsUpperBound?: boolean;
  /** Both scopes must agree; software-wide years cannot stand in for years in AI. */
  experienceScope?: string;
  candidateExperienceScope?: string;
};
export type MatchAdjustment = {
  code: 'experience_gap' | 'core_skill_gap' | 'seniority_gap' | 'user_preference';
  requirementIds: string[];
  dimension?: MatchDimensionKey;
  dimensionCap?: number;
  overallCap: number;
  reason: string;
};
export type MatchEvidenceSnapshot = {
  version: string;
  sourceHash: string;
  inputHash: string;
  score: number;
  baseScore: number;
  baseBreakdown: MatchBreakdown;
  scoreBreakdown: MatchBreakdown;
  requirements: MatchRequirement[];
  adjustments: MatchAdjustment[];
  candidateComplete: boolean;
  offerComplete: boolean;
  rejectedByPreference?: boolean;
};
export type MatchDetails = {
  version: string;
  inputHash: string;
  summary: string;
  dimensions: Array<{ key: MatchDimensionKey; explanation: string; requirementIds: string[] }>;
  requirements: Array<{ requirementId: string; explanation: string }>;
  nextSteps: string[];
};
export type LlmMatchItem = {
  id?: string; tech_stack?: unknown; experience_fit?: unknown; work_mode?: unknown;
  salary_fit?: unknown; career_alignment?: unknown; requirements?: unknown;
  dimensions?: unknown; scoreBreakdown?: unknown; score?: unknown; decision?: unknown;
  fitReason?: unknown; highlightSkills?: unknown; presentKeywords?: unknown;
  missingKeywords?: unknown; redFlags?: unknown; verdict?: unknown; violatedRules?: unknown;
};
export type CuratedMatchItem = {
  id: string; title: string; company: string; score: number; scoreLabel: MatchScoreLabel;
  decision: 'keep' | 'archive'; fitReason: string; highlightSkills: string[];
  scoreBreakdown: MatchBreakdown; inputHash: string; sourceHash: string; kind: MatchKind;
  evidence: MatchEvidenceSnapshot;
  evaluationStartedAt?: string;
  details?: MatchDetails;
  presentKeywords?: string[]; missingKeywords?: string[]; redFlags?: MatchRedFlag[]; verdict?: string;
};
export class MatchValidationError extends Error {
  constructor(message: string, public readonly code: 'invalid_output' | 'insufficient_input' = 'invalid_output') {
    super(message);
    this.name = 'MatchValidationError';
  }
}
