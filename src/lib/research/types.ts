export const RESEARCH_AGENT_ROLES = [
  'offer_fit',
  'company',
  'people',
  'history_news',
  'verification_risk',
] as const;

export type ResearchAgentRole = typeof RESEARCH_AGENT_ROLES[number];
export type ResearchStatus = 'not_requested' | 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'quota_exceeded';

export type ResearchSource = {
  url: string;
  canonicalUrl: string;
  title?: string | null;
  domain?: string | null;
  sourceType?: string;
  publishedAt?: string | null;
  excerpt?: string | null;
  confidence?: number | null;
};

export type ResearchAgentResult = {
  role: ResearchAgentRole | 'synthesizer';
  status: 'completed' | 'partial' | 'not_applicable' | 'failed';
  summary?: string;
  findings?: Array<{ claim: string; evidence?: string; confidence?: number }>;
  strengths?: string[];
  redFlags?: string[];
  unknowns?: string[];
  nextSteps?: string[];
  score?: number | null;
  confidence?: number | null;
  sources?: ResearchSource[];
  [key: string]: unknown;
};

export type ResearchReport = {
  version: 1;
  executiveSummary: string;
  recommendation: 'prioritize' | 'consider' | 'caution' | 'avoid' | 'insufficient_evidence';
  score: number | null;
  confidence: number | null;
  offerAnalysis: ResearchAgentResult;
  companyAnalysis: ResearchAgentResult;
  peopleAnalysis: ResearchAgentResult;
  historyNews: ResearchAgentResult;
  verificationRisk: ResearchAgentResult;
  strengths: string[];
  redFlags: string[];
  unknowns: string[];
  nextSteps: string[];
  sources: ResearchSource[];
  generatedAt: string;
};

export function clampScore(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function clampConfidence(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1, number));
}
