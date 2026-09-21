import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserRolePromotionPayload, UserRolePromotionError } from '../src/lib/user-role-promotion-contract';

test('normalizes an admin promotion request', () => {
  assert.deepEqual(
    normalizeUserRolePromotionPayload({ email: '  ANGELPORLANDEV@GMAIL.COM ', role: 'admin', reason: 'Solicitud del usuario' }),
    { email: 'angelporlandev@gmail.com', role: 'admin', reason: 'Solicitud del usuario' },
  );
});

test('rejects role changes other than admin promotion', () => {
  assert.throws(
    () => normalizeUserRolePromotionPayload({ email: 'user@example.com', role: 'user', reason: 'Solicitud válida' }),
    (error: unknown) => error instanceof UserRolePromotionError && error.status === 400,
  );
});

test('requires a reason for the privileged operation', () => {
  assert.throws(
    () => normalizeUserRolePromotionPayload({ email: 'user@example.com', role: 'admin', reason: 'short' }),
    (error: unknown) => error instanceof UserRolePromotionError && error.status === 400,
  );
});
