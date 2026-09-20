import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAiRuntimeConfig,
  newlyActivatedRefs,
  parseAiRuntimeConfig,
  resolveModelForFunction,
  hasSuccessfulModelTest,
} from '@/lib/ai-runtime-config';

test('function routes inherit the general model until overridden', () => {
  const config = defaultAiRuntimeConfig();
  const inherited = resolveModelForFunction(config, 'optimize_cv', 'pro');
  assert.equal(inherited.inherited, true);
  assert.equal(inherited.ref.provider, config.general.pro.provider);
  const next = parseAiRuntimeConfig({
    ...config,
    overrides: { matching: { pro: { provider: 'openrouter', model: 'test-model' } } },
  });
  const matching = resolveModelForFunction(next, 'matching', 'pro');
  assert.equal(matching.inherited, false);
  assert.equal(matching.ref.model, 'test-model');
});

test('new combinations require a successful probe before activation', () => {
  const previous = defaultAiRuntimeConfig();
  const next = parseAiRuntimeConfig({
    ...previous,
    general: {
      ...previous.general,
      pro: { provider: 'gemini', model: 'brand-new' },
    },
    tested: [{ provider: 'gemini', model: 'brand-new', testedAt: '2026-09-20T00:00:00.000Z', ok: true }],
  });
  const activated = newlyActivatedRefs(previous, next);
  assert.equal(activated.length, 1);
  assert.equal(hasSuccessfulModelTest(next, activated[0]), true);
  assert.equal(hasSuccessfulModelTest(previous, activated[0]), false);
});
