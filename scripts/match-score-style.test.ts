import assert from 'node:assert/strict';
import test from 'node:test';
import { matchScoreBand } from '../src/components/applications/matchScoreStyle';

test('match score bands stay inside the semantic scale', () => {
  assert.equal(matchScoreBand(null), 'none');
  assert.equal(matchScoreBand(Number.NaN), 'none');
  assert.equal(matchScoreBand(0), 'low');
  assert.equal(matchScoreBand(39), 'low');
  assert.equal(matchScoreBand(40), 'mid');
  assert.equal(matchScoreBand(69), 'mid');
  assert.equal(matchScoreBand(70), 'high');
  assert.equal(matchScoreBand(100), 'high');
});
