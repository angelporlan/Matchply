import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashUserApiKey,
  isPersonalApiKey,
  issueUserApiKey,
  USER_API_KEY_PREFIX,
  userApiKeyPrefix,
} from '@/lib/api-keys';

test('issued personal keys use the Matchply prefix and a stable hash', () => {
  const issued = issueUserApiKey();
  assert.equal(issued.plaintext.startsWith(USER_API_KEY_PREFIX), true);
  assert.equal(isPersonalApiKey(issued.plaintext), true);
  assert.equal(hashUserApiKey(issued.plaintext), issued.hash);
  assert.equal(userApiKeyPrefix(issued.plaintext), issued.prefix);
  assert.equal(issued.prefix.length, USER_API_KEY_PREFIX.length + 8);
  assert.notEqual(issued.hash, issued.plaintext);
});

test('two issued keys never share hash or full secret', () => {
  const a = issueUserApiKey();
  const b = issueUserApiKey();
  assert.notEqual(a.plaintext, b.plaintext);
  assert.notEqual(a.hash, b.hash);
});

test('short or foreign tokens are not treated as personal keys', () => {
  assert.equal(isPersonalApiKey('matchply_usr_short'), false);
  assert.equal(isPersonalApiKey('ext_sess_abcdefghijklmnop'), false);
  assert.equal(userApiKeyPrefix('not-a-key'), null);
});
