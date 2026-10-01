import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNewUserSimulationEnabled,
  verifySimulationPayload,
} from '@/lib/debug-simulation';

test('isNewUserSimulationEnabled respects AI_PROMPT_DEBUG and AI_PROMPTS_DEBUG', () => {
  const prevDebug = process.env.AI_PROMPT_DEBUG;
  const prevPrompts = process.env.AI_PROMPTS_DEBUG;
  const prevPublic = process.env.NEXT_PUBLIC_AI_PROMPT_DEBUG;

  try {
    delete process.env.AI_PROMPT_DEBUG;
    delete process.env.AI_PROMPTS_DEBUG;
    delete process.env.NEXT_PUBLIC_AI_PROMPT_DEBUG;
    delete process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG;
    assert.equal(isNewUserSimulationEnabled(), false);

    process.env.AI_PROMPT_DEBUG = 'true';
    assert.equal(isNewUserSimulationEnabled(), true);

    process.env.AI_PROMPT_DEBUG = 'false';
    assert.equal(isNewUserSimulationEnabled(), false);

    delete process.env.AI_PROMPT_DEBUG;
    process.env.AI_PROMPTS_DEBUG = 'true';
    assert.equal(isNewUserSimulationEnabled(), true);

    delete process.env.AI_PROMPTS_DEBUG;
    process.env.NEXT_PUBLIC_AI_PROMPT_DEBUG = 'true';
    assert.equal(isNewUserSimulationEnabled(), true);
  } finally {
    if (prevDebug !== undefined) process.env.AI_PROMPT_DEBUG = prevDebug;
    else delete process.env.AI_PROMPT_DEBUG;

    if (prevPrompts !== undefined) process.env.AI_PROMPTS_DEBUG = prevPrompts;
    else delete process.env.AI_PROMPTS_DEBUG;

    if (prevPublic !== undefined) process.env.NEXT_PUBLIC_AI_PROMPT_DEBUG = prevPublic;
    else delete process.env.NEXT_PUBLIC_AI_PROMPT_DEBUG;
  }
});

test('verifySimulationPayload verifies HMAC signature and detects tampering', () => {
  const createHmac = require('crypto').createHmac;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-simulation-fallback-secret-matchply';

  const validPayload = JSON.stringify({
    originalUserId: 'user-123',
    sandboxUserId: 'sandbox-456',
    createdAt: Date.now(),
  });

  const validHmac = createHmac('sha256', secret).update(validPayload).digest('hex');
  const validToken = `${Buffer.from(validPayload).toString('base64url')}.${validHmac}`;

  const verified = verifySimulationPayload(validToken);
  assert.ok(verified);
  assert.equal(verified?.originalUserId, 'user-123');
  assert.equal(verified?.sandboxUserId, 'sandbox-456');

  // Tampered payload
  const tamperedPayload = JSON.stringify({
    originalUserId: 'hacker-999',
    sandboxUserId: 'sandbox-456',
    createdAt: Date.now(),
  });
  const tamperedToken = `${Buffer.from(tamperedPayload).toString('base64url')}.${validHmac}`;
  assert.equal(verifySimulationPayload(tamperedToken), null);

  // Invalid token format
  assert.equal(verifySimulationPayload('invalid-token'), null);
  assert.equal(verifySimulationPayload('a.b.c'), null);
});
