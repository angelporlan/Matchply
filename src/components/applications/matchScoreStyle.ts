export type MatchScoreBand = 'none' | 'low' | 'mid' | 'high';

/** 0–39 muted, 40–69 warning, 70–100 success. Null is never a pink or brand color. */
export function matchScoreBand(percent: number | null): MatchScoreBand {
  if (percent === null || !Number.isFinite(percent)) return 'none';
  if (percent >= 70) return 'high';
  if (percent >= 40) return 'mid';
  return 'low';
}

export function matchScoreBadgeClass(percent: number | null): string {
  switch (matchScoreBand(percent)) {
    case 'high':
      return 'text-success-text bg-success-surface border-success-text/20';
    case 'mid':
      return 'text-warning-text bg-warning-surface border-warning-text/20';
    default:
      return 'text-text-muted bg-surface-muted border-subtle';
  }
}

export function matchScoreStrokeClass(percent: number | null): string {
  switch (matchScoreBand(percent)) {
    case 'high':
      return 'stroke-success-text';
    case 'mid':
      return 'stroke-warning-text';
    default:
      return 'stroke-text-muted';
  }
}
