import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_PROMPTS, getBuiltInPrompt } from '@/lib/prompt-defaults';

test('all operational prompts are available without database seed data', () => {
  for (const key of ['optimize_cv', 'import_cv', 'star_analyze', 'star_optimize', 'analyze_failures'] as const) {
    const prompt = getBuiltInPrompt(key);

    assert.ok(prompt.systemPrompt.trim(), `${key} must have a system prompt`);
    assert.ok(prompt.userPrompt.trim(), `${key} must have a user prompt`);
  }

  assert.deepEqual(Object.keys(BUILT_IN_PROMPTS).sort(), [
    'analyze_failures',
    'import_cv',
    'optimize_cv',
    'star_analyze',
    'star_optimize',
  ]);
});

test('the built-in import prompt keeps the CV input contract', () => {
  const prompt = getBuiltInPrompt('import_cv');

  assert.match(prompt.userPrompt, /\{\{cv\}\}/);
  assert.equal(prompt.isStrict, true);
  assert.match(prompt.systemPrompt, /No inventes/i);
});
