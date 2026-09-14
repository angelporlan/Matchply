import {
  MATCH_DIMENSION_KEYS,
  MATCH_WEIGHTS,
  type MatchBreakdown,
  type MatchDimensionKey,
  type MatchScoreLabel,
} from './types';

const LEGACY_DIMENSION_ALIASES: Record<string, MatchDimensionKey> = {
  tech_stack: 'tech_stack',
  tech: 'tech_stack',
  stack: 'tech_stack',
  technical: 'tech_stack',
  technical_skills: 'tech_stack',
  experience_fit: 'experience_fit',
  experience: 'experience_fit',
  experience_match: 'experience_fit',
  work_mode: 'work_mode',
  location: 'work_mode',
  remote: 'work_mode',
  workplace: 'work_mode',
  salary_fit: 'salary_fit',
  salary: 'salary_fit',
  comp: 'salary_fit',
  compensation: 'salary_fit',
  career_alignment: 'career_alignment',
  career: 'career_alignment',
  culture: 'career_alignment',
  culture_alignment: 'career_alignment',
};

export function clampMatchScore(value: unknown, fallback = 50): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.max(0, Math.min(100, numeric)));
}

export function matchScoreLabel(score: number): MatchScoreLabel {
  if (score >= 75) return 'Match Alto';
  if (score >= 60) return 'Match Medio';
  return 'Match Bajo';
}

export function computeOverall(breakdown: MatchBreakdown): number {
  let total = 0;
  for (const key of MATCH_DIMENSION_KEYS) {
    total += breakdown[key] * MATCH_WEIGHTS[key];
  }
  return clampMatchScore(total, 0);
}

export function emptyBreakdown(fill = 50): MatchBreakdown {
  return {
    tech_stack: fill,
    experience_fit: fill,
    work_mode: fill,
    salary_fit: fill,
    career_alignment: fill,
  };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function scaleDimensionValues(values: number[]): number[] {
  if (values.length === 0) return values;
  const looksLikeFivePoint = values.every((value) => value > 0 && value <= 5);
  return looksLikeFivePoint ? values.map((value) => clampMatchScore(value * 20, 0)) : values.map((value) => clampMatchScore(value, 0));
}

function fillBreakdown(partial: Partial<MatchBreakdown>, fallbackScore?: number): MatchBreakdown {
  const present = MATCH_DIMENSION_KEYS
    .map((key) => partial[key])
    .filter((value): value is number => typeof value === 'number');
  const fill = present.length
    ? clampMatchScore(present.reduce((sum, value) => sum + value, 0) / present.length, 50)
    : clampMatchScore(fallbackScore, 50);

  return {
    tech_stack: partial.tech_stack ?? fill,
    experience_fit: partial.experience_fit ?? fill,
    work_mode: partial.work_mode ?? fill,
    salary_fit: partial.salary_fit ?? fill,
    career_alignment: partial.career_alignment ?? fill,
  };
}

function collectFromObject(raw: Record<string, unknown>): Partial<MatchBreakdown> {
  const pending: Array<{ key: MatchDimensionKey; value: number }> = [];
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = LEGACY_DIMENSION_ALIASES[rawKey.trim().toLowerCase().replace(/\s+/g, '_')];
    const value = toFiniteNumber(rawValue);
    if (key && value !== null) pending.push({ key, value });
  }
  const scaled = scaleDimensionValues(pending.map((item) => item.value));
  const partial: Partial<MatchBreakdown> = {};
  pending.forEach((item, index) => {
    if (partial[item.key] === undefined) partial[item.key] = scaled[index];
  });
  return partial;
}

function collectFromLegacyDimensions(raw: unknown): Partial<MatchBreakdown> {
  if (!Array.isArray(raw)) return {};
  const pending: Array<{ key: MatchDimensionKey; value: number }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as { name?: unknown; percentage?: unknown; score?: unknown };
    const name = typeof row.name === 'string' ? row.name : '';
    const key = LEGACY_DIMENSION_ALIASES[name.trim().toLowerCase().replace(/\s+/g, '_')];
    const value = toFiniteNumber(row.percentage ?? row.score);
    if (key && value !== null) pending.push({ key, value });
  }
  const scaled = scaleDimensionValues(pending.map((item) => item.value));
  const partial: Partial<MatchBreakdown> = {};
  pending.forEach((item, index) => {
    if (partial[item.key] === undefined) partial[item.key] = scaled[index];
  });
  return partial;
}

export function isCanonicalMatchBreakdown(value: unknown): value is MatchBreakdown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return MATCH_DIMENSION_KEYS.every((key) => {
    const score = record[key];
    return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
  });
}

export function isResearchBreakdown(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ['company', 'people', 'offerFit', 'verificationRisk', 'historyNews']
    .some((key) => key in record);
}

export function isProfileMatchScore(
  score: number | null | undefined,
  breakdown?: unknown,
): boolean {
  if (score === null || score === undefined || !Number.isFinite(score)) return false;
  if (isResearchBreakdown(breakdown)) return false;
  if (isCanonicalMatchBreakdown(breakdown)) return true;
  return score > 5;
}

export function resolveMatchBreakdown(item: {
  tech_stack?: unknown;
  experience_fit?: unknown;
  work_mode?: unknown;
  salary_fit?: unknown;
  career_alignment?: unknown;
  dimensions?: unknown;
  scoreBreakdown?: unknown;
  score?: unknown;
}): MatchBreakdown {
  const fromFields = collectFromObject({
    tech_stack: item.tech_stack,
    experience_fit: item.experience_fit,
    work_mode: item.work_mode,
    salary_fit: item.salary_fit,
    career_alignment: item.career_alignment,
  });
  if (MATCH_DIMENSION_KEYS.some((key) => fromFields[key] != null)) {
    return fillBreakdown(fromFields, toFiniteNumber(item.score) ?? undefined);
  }

  if (item.scoreBreakdown && !isResearchBreakdown(item.scoreBreakdown) && typeof item.scoreBreakdown === 'object') {
    const stored = collectFromObject(item.scoreBreakdown as Record<string, unknown>);
    if (Object.keys(stored).length > 0) {
      return fillBreakdown(stored, toFiniteNumber(item.score) ?? undefined);
    }
  }

  const legacy = collectFromLegacyDimensions(item.dimensions);
  if (Object.keys(legacy).length > 0) {
    return fillBreakdown(legacy, toFiniteNumber(item.score) ?? undefined);
  }

  return emptyBreakdown(clampMatchScore(item.score, 50));
}
