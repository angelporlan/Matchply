import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '@/lib/ai-service';
import { AI_PUBLIC_ERROR, AiProviderError, publicAiFailure, publicAiJobResult } from '@/lib/ai-provider-errors';
import { aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { UsageError } from '@/lib/usage';

test('provider response and configuration details never become a public message', async () => {
  const fetchBefore = globalThis.fetch, keyBefore = process.env.OPENAI_API_KEY, mockBefore = process.env.ALLOW_AI_MOCK;
  try {
    process.env.ALLOW_AI_MOCK = 'false';
    process.env.OPENAI_API_KEY = 'synthetic-provider-key';
    globalThis.fetch = async () => new Response('Incorrect API key sk-private; project private-project; edit OPENAI_API_KEY', { status: 401 });
    await assert.rejects(AIService.probeModel('openai', 'synthetic-model'), error => {
      assert.ok(error instanceof AiProviderError);
      assert.equal(error.code, 'AI_HTTP_401');
      assert.equal(error.message, AI_PUBLIC_ERROR);
      assert.equal(aiUsageErrorResponse(error), null);
      return true;
    });
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(AIService.probeModel('openai', 'synthetic-model'), { message: AI_PUBLIC_ERROR, code: 'AI_NOT_CONFIGURED' });
    assert.doesNotMatch(JSON.stringify(publicAiFailure('request-123')), /API_KEY|sk-private|project|401/);
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = keyBefore;
    if (mockBefore === undefined) delete process.env.ALLOW_AI_MOCK; else process.env.ALLOW_AI_MOCK = mockBefore;
  }
});

test('an arbitrary SDK status cannot bypass the private-error boundary, while quota errors retain their action', async () => {
  const sdkError = Object.assign(new Error('Incorrect API key sk-private'), { status: 401, code: 'invalid_api_key' });
  assert.equal(aiUsageErrorResponse(sdkError), null);
  const response = aiUsageErrorResponse(new UsageError(429, 'QUOTA_EXCEEDED', 'Has alcanzado tu límite mensual.', { limit: 10 }));
  assert.equal(response?.status, 429);
  assert.deepEqual(await response?.json(), { error: 'Has alcanzado tu límite mensual.', code: 'QUOTA_EXCEEDED', limit: 10 });
});

test('legacy persisted errors are hidden without touching successful CV content', () => {
  const result = publicAiJobResult({ cvId: 'cv', variants: [{ status: 'ready', content: '# Ana', error: null }, { status: 'error', error: 'OPENAI_API_KEY private details' }], errors: [{ id: 'offer', message: 'Incorrect API key sk-private' }] });
  assert.doesNotMatch(JSON.stringify(result), /OPENAI|API key|sk-private/);
  assert.match(JSON.stringify(result), /# Ana/);
});
