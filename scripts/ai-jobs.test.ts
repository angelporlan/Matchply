import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluationFields,
  parseJsonObject,
} from '@/lib/ai-jobs/evaluation';

test('parseJsonObject accepts raw objects and fenced JSON', () => {
  assert.equal(parseJsonObject('{"score": 80}')?.score, 80);
  assert.equal(parseJsonObject('prefix\n{"score": 12}\nsuffix')?.score, 12);
  assert.equal(parseJsonObject('not json'), null);
});

test('evaluationFields maps STAR dimensions into stored report fields', () => {
  const fields = evaluationFields({
    score: 77.77,
    scoreLabel: 'Bueno',
    scoreReason: 'Encaje técnico alto',
    dimensions: [{ name: 'Tech', percentage: 81.2 }],
    redFlags: [{ title: 'Turnos', description: 'Noches' }],
    presentKeywords: ['TypeScript'],
    missingKeywords: ['Kubernetes'],
    legitimacyTier: 'verified',
    verdict: 'Entrevistar',
  });
  assert.equal(fields.scoreOverall, 77.8);
  assert.equal(fields.tldr, 'Encaje técnico alto');
  assert.equal((fields.scoreBreakdown as Record<string, number>).Tech, 81.2);
  assert.match(fields.rawReport || '', /TypeScript/);
  assert.match(fields.rawReport || '', /Kubernetes/);
});
