import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';

test('encryptSecret round-trips the full API token and does not store it in clear', () => {
  process.env.NEXTAUTH_SECRET = 'test-secret-for-api-keys';
  const token = `mp_live_${'ab'.repeat(32)}`;
  const sealed = encryptSecret(token);
  assert.equal(sealed.includes(token), false);
  assert.equal(decryptSecret(sealed), token);
  assert.throws(() => decryptSecret(`${sealed.slice(0, -2)}xx`));
});
