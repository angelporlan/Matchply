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
    curated: [{
      tech_stack: 80,
      experience_fit: 70,
      work_mode: 90,
      salary_fit: 60,
      career_alignment: 50,
      fitReason: 'Encaje técnico alto',
      presentKeywords: ['TypeScript'],
      missingKeywords: ['Kubernetes'],
      redFlags: [{ title: 'Turnos', description: 'Noches' }],
      verdict: 'Entrevistar',
    }],
    legitimacyTier: 'verified',
  });
  assert.equal(fields.scoreOverall, 74);
  assert.equal(fields.tldr, 'Encaje técnico alto');
  assert.equal((fields.scoreBreakdown as Record<string, number>).tech_stack, 80);
  assert.match(fields.rawReport || '', /TypeScript/);
  assert.match(fields.rawReport || '', /Kubernetes/);
});
