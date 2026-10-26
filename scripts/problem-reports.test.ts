import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseProblemReport } from '@/lib/problem-report-schema';

test('problem reports allow optional comments and references but reject private automatic fields and oversized input', () => {
  const input = { id: randomUUID(), requestId: 'request-report-one', step: 'optimization', route: '/editor/private-candidate?token=private', comment: '  El botón no responde.  ' };
  assert.deepEqual(parseProblemReport(input), { ...input, route: '/editor/:cvId', comment: 'El botón no responde.' });
  assert.deepEqual(parseProblemReport({ ...input, requestId: null, comment: undefined }), { ...input, route: '/editor/:cvId', requestId: null, comment: '' });
  for (const change of [{ id: 'invalid' }, { requestId: 'SQL private\n' }, { step: 'private-step' }, { comment: 'a'.repeat(2001) }, { comment: {} }, { route: 'a'.repeat(2049) }, { rawCv: 'private' }, { stack: 'private' }, { userId: randomUUID() }]) assert.equal(parseProblemReport({ ...input, ...change }), null);
  // The explicit comment is text, including punctuation/HTML. Rendering must escape it.
  const comment = '<script>alert("untrusted")</script> $1 \'SQL\'';
  assert.equal(parseProblemReport({ ...input, comment })?.comment, comment);
});
