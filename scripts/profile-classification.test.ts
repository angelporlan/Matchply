import test from 'node:test';
import assert from 'node:assert/strict';
import {
  genericSoftwareInterviewQuestions,
  heuristicClassifyCareerProfile,
} from '@/lib/profile-classification';

test('classifies a fullstack dump without inventing an AI Engineer target', () => {
  const result = heuristicClassifyCareerProfile(
    'Full Stack con 3 años en TypeScript, React, Next.js, Node.js y PostgreSQL. He montado un SaaS con Stripe.',
  );
  assert.equal(result.family, 'fullstack');
  assert.equal(result.inferredTargetRole, null);
  assert.ok(result.stackHints.some((hint) => /typescript/i.test(hint)));
});

test('classifies a junior frontend dump', () => {
  const result = heuristicClassifyCareerProfile(
    'Junior frontend. Prácticas en una agencia con HTML, CSS y React. Bootcamp de JavaScript.',
  );
  assert.equal(result.family, 'frontend');
  assert.equal(result.seniority, 'junior');
});

test('marks a marketing dump as non_software', () => {
  const result = heuristicClassifyCareerProfile(
    'Community manager con 4 años en campañas de social media, SEO y copywriting. Sin experiencia en desarrollo.',
  );
  assert.equal(result.family, 'non_software');
});

test('generic interview questions stay stack-agnostic', () => {
  const questions = genericSoftwareInterviewQuestions({
    family: 'backend',
    seniority: 'mid',
    inferredTargetRole: null,
    stackHints: ['Python'],
    summary: 'Backend · mid',
  });
  const blob = questions.map((q) => q.question + q.hint + q.suggestedAnswers.join(' ')).join(' ');
  assert.equal(questions.length, 3);
  assert.doesNotMatch(blob, /Matchply|OpenRouter|Pinecone|Gemini|Londres/i);
  assert.match(questions[2].question, /opcional|déjalo|dejalo|si no/i);
});
