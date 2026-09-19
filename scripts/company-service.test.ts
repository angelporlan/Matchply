import test from 'node:test';
import assert from 'node:assert/strict';
import {
  companyNameKey,
  missingCompanyFields,
  normalizeCompanyName,
} from '@/lib/company-service';
import { COMPANY_ICON_MAX_BYTES, assertCompanyIcon, detectIconMime, hashIconBytes } from '@/lib/company-icon';

test('normalizeCompanyName trims, collapses spaces and rejects empty values', () => {
  assert.equal(normalizeCompanyName('  Stripe  '), 'Stripe');
  assert.equal(normalizeCompanyName('Stripe\nInc'), 'Stripe Inc');
  assert.equal(normalizeCompanyName('   '), null);
  assert.equal(normalizeCompanyName(null), null);
  assert.equal(normalizeCompanyName(12), null);
  assert.equal(normalizeCompanyName('a'.repeat(121)), null);
  assert.equal(normalizeCompanyName('a'.repeat(120)), 'a'.repeat(120));
});

test('companyNameKey is case-insensitive for uniqueness', () => {
  assert.equal(companyNameKey('Stripe'), companyNameKey('stripe'));
  assert.equal(companyNameKey('Stripe'), companyNameKey('STRIPE'));
  assert.notEqual(companyNameKey('Stripe'), companyNameKey('Stripe Spain'));
});

test('missingCompanyFields lists empty shared profile data', () => {
  assert.deepEqual(
    missingCompanyFields({ website: null, location: null, sector: null, iconHash: null }),
    ['website', 'location', 'sector', 'icon'],
  );
  assert.deepEqual(
    missingCompanyFields({ website: 'https://stripe.com', location: 'Dublin', sector: 'Fintech', iconHash: 'abc' }),
    [],
  );
  assert.deepEqual(
    missingCompanyFields({ website: 'https://stripe.com', location: '', sector: 'Fintech', iconHash: null }),
    ['location', 'icon'],
  );
});

test('detectIconMime and assertCompanyIcon accept small PNG and reject oversized files', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  assert.equal(detectIconMime(png), 'image/png');
  assert.equal(assertCompanyIcon(png), 'image/png');
  assert.equal(hashIconBytes(png).length, 16);
  assert.throws(() => assertCompanyIcon(Buffer.alloc(COMPANY_ICON_MAX_BYTES + 1)), /COMPANY_ICON_TOO_LARGE/);
  assert.throws(() => assertCompanyIcon(Buffer.from('not-an-image')), /COMPANY_ICON_UNSUPPORTED/);
});
