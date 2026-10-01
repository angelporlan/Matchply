import test from 'node:test';
import assert from 'node:assert/strict';
import {
  companyCountMatches,
  parseCompanyCount,
} from '@/lib/company-column-filter';

test('company counts parse as whole numbers', () => {
  assert.equal(parseCompanyCount('2'), 2);
  assert.equal(parseCompanyCount(' 01 '), 1);
  assert.equal(parseCompanyCount('0'), 0);
  assert.equal(parseCompanyCount(''), null);
  assert.equal(parseCompanyCount('1.5'), null);
  assert.equal(parseCompanyCount('-1'), null);
  assert.equal(parseCompanyCount('1a'), null);
  assert.equal(parseCompanyCount('1e2'), null);
});

test('company count filters compare numbers, not text', () => {
  assert.equal(companyCountMatches(1, 'eq', '1'), true);
  assert.equal(companyCountMatches(10, 'eq', '1'), false);
  assert.equal(companyCountMatches(12, 'eq', '1'), false);
  assert.equal(companyCountMatches(1, 'equals', '01'), true);
  assert.equal(companyCountMatches(3, 'gt', '2'), true);
  assert.equal(companyCountMatches(2, 'gt', '2'), false);
  assert.equal(companyCountMatches(2, 'gte', '2'), true);
  assert.equal(companyCountMatches(1, 'lt', '2'), true);
  assert.equal(companyCountMatches(2, 'lt', '2'), false);
  assert.equal(companyCountMatches(2, 'lte', '2'), true);
  assert.equal(companyCountMatches(4, 'contains', '4'), false);
  assert.equal(companyCountMatches(2, 'eq', '1.5'), false);
});
