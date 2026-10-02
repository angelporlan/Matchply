import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultModelCatalog,
  parseModelCatalog,
  getModelsForPlanAndProvider,
  getDefaultModelForProvider,
  GLOBAL_FREE_MODELS,
  GLOBAL_PRO_MODELS,
  DEFAULT_PRO_PROVIDER,
  DEFAULT_PRO_MODEL,
} from '@/lib/models';
import {
  defaultAiRuntimeConfig,
  isSupportedProvider,
  resolveModelForFunction,
} from '@/lib/ai-runtime-config';

test('openai provider is supported and includes gpt-6-luna in catalogs and defaults', () => {
  assert.equal(isSupportedProvider('openai'), true);

  // Defaults
  assert.equal(DEFAULT_PRO_PROVIDER, 'openai');
  assert.equal(DEFAULT_PRO_MODEL, 'gpt-6-luna');

  // Global model lists
  assert.ok(GLOBAL_FREE_MODELS.openai.some((m) => m.value === 'gpt-6-luna'));
  assert.ok(GLOBAL_PRO_MODELS.openai.some((m) => m.value === 'gpt-6-luna'));

  // Default model catalog
  const catalog = getDefaultModelCatalog();
  const lunaModel = catalog.find((m) => m.provider === 'openai' && m.value === 'gpt-6-luna');
  assert.ok(lunaModel, 'gpt-6-luna should exist in default catalog');
  assert.equal(lunaModel.provider, 'openai');
  assert.ok(lunaModel.plans.includes('pro'));
});

test('runtime config defaults route to openai gpt-6-luna', () => {
  const config = defaultAiRuntimeConfig();
  assert.equal(config.general.pro.provider, 'openai');
  assert.equal(config.general.pro.model, 'gpt-6-luna');

  const resolved = resolveModelForFunction(config, 'optimize_cv', 'pro');
  assert.equal(resolved.ref.provider, 'openai');
  assert.equal(resolved.ref.model, 'gpt-6-luna');
  assert.equal(resolved.inherited, true);
});

test('getModelsForPlanAndProvider returns openai models including gpt-6-luna', () => {
  const catalog = getDefaultModelCatalog();
  const proOpenAiModels = getModelsForPlanAndProvider(catalog, 'pro', 'openai');
  assert.ok(proOpenAiModels.length > 0);
  assert.ok(proOpenAiModels.some((m) => m.value === 'gpt-6-luna'));

  const defaultModel = getDefaultModelForProvider('pro', 'openai', catalog);
  assert.equal(defaultModel, 'gpt-6-luna');
});

test('parseModelCatalog correctly handles custom openai configs', () => {
  const custom = [
    {
      id: 'custom-openai-gpt-6-luna',
      label: 'GPT-6 Luna (Custom)',
      value: 'gpt-6-luna',
      provider: 'openai',
      plans: ['pro'],
    },
  ];
  const parsed = parseModelCatalog(JSON.stringify(custom));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].provider, 'openai');
  assert.equal(parsed[0].value, 'gpt-6-luna');
});
