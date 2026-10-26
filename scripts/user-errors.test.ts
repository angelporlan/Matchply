import test from 'node:test';
import assert from 'node:assert/strict';
import { userError, userErrorMessage, publicUsageDetails } from '@/lib/user-errors';
import { publicErrorBody } from '@/lib/public-errors';
import { UsageError } from '@/lib/usage';
import { AccountSuspendedError } from '@/lib/request-errors';
import { AiProviderError } from '@/lib/ai-provider-errors';
import { aiUsageErrorResponse } from '@/lib/ai-usage-http';

test('public errors translate known codes into a human message and the next action in both languages', () => {
  for (const language of ['es', 'en'] as const) {
    assert.equal(userError({ code: 'OFFER_PORTAL_BLOCKED' }, language).action, 'paste');
    assert.equal(userError('RATE_LIMITED', language).action, 'wait');
    assert.equal(userError('AUTH_REQUIRED', language).action, 'sign-in');
    assert.equal(userError('VARIANT_REVISION_CONFLICT', language).action, 'reload');
    assert.equal(userError('UNEXPECTED_ERROR', language).action, 'retry');
    assert.doesNotMatch(userErrorMessage('OFFER_PORTAL_BLOCKED', language), /403|OFFER_|Forbidden/);
  }
  assert.match(userErrorMessage('OFFER_PORTAL_BLOCKED'), /Pega aquí/);
  assert.match(userErrorMessage('OFFER_PORTAL_BLOCKED', 'en'), /Paste/);
  assert.equal(userErrorMessage(userError('OPERATION_IN_PROGRESS').error, 'en'), userErrorMessage('OPERATION_IN_PROGRESS', 'en'));
});

test('unknown browser and server exceptions cannot disclose SQL, credentials or provider details', () => {
  const privateDetail = 'postgres://private:password@db/private SELECT secret OPENAI_API_KEY sk-private <script>';
  for (const error of [new Error(privateDetail), { status: 401, code: 'invalid_api_key', error: privateDetail }, privateDetail]) {
    assert.doesNotMatch(JSON.stringify(publicErrorBody(error)), /postgres|password|SELECT|API_KEY|sk-private|script/);
    assert.doesNotMatch(userErrorMessage(error), /postgres|password|SELECT|API_KEY|sk-private|script/);
  }
  assert.equal(publicErrorBody(new AiProviderError('AI_HTTP_401')).code, 'AI_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(publicErrorBody(new AccountSuspendedError(privateDetail))), /sk-private|SELECT/);
  assert.equal(aiUsageErrorResponse(Object.assign(new Error(privateDetail), { status: 401, code: 'AUTH_REQUIRED' })), null);
});

test('quota metadata survives without forwarding private diagnostic fields', async () => {
  const details = { bucket: 'general', required: 1, usage: { used: 9, reserved: 1, limit: 10, remaining: 0, resetAt: '2026-11-01T00:00:00.000Z', raw: 'private upstream body' }, sql: 'SELECT private', key: 'sk-private' };
  const error = new UsageError(429, 'QUOTA_EXCEEDED', 'private provider response', details);
  const body = error.toJSON();
  assert.equal(body.code, 'QUOTA_EXCEEDED'); assert.equal(body.action, 'review');
  assert.equal(body.bucket, 'general'); assert.equal(body.required, 1);
  assert.deepEqual(body.usage, { used: 9, reserved: 1, limit: 10, remaining: 0, resetAt: '2026-11-01T00:00:00.000Z' });
  assert.doesNotMatch(JSON.stringify(body), /private|SELECT|sk-/);
  assert.deepEqual(await aiUsageErrorResponse(error)?.json(), body);
  assert.equal(new UsageError(400, 'sk-private', 'private').toJSON().code, 'INVALID_INPUT');
  const circular: Record<string, unknown> = { limit: 10 }; circular.usage = circular;
  assert.deepEqual(publicUsageDetails(circular), { limit: 10, usage: { limit: 10 } });
});
