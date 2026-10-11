import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldResetAiOperation } from '../src/lib/ai-operation-retry';

test('only explicit release permits a fresh operation on the next user attempt', () => {
  assert.equal(shouldResetAiOperation({ code: 'OPERATION_RELEASED', error: 'The previous attempt failed' }), true);
  assert.equal(shouldResetAiOperation({ error: { code: 'operation_released', message: 'Failed' } }), true);
});

test('ambiguous delivery, an active job and a committed result preserve recovery identity', () => {
  for (const result of [
    new Error('Failed to fetch'), new Error('INCOMPLETE_AI_STREAM'), null, undefined,
    { code: 'OPERATION_IN_PROGRESS' }, { success: true, cvId: 'persisted-result' },
    { status: 'reserved' }, { status: 'consumed' }, { code: 'RATE_LIMITED' },
    { code: 'OPERATION_CONFLICT' }, { error: 'OPERATION_RELEASED' },
  ]) assert.equal(shouldResetAiOperation(result), false);
});
