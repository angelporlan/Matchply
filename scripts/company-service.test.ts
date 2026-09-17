import test from 'node:test';
import assert from 'node:assert/strict';
import {
  companyNameKey,
  normalizeCompanyName,
} from '@/lib/company-service';

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
