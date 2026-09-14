import type { CefrLevel, OfferLanguage, OfferWorkplace } from '@/lib/curation-constraints';

export type { OfferWorkplace };

export const MATCH_PROMPT_VERSION = '2026-09-2';

export const MATCH_DIMENSION_KEYS = [
  'tech_stack',
  'experience_fit',
  'work_mode',
  'salary_fit',
  'career_alignment',
] as const;

export type MatchDimensionKey = (typeof MATCH_DIMENSION_KEYS)[number];
export type MatchKind = 'triage' | 'deep';
export type MatchBreakdown = Record<MatchDimensionKey, number>;

export const MATCH_DIMENSION_LABELS: Record<MatchDimensionKey, string> = {
  tech_stack: 'Stack',
  experience_fit: 'Experiencia',
  work_mode: 'Modalidad',
  salary_fit: 'Salario',
  career_alignment: 'Alineación',
};

export const MATCH_WEIGHTS: Record<MatchDimensionKey, number> = {
  tech_stack: 0.3,
  experience_fit: 0.25,
  work_mode: 0.2,
  salary_fit: 0.15,
  career_alignment: 0.1,
};

export type MatchScoreLabel = 'Match Alto' | 'Match Medio' | 'Match Bajo';

export type MatchRedFlag = {
  title: string;
  description: string;
};

export type MatchOfferCard = {
  id: string;
  title: string;
  company: string;
  platform?: string;
  language: OfferLanguage;
  workplace: OfferWorkplace;
  salaryMax: number | null;
  requiredEnglish: CefrLevel | null;
  location?: string;
  tldr?: string;
  signals: string;
  requirementsExtract: string;
};

export type LlmMatchItem = {
  id?: string;
  tech_stack?: unknown;
  experience_fit?: unknown;
  work_mode?: unknown;
  salary_fit?: unknown;
  career_alignment?: unknown;
  dimensions?: unknown;
  scoreBreakdown?: unknown;
  score?: unknown;
  decision?: unknown;
  fitReason?: unknown;
  highlightSkills?: unknown;
  presentKeywords?: unknown;
  missingKeywords?: unknown;
  redFlags?: unknown;
  verdict?: unknown;
  violatedRules?: unknown;
};

export type CuratedMatchItem = {
  id: string;
  title: string;
  company: string;
  score: number;
  scoreLabel: MatchScoreLabel;
  decision: 'keep' | 'archive';
  fitReason: string;
  highlightSkills: string[];
  scoreBreakdown: MatchBreakdown;
  inputHash: string;
  kind: MatchKind;
  presentKeywords?: string[];
  missingKeywords?: string[];
  redFlags?: MatchRedFlag[];
  verdict?: string;
};
