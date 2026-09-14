import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOverall,
  emptyBreakdown,
  isCanonicalMatchBreakdown,
  isProfileMatchScore,
  isResearchBreakdown,
  matchScoreLabel,
  resolveMatchBreakdown,
} from '@/lib/matching';
import {
  SALARY_REJECT_MAX_SCORE,
  WORKPLACE_HYBRID_MAX_SCORE,
  WORKPLACE_REJECT_MAX_SCORE,
  enforceCurationConstraints,
  parseMatchConstraints,
} from '@/lib/curation-constraints';

test('computeOverall uses fixed weights', () => {
  const score = computeOverall({
    tech_stack: 100,
    experience_fit: 0,
    work_mode: 0,
    salary_fit: 0,
    career_alignment: 0,
  });
  assert.equal(score, 30);
});

test('score labels follow the product bands', () => {
  assert.equal(matchScoreLabel(75), 'Match Alto');
  assert.equal(matchScoreLabel(60), 'Match Medio');
  assert.equal(matchScoreLabel(59), 'Match Bajo');
});

test('resolveMatchBreakdown reads the five canonical keys', () => {
  const breakdown = resolveMatchBreakdown({
    tech_stack: 80,
    experience_fit: 70,
    work_mode: 90,
    salary_fit: 60,
    career_alignment: 50,
  });
  assert.equal(breakdown.tech_stack, 80);
  assert.equal(computeOverall(breakdown), 74);
});

test('legacy 1-5 dimensions are scaled only when every value is on that scale', () => {
  const scaled = resolveMatchBreakdown({
    dimensions: [{ name: 'Tech', percentage: 4.5 }],
  });
  assert.equal(scaled.tech_stack, 90);

  const alreadyPercent = resolveMatchBreakdown({
    dimensions: [
      { name: 'tech_stack', percentage: 81 },
      { name: 'experience_fit', percentage: 70 },
    ],
  });
  assert.equal(alreadyPercent.tech_stack, 81);
});

test('research breakdowns are not treated as profile match', () => {
  const research = {
    offerFit: 4.2,
    company: 3.1,
    people: 2,
    historyNews: 4,
    verificationRisk: 3,
  };
  assert.equal(isResearchBreakdown(research), true);
  assert.equal(isCanonicalMatchBreakdown(research), false);
  assert.equal(isProfileMatchScore(4.2, research), false);
  assert.equal(isProfileMatchScore(82, emptyBreakdown(82)), true);
});

test('remote-only profile caps onsite and hybrid offers', () => {
  const constraints = parseMatchConstraints({
    preferredWorkplaces: ['remote'],
  });
  assert.equal(constraints.workplace?.remoteOnly, true);

  const onsite = enforceCurationConstraints({
    score: 88,
    offerLanguage: 'es',
    offerWorkplace: 'onsite',
    constraints,
    targetThreshold: 65,
  });
  assert.equal(onsite.score, WORKPLACE_REJECT_MAX_SCORE);
  assert.equal(onsite.decision, 'archive');
  assert.match(onsite.fitReason, /presencial/i);

  const hybrid = enforceCurationConstraints({
    score: 88,
    offerLanguage: 'es',
    offerWorkplace: 'hybrid',
    constraints,
    targetThreshold: 65,
  });
  assert.equal(hybrid.score, WORKPLACE_HYBRID_MAX_SCORE);
  assert.equal(hybrid.decision, 'archive');
});

test('salary below the declared minimum is a hard cap; silence is not', () => {
  const constraints = parseMatchConstraints({ salaryMin: 55000 });

  const below = enforceCurationConstraints({
    score: 91,
    offerLanguage: 'es',
    offerSalaryMax: 40000,
    constraints,
    targetThreshold: 65,
  });
  assert.equal(below.score, SALARY_REJECT_MAX_SCORE);
  assert.equal(below.decision, 'archive');

  const unknown = enforceCurationConstraints({
    score: 91,
    offerLanguage: 'es',
    offerSalaryMax: null,
    constraints,
    targetThreshold: 65,
  });
  assert.equal(unknown.score, 91);
  assert.equal(unknown.decision, 'keep');
});

test('remote-only is not inferred from mixed workplace preferences', () => {
  const constraints = parseMatchConstraints({
    preferredWorkplaces: ['remote', 'hybrid'],
  });
  assert.equal(constraints.workplace?.remoteOnly, undefined);
});
