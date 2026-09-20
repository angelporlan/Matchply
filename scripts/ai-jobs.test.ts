import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJsonObject,
} from '@/lib/ai-jobs/evaluation';

test('parseJsonObject accepts raw objects and fenced JSON', () => {
  assert.equal(parseJsonObject('{"score": 80}')?.score, 80);
  assert.equal(parseJsonObject('prefix\n{"score": 12}\nsuffix')?.score, 12);
  assert.equal(parseJsonObject('not json'), null);
});
