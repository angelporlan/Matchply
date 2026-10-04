export const LANDING_DEMO_STAGE_MS = 3_000;
export const LANDING_DEMO_DURATION_MS = LANDING_DEMO_STAGE_MS * 4;

export type LandingDemoStage = 0 | 1 | 2 | 3;

/** The last frame stays visible after the one-shot, twelve-second walkthrough. */
export function landingDemoStage(elapsedMs: number): LandingDemoStage {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.min(3, Math.floor(elapsed / LANDING_DEMO_STAGE_MS)) as LandingDemoStage;
}

export function advanceLandingDemo(elapsedMs: number, deltaMs: number): number {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const delta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  return Math.min(LANDING_DEMO_DURATION_MS, elapsed + delta);
}

export function canPlayLandingDemo(state: {
  inView: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
  paused: boolean;
  complete: boolean;
}): boolean {
  return state.inView && state.documentVisible && !state.reducedMotion && !state.paused && !state.complete;
}
