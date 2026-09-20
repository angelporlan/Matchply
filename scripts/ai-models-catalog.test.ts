import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultModelCatalog,
  parseModelCatalog,
  getModelsForPlanAndProvider,
  getDefaultModelForProvider,
  CustomModelConfig,
} from '@/lib/models';

test('getDefaultModelCatalog provides valid initial defaults', () => {
  const defaults = getDefaultModelCatalog();
  assert.ok(Array.isArray(defaults));
  assert.ok(defaults.length > 5);

  const geminiFlash = defaults.find((m) => m.value === 'gemini-2.5-flash');
  assert.ok(geminiFlash);
  assert.equal(geminiFlash.provider, 'gemini');
  assert.equal(geminiFlash.value, 'gemini-2.5-flash');
  assert.ok(geminiFlash.plans.includes('free') && geminiFlash.plans.includes('pro'));
  assert.equal(geminiFlash.isBuiltin, true);

  const deepseekReasoner = defaults.find((m) => m.value === 'deepseek-reasoner');
  assert.ok(deepseekReasoner);
  assert.equal(deepseekReasoner.provider, 'deepseek');
  assert.ok(deepseekReasoner.plans.includes('pro'));
});

test('parseModelCatalog falls back safely on empty or invalid input', () => {
  const fallback = getDefaultModelCatalog();

  assert.deepEqual(parseModelCatalog(null), fallback);
  assert.deepEqual(parseModelCatalog(undefined), fallback);
  assert.deepEqual(parseModelCatalog(''), fallback);
  assert.deepEqual(parseModelCatalog('{ not: "an array" }'), fallback);
  assert.deepEqual(parseModelCatalog('invalid json['), fallback);
  assert.deepEqual(parseModelCatalog('[]'), fallback);
});

test('parseModelCatalog parses and validates custom model configs', () => {
  const customModels: CustomModelConfig[] = [
    {
      id: 'custom-gpt-4o',
      label: 'OpenAI GPT-4o',
      value: 'openai/gpt-4o',
      provider: 'openrouter',
      plans: ['pro'],
      description: 'Super model',
      isBuiltin: false,
    },
    {
      id: 'custom-gemini-nano',
      label: ' Gemini Nano ',
      value: ' gemini-nano ',
      provider: 'gemini',
      plans: ['free', 'pro'],
      isBuiltin: false,
    },
  ];

  const parsed = parseModelCatalog(JSON.stringify(customModels));
  assert.equal(parsed.length, 2);

  assert.equal(parsed[0].id, 'custom-gpt-4o');
  assert.equal(parsed[0].label, 'OpenAI GPT-4o');
  assert.equal(parsed[0].value, 'openai/gpt-4o');
  assert.equal(parsed[0].provider, 'openrouter');
  assert.deepEqual(parsed[0].plans, ['pro']);

  assert.equal(parsed[1].label, 'Gemini Nano');
  assert.equal(parsed[1].value, 'gemini-nano');
  assert.equal(parsed[1].provider, 'gemini');
  assert.deepEqual(parsed[1].plans, ['free', 'pro']);
});

test('parseModelCatalog deduplicates by id and by provider+value', () => {
  const duplicates = [
    {
      id: 'model-1',
      label: 'Model 1',
      value: 'provider-model-v1',
      provider: 'gemini',
      plans: ['free'],
    },
    {
      id: 'model-1', // duplicate id
      label: 'Model 1 Duplicate',
      value: 'provider-model-v2',
      provider: 'gemini',
      plans: ['free'],
    },
    {
      id: 'model-2',
      label: 'Model 2 Duplicate value',
      value: 'provider-model-v1', // duplicate provider+value
      provider: 'gemini',
      plans: ['free'],
    },
  ];

  const parsed = parseModelCatalog(JSON.stringify(duplicates));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'model-1');
  assert.equal(parsed[0].label, 'Model 1');
});

test('getModelsForPlanAndProvider filters correctly by plan and provider', () => {
  const catalog: CustomModelConfig[] = [
    {
      id: 'gemini-free',
      label: 'Gemini Free Only',
      value: 'gemini-free',
      provider: 'gemini',
      plans: ['free'],
    },
    {
      id: 'gemini-pro',
      label: 'Gemini Pro Only',
      value: 'gemini-pro',
      provider: 'gemini',
      plans: ['pro'],
    },
    {
      id: 'gemini-both',
      label: 'Gemini Both',
      value: 'gemini-both',
      provider: 'gemini',
      plans: ['free', 'pro'],
    },
    {
      id: 'openrouter-pro',
      label: 'OR Pro',
      value: 'openrouter-pro',
      provider: 'openrouter',
      plans: ['pro'],
    },
  ];

  const geminiFreeModels = getModelsForPlanAndProvider(catalog, 'free', 'gemini');
  assert.equal(geminiFreeModels.length, 2);
  assert.ok(geminiFreeModels.some((m) => m.value === 'gemini-free'));
  assert.ok(geminiFreeModels.some((m) => m.value === 'gemini-both'));
  assert.ok(!geminiFreeModels.some((m) => m.value === 'gemini-pro'));

  const geminiProModels = getModelsForPlanAndProvider(catalog, 'pro', 'gemini');
  assert.equal(geminiProModels.length, 2);
  assert.ok(geminiProModels.some((m) => m.value === 'gemini-pro'));
  assert.ok(geminiProModels.some((m) => m.value === 'gemini-both'));

  const openrouterFreeModels = getModelsForPlanAndProvider(catalog, 'free', 'openrouter');
  assert.equal(openrouterFreeModels.length, 0);
});

test('getModelsForPlanAndProvider preserves current selected value if missing from filtered list', () => {
  const catalog: CustomModelConfig[] = [
    {
      id: 'gemini-both',
      label: 'Gemini Both',
      value: 'gemini-both',
      provider: 'gemini',
      plans: ['free', 'pro'],
    },
  ];

  const models = getModelsForPlanAndProvider(catalog, 'free', 'gemini', 'legacy-model-v0');
  assert.equal(models.length, 2);
  assert.ok(models.some((m) => m.value === 'legacy-model-v0'));
  assert.ok(models.some((m) => m.value === 'gemini-both'));
});

test('getDefaultModelForProvider picks default from catalog or first available', () => {
  const catalog: CustomModelConfig[] = [
    {
      id: 'or-1',
      label: 'OR Model 1',
      value: 'meta-llama/llama-3.3-70b-instruct',
      provider: 'openrouter',
      plans: ['pro'],
      isBuiltin: true,
    },
    {
      id: 'or-2',
      label: 'OR Model 2',
      value: 'anthropic/claude-3.5-sonnet',
      provider: 'openrouter',
      plans: ['pro'],
      isBuiltin: false,
    },
  ];

  const defaultModel = getDefaultModelForProvider('pro', 'openrouter', catalog);
  assert.equal(defaultModel, 'meta-llama/llama-3.3-70b-instruct');
});
