import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentApiError } from '@/lib/agent-api/errors';
import { apiTokenHint } from '@/lib/agent-api/scopes';
import { sha256Hex } from '@/lib/crypto-hash';
import {
  apiTokenIsUsable,
  generateApiToken,
  parseApiTokenScopes,
  parseBearerApiToken,
} from '@/lib/api-key-auth';

test('generateApiToken builds a stable hash and a short hint', () => {
  const first = generateApiToken();
  const second = generateApiToken();
  assert.notEqual(first.token, second.token);
  assert.match(first.token, /^mp_live_[a-f0-9]{64}$/);
  assert.equal(first.tokenHash, sha256Hex(first.token));
  assert.equal(first.lastChars, first.token.slice(-4));
  assert.equal(first.lastChars.length, 4);
  assert.equal(apiTokenHint(first.lastChars), `mp_live_…${first.lastChars}`);
});

test('parseBearerApiToken accepts only a well-formed agent key', () => {
  const { token } = generateApiToken();
  assert.equal(parseBearerApiToken(`Bearer ${token}`), token);
  assert.equal(parseBearerApiToken(null), null);
  assert.equal(parseBearerApiToken('Bearer ext_sess_' + 'a'.repeat(64)), null);
  assert.equal(parseBearerApiToken('Bearer mp_live_ab'), null);
  assert.equal(parseBearerApiToken(`Bearer ${'a'.repeat(100)}`), null);
  assert.equal(parseBearerApiToken('Bearer ' + token.toUpperCase()), null);
});

test('parseApiTokenScopes keeps a canonical list and rejects junk', () => {
  assert.deepEqual(parseApiTokenScopes(['cv:read', 'profile:read', 'cv:read']), ['profile:read', 'cv:read']);
  for (const value of [[], ['nope'], 'cv:read', null]) {
    assert.throws(() => parseApiTokenScopes(value), (error: unknown) => {
      return error instanceof AgentApiError && error.code === 'invalid_scopes' && error.status === 400;
    });
  }
});

test('apiTokenIsUsable treats revocation and expiry as dead keys', () => {
  const now = new Date('2026-09-27T12:00:00.000Z');
  assert.equal(apiTokenIsUsable({ revokedAt: null, expiresAt: null }, now), true);
  assert.equal(apiTokenIsUsable({ revokedAt: null, expiresAt: new Date('2026-09-28T00:00:00.000Z') }, now), true);
  assert.equal(apiTokenIsUsable({ revokedAt: null, expiresAt: now }, now), false);
  assert.equal(apiTokenIsUsable({ revokedAt: now, expiresAt: null }, now), false);
});
