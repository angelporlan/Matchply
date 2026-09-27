import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentApiError } from '@/lib/agent-api/errors';
import { MATCH_PROMPT_VERSION } from '@/lib/matching/types';
import { publicErrorCode } from '@/lib/agent-api/http';
import {
  CV_CONTENT_MAX,
  applicationWritePlan,
  decodeApplicationCursor,
  encodeApplicationCursor,
  mergeCareerProfile,
  parseAgentStatus,
  buildAgentMatchScore,
  currentMatchScoreValue,
  parseBatchEvaluationsBody,
  parseCreateApplicationBody,
  parseCvContent,
  parsePatchApplicationBody,
  parseScoreOverall,
  parseTldr,
  sanitizeCareerProfilePatch,
} from '@/lib/agent-api/validate';

test('application writes return the existing row instead of overwriting it', () => {
  assert.equal(applicationWritePlan({
    externalId: 'cursor-1',
    url: 'https://jobs.example/1',
    existingByExternalId: true,
    existingByUrl: false,
  }), 'return_existing');
  assert.equal(applicationWritePlan({
    externalId: null,
    url: 'https://jobs.example/1',
    existingByExternalId: false,
    existingByUrl: true,
  }), 'return_existing');
  assert.equal(applicationWritePlan({
    externalId: 'cursor-2',
    url: 'https://jobs.example/1',
    existingByExternalId: false,
    existingByUrl: true,
  }), 'insert');
  assert.equal(applicationWritePlan({
    externalId: null,
    url: null,
    existingByExternalId: false,
    existingByUrl: false,
  }), 'insert');
});

test('application status is strict and still accepts archived', () => {
  assert.equal(parseAgentStatus('archived'), 'archived');
  assert.equal(parseAgentStatus('interview'), 'interview');
  assert.throws(() => parseAgentStatus('archived:ghost'), (error: unknown) => error instanceof AgentApiError);
  assert.throws(() => parseCreateApplicationBody({
    title: 'Backend',
    company: 'Acme',
    status: 'nope',
  }), (error: unknown) => error instanceof AgentApiError && error.status === 400);
  const created = parseCreateApplicationBody({
    title: 'Backend',
    company: 'Acme',
    status: 'archived',
    externalId: 'cursor-42',
  });
  assert.equal(created.status, 'archived');
  assert.equal(created.platform, 'other');
  assert.equal(created.externalId, 'cursor-42');
  assert.throws(() => parseCreateApplicationBody({
    title: 'Backend',
    company: 'Acme',
    note: 'a'.repeat(4001),
  }), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_note');
});

test('an agent score is stored so the board expression can show it', () => {
  const offerId = '88d9fa60-677e-48d0-93be-5c2fdd88a468';
  const userId = '6d9f1c2a-4b7e-4d11-8a55-0c1e2f3a4b5c';
  const patch = parsePatchApplicationBody({
    scoreOverall: 95,
    tldr: 'Excelente match en React y TypeScript.',
  });
  assert.equal(patch.scoreOverall, 95);
  assert.equal(patch.tldr, 'Excelente match en React y TypeScript.');

  const scored = buildAgentMatchScore(userId, offerId, patch.scoreOverall!);
  assert.equal(scored.matchKind, 'triage');
  assert.equal(scored.matchEvidence.version, MATCH_PROMPT_VERSION);
  assert.equal(scored.matchEvidence.inputHash, scored.matchInputHash);
  assert.equal(scored.matchEvidence.score, 95);
  assert.deepEqual(scored.matchEvidence.requirements, []);
  assert.deepEqual(scored.matchEvidence.adjustments, []);
  assert.equal(currentMatchScoreValue({
    scoreOverall: scored.scoreOverall,
    matchInputHash: scored.matchInputHash,
    matchEvidence: scored.matchEvidence,
  }), 95);
  assert.equal(currentMatchScoreValue({
    scoreOverall: scored.scoreOverall,
    matchInputHash: scored.matchInputHash,
    matchEvidence: { ...scored.matchEvidence, version: 'stale' },
  }), null);

  const cleared = parsePatchApplicationBody({ scoreOverall: null, tldr: '  \n  ' });
  assert.equal(cleared.scoreOverall, null);
  assert.equal(cleared.tldr, null);
  assert.equal(currentMatchScoreValue({
    scoreOverall: null,
    matchInputHash: null,
    matchEvidence: null,
  }), null);
});

test('scores outside 0-100 and oversized summaries are rejected', () => {
  for (const value of [-1, 101, 90.5, '95', true]) {
    assert.throws(() => parseScoreOverall(value), (error: unknown) => {
      return error instanceof AgentApiError && error.code === 'invalid_score' && error.status === 400;
    });
  }
  assert.equal(publicErrorCode('invalid_score'), 'invalid_score');
  assert.equal(publicErrorCode('invalid_tldr'), 'invalid_tldr');
  assert.equal(parseScoreOverall(0), 0);
  assert.equal(parseScoreOverall(100), 100);
  assert.throws(() => parseTldr('a'.repeat(1001)), (error: unknown) => {
    return error instanceof AgentApiError && error.code === 'invalid_tldr';
  });
  assert.equal(parseTldr('Hola\u0000mundo'), 'Hola mundo');
});

test('a batch evaluation produces a visible score for every owned offer', () => {
  const userId = '6d9f1c2a-4b7e-4d11-8a55-0c1e2f3a4b5c';
  const firstId = '88d9fa60-677e-48d0-93be-5c2fdd88a468';
  const secondId = '11d9fa60-677e-48d0-93be-5c2fdd88a469';
  const evaluations = parseBatchEvaluationsBody({
    evaluations: [
      { id: firstId, scoreOverall: 95, tldr: 'Excelente match en React y TypeScript.' },
      { id: secondId, scoreOverall: 40 },
    ],
  });
  assert.equal(evaluations.length, 2);
  assert.equal(evaluations[1].tldr, undefined);
  const visible = evaluations.map((item) => {
    const scored = buildAgentMatchScore(userId, item.id, item.scoreOverall);
    return currentMatchScoreValue(scored);
  });
  assert.deepEqual(visible, [95, 40]);
  assert.throws(() => parseBatchEvaluationsBody({
    evaluations: [{ id: firstId, scoreOverall: -1 }],
  }), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_score');
  assert.throws(() => parseBatchEvaluationsBody({
    evaluations: [{ id: firstId, scoreOverall: 150 }],
  }), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_score');
  assert.throws(() => parseBatchEvaluationsBody({ evaluations: [] }), (error: unknown) => error instanceof AgentApiError);
  assert.throws(() => parseBatchEvaluationsBody({
    evaluations: Array.from({ length: 201 }, (_, index) => ({
      id: `88d9fa60-677e-48d0-93be-${String(index).padStart(12, '0')}`,
      scoreOverall: 10,
    })),
  }), (error: unknown) => error instanceof AgentApiError);
});

test('career profile patches cannot smuggle account fields or hard constraints', () => {
  const patch = sanitizeCareerProfilePatch({
    bio: 'Hola',
    email: 'ada@example.com',
    role: 'admin',
    hardConstraints: { salaryMin: 99999 },
    skills: [],
  });
  assert.deepEqual(patch, { bio: 'Hola', skills: [] });

  const merged = mergeCareerProfile(
    { bio: 'antes', preferredWorkplaces: ['remote'] },
    { bio: 'después', email: 'ada@example.com', hardConstraints: { salaryMin: 99999 } },
  ) as unknown as { bio: string; email?: string; hardConstraints: { salaryMin?: number; workplace?: { remoteOnly?: boolean } } };

  assert.equal(merged.bio, 'después');
  assert.equal(merged.email, undefined);
  assert.equal(merged.hardConstraints.salaryMin, undefined);
  assert.deepEqual(merged.hardConstraints.workplace, { remoteOnly: true });
});

test('cv content and public error codes stay bounded', () => {
  assert.equal(parseCvContent('hola'), 'hola');
  assert.throws(() => parseCvContent('a'.repeat(CV_CONTENT_MAX + 1)), (error: unknown) => {
    return error instanceof AgentApiError && error.code === 'invalid_content';
  });
  assert.equal(publicErrorCode('invalid_status'), 'validation');
  assert.equal(publicErrorCode('invalid_token'), 'invalid_token');

  const cursor = encodeApplicationCursor(new Date('2026-09-27T12:00:00.000Z'), '88d9fa60-677e-48d0-93be-5c2fdd88a468');
  const decoded = decodeApplicationCursor(cursor);
  assert.equal(decoded?.id, '88d9fa60-677e-48d0-93be-5c2fdd88a468');
  assert.equal(decoded?.updatedAt.toISOString(), '2026-09-27T12:00:00.000Z');
  assert.equal(decodeApplicationCursor('not-a-cursor'), null);
});
