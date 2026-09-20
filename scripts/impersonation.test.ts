import test from 'node:test';
import assert from 'node:assert/strict';
import {
  impersonationDenial,
  impersonationDenialMessage,
  isSupportSessionActive,
  actorEpochFor,
} from '@/lib/impersonation';

const admin = { id: 'admin-1', role: 'admin' };

test('impersonation rejects nested, admin, guest, suspended and missing reason', () => {
  const target = { id: 'user-1', role: 'user', isGuest: false, accountStatus: 'active' };
  assert.equal(impersonationDenial(admin, target, { enabled: false, alreadyImpersonating: false, reason: 'Soporte de cuenta' }), 'disabled');
  assert.equal(impersonationDenial(admin, target, { enabled: true, alreadyImpersonating: true, reason: 'Soporte de cuenta' }), 'nested');
  assert.equal(impersonationDenial(admin, { ...target, role: 'admin' }, { enabled: true, alreadyImpersonating: false, reason: 'Soporte de cuenta' }), 'admin');
  assert.equal(impersonationDenial(admin, { ...target, isGuest: true }, { enabled: true, alreadyImpersonating: false, reason: 'Soporte de cuenta' }), 'guest');
  assert.equal(impersonationDenial(admin, { ...target, accountStatus: 'suspended' }, { enabled: true, alreadyImpersonating: false, reason: 'Soporte de cuenta' }), 'suspended');
  assert.equal(impersonationDenial(admin, target, { enabled: true, alreadyImpersonating: false, reason: 'corto' }), 'missing_reason');
  assert.equal(impersonationDenial(admin, target, { enabled: true, alreadyImpersonating: false, reason: 'Soporte de cuenta' }), null);
  assert.ok(impersonationDenialMessage('admin').includes('administrador'));
});

test('support sessions expire and actor epochs change with the session', () => {
  const now = new Date('2026-09-20T10:00:00.000Z');
  assert.equal(isSupportSessionActive({
    expiresAt: new Date('2026-09-20T10:30:00.000Z'),
    revokedAt: null,
    endedAt: null,
  }, now), true);
  assert.equal(isSupportSessionActive({
    expiresAt: new Date('2026-09-20T09:59:00.000Z'),
    revokedAt: null,
    endedAt: null,
  }, now), false);
  assert.equal(isSupportSessionActive({
    expiresAt: new Date('2026-09-20T10:30:00.000Z'),
    revokedAt: now,
    endedAt: null,
  }, now), false);
  assert.equal(actorEpochFor(null), 'self');
  assert.equal(actorEpochFor('session-1'), 'session-1');
});
