import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentApiError } from '@/lib/agent-api/errors';
import { publicErrorCode } from '@/lib/agent-api/http';
import {
  CV_CONTENT_MAX,
  applicationWritePlan,
  decodeApplicationCursor,
  encodeApplicationCursor,
  mergeCareerProfile,
  parseAgentStatus,
  parseCreateApplicationBody,
  parseCvContent,
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
