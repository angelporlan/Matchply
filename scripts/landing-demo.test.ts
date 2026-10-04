import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceLandingDemo,
  canPlayLandingDemo,
  landingDemoStage,
  LANDING_DEMO_DURATION_MS,
} from '@/lib/landing-demo';

test('the four frames last three seconds each, then the PDF remains visible', () => {
  assert.equal(LANDING_DEMO_DURATION_MS, 12_000);
  assert.deepEqual(
    [0, 2_999, 3_000, 5_999, 6_000, 8_999, 9_000, 12_000, 30_000].map(landingDemoStage),
    [0, 0, 1, 1, 2, 2, 3, 3, 3],
  );
});

test('elapsed time is bounded, including bad clocks and a delayed timer', () => {
  assert.equal(advanceLandingDemo(2_000, 300), 2_300);
  assert.equal(advanceLandingDemo(11_900, 50_000), 12_000);
  assert.equal(advanceLandingDemo(2_000, -300), 2_000);
  assert.equal(advanceLandingDemo(NaN, 300), 300);
  assert.equal(advanceLandingDemo(2_000, Infinity), 2_000);
  assert.equal(landingDemoStage(-3_000), 0);
  assert.equal(landingDemoStage(NaN), 0);
});

test('playback requires visibility and stops for reduced motion, pause or completion', () => {
  const active = { inView: true, documentVisible: true, reducedMotion: false, paused: false, complete: false };
  assert.equal(canPlayLandingDemo(active), true);
  assert.equal(canPlayLandingDemo({ ...active, inView: false }), false);
  assert.equal(canPlayLandingDemo({ ...active, documentVisible: false }), false);
  assert.equal(canPlayLandingDemo({ ...active, reducedMotion: true }), false);
  assert.equal(canPlayLandingDemo({ ...active, paused: true }), false);
  assert.equal(canPlayLandingDemo({ ...active, complete: true }), false);
});
