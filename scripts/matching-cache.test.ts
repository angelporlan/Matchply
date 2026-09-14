import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCandidateCard,
  buildOfferCard,
  canReuseCachedMatch,
  emptyBreakdown,
  isCanonicalMatchBreakdown,
  matchInputHash,
  normalizeMatchItem,
} from '@/lib/matching';
import { parseMatchConstraints } from '@/lib/curation-constraints';

test('match hash changes when the profile, JD, model or depth changes', () => {
  const constraints = parseMatchConstraints({ preferredWorkplaces: ['remote'] });
  const candidate = buildCandidateCard({
    skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }],
    preferredWorkplaces: ['remote'],
  }, '', constraints);
  const offer = buildOfferCard({
    id: 'a',
    title: 'Frontend',
    company: 'Zed',
    description: '## Requisitos\nReact remoto 50.000€',
  }, 'triage');

  const base = matchInputHash({
    candidateCard: candidate,
    offerCard: offer,
    model: 'gemini-x',
    kind: 'triage',
  });
  const deeper = matchInputHash({
    candidateCard: candidate,
    offerCard: offer,
    model: 'gemini-x',
    kind: 'deep',
  });
  const otherModel = matchInputHash({
    candidateCard: candidate,
    offerCard: offer,
    model: 'other',
    kind: 'triage',
  });

  assert.equal(base.length, 64);
  assert.notEqual(base, deeper);
  assert.notEqual(base, otherModel);
});

test('cache reuse requires matching hash, canonical breakdown and a JD', () => {
  const hash = 'abc';
  const breakdown = emptyBreakdown(70);
  assert.equal(canReuseCachedMatch({
    hash,
    cachedHash: hash,
    scoreOverall: 70,
    scoreBreakdown: breakdown,
    hasDescription: true,
    canonicalBreakdown: isCanonicalMatchBreakdown(breakdown),
  }), true);
  assert.equal(canReuseCachedMatch({
    hash,
    cachedHash: hash,
    scoreOverall: 70,
    scoreBreakdown: breakdown,
    hasDescription: false,
    canonicalBreakdown: true,
  }), false);
  assert.equal(canReuseCachedMatch({
    hash,
    cachedHash: 'other',
    scoreOverall: 70,
    scoreBreakdown: breakdown,
    hasDescription: true,
    canonicalBreakdown: true,
  }), false);
});

test('normalizeMatchItem computes overall in the host and grounds highlight skills', () => {
  const constraints = parseMatchConstraints({});
  const offer = {
    id: 'off-1',
    title: 'Node Engineer',
    company: 'Acme',
    description: '## Requisitos\nNode.js y TypeScript. Remoto.',
  };
  const offerCard = buildOfferCard(offer, 'triage');
  const candidateCard = 'Stack con evidencia:\n- TypeScript (core)\n- Node.js (core)';

  const item = normalizeMatchItem({
    offer,
    offerCard,
    candidateCard,
    llm: {
      id: 'off-1',
      tech_stack: 90,
      experience_fit: 80,
      work_mode: 70,
      salary_fit: 50,
      career_alignment: 60,
      fitReason: 'Encaja el stack TypeScript.',
      highlightSkills: ['TypeScript', 'COBOL', 'Kubernetes'],
    },
    constraints,
    targetThreshold: 65,
    kind: 'triage',
    model: 'test-model',
  });

  assert.equal(item.score, computeExpected(90, 80, 70, 50, 60));
  assert.deepEqual(item.highlightSkills, ['TypeScript']);
  assert.equal(item.kind, 'triage');
  assert.equal(item.inputHash.length, 64);
});

function computeExpected(
  tech: number,
  exp: number,
  work: number,
  salary: number,
  career: number,
) {
  return Math.round(tech * 0.3 + exp * 0.25 + work * 0.2 + salary * 0.15 + career * 0.1);
}
