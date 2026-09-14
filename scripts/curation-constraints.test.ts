import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_PENALIZE_MAX_SCORE,
  LANGUAGE_REJECT_MAX_SCORE,
  detectOfferLanguage,
  detectRequiredEnglishLevel,
  describeHardConstraintChips,
  enforceCurationConstraints,
  parseHardConstraints,
  parseMatchConstraints,
} from '@/lib/curation-constraints';

const ENGLISH_JD = `
We are looking for a software engineer to join our team. You will work with React, TypeScript and Node.js.
This role is fully remote. You will collaborate with product and design. Requirements include 3+ years of experience.
Spanish is a plus.
`.trim();

const SPANISH_JD = `
Buscamos un desarrollador para unirse al equipo. Trabajarás con React, TypeScript y Node.js.
El puesto es 100% remoto. Colaborarás con producto y diseño. Requisitos: 3 años de experiencia.
`.trim();

test('parses penalize-high-score English criteria from natural Spanish', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'No evalúe con puntuaciones muy altas ofertas en inglés.',
  });

  assert.deepEqual(constraints.language?.rejectOfferLanguage, undefined);
  assert.equal(constraints.language?.penalizeOfferLanguage?.[0]?.lang, 'en');
  assert.equal(constraints.language?.penalizeOfferLanguage?.[0]?.maxScore, LANGUAGE_PENALIZE_MAX_SCORE);
});

test('parses explicit English reject, penalize, and Spanish-only rules', () => {
  const reject = parseHardConstraints({
    curationCriteria: 'Descarta ofertas en inglés.',
  });
  assert.deepEqual(reject.language?.rejectOfferLanguage, ['en']);

  const penalize = parseHardConstraints({
    curationCriteria: 'Penaliza ofertas en inglés y prioriza TypeScript.',
  });
  assert.equal(penalize.language?.penalizeOfferLanguage?.[0]?.lang, 'en');

  const onlySpanish = parseHardConstraints({
    curationCriteria: 'Solo español. Prioriza React y Node.',
  });
  assert.deepEqual(onlySpanish.language?.rejectOfferLanguage, ['en']);

  const englishPhrase = parseHardConstraints({
    curationCriteria: "Don't give high scores to English job posts.",
  });
  assert.equal(englishPhrase.language?.penalizeOfferLanguage?.[0]?.lang, 'en');
});

test('does not treat bio language notes as curation hard rules', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'Prioriza TypeScript y React.',
    bio: 'No tengo certificación de inglés nativo. Nivel B2.',
  });
  assert.equal(constraints.language, undefined);
});

test('detects English postings even when Spanish is a plus', () => {
  const language = detectOfferLanguage({
    title: 'Senior Software Engineer',
    description: ENGLISH_JD,
  });
  assert.equal(language, 'en');
});

test('detects English titles without a job description', () => {
  assert.equal(
    detectOfferLanguage({ title: 'Senior Software Engineer', description: '' }),
    'en',
  );
});

test('detects Spanish postings with the same stack', () => {
  const language = detectOfferLanguage({
    title: 'Ingeniero Full Stack',
    description: SPANISH_JD,
  });
  assert.equal(language, 'es');
});

test('caps an LLM high score when the user penalizes English offers', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'No evalúe con puntuaciones muy altas ofertas en inglés.',
  });
  const offerLanguage = detectOfferLanguage({
    title: 'Senior Software Engineer',
    description: ENGLISH_JD,
  });

  const result = enforceCurationConstraints({
    score: 90,
    decision: 'keep',
    fitReason: 'Excelente match de stack TypeScript/React.',
    violatedRules: [],
    offerLanguage,
    constraints,
    targetThreshold: 65,
  });

  assert.ok(result.score <= LANGUAGE_PENALIZE_MAX_SCORE);
  assert.equal(result.decision, 'archive');
  assert.match(result.fitReason, /inglés/i);
});

test('rejects English offers when the user asks to discard them', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'Descarta ofertas en inglés.',
  });

  const result = enforceCurationConstraints({
    score: 88,
    decision: 'keep',
    fitReason: 'Gran afinidad técnica.',
    violatedRules: [],
    offerLanguage: 'en',
    constraints,
    targetThreshold: 65,
  });

  assert.equal(result.score, LANGUAGE_REJECT_MAX_SCORE);
  assert.equal(result.decision, 'archive');
  assert.match(result.fitReason, /inglés/i);
});

test('does not cap a Spanish offer with the same stack', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'No evalúe con puntuaciones muy altas ofertas en inglés.',
  });
  const offerLanguage = detectOfferLanguage({
    title: 'Ingeniero Full Stack',
    description: SPANISH_JD,
  });

  const result = enforceCurationConstraints({
    score: 88,
    decision: 'keep',
    fitReason: 'Gran afinidad con React y TypeScript.',
    violatedRules: [],
    offerLanguage,
    constraints,
    targetThreshold: 65,
  });

  assert.equal(offerLanguage, 'es');
  assert.equal(result.score, 88);
  assert.equal(result.decision, 'keep');
});

test('fallback scores are also capped by language rules', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'Penaliza ofertas en inglés.',
  });

  const result = enforceCurationConstraints({
    score: 60,
    offerLanguage: 'en',
    constraints,
    targetThreshold: 65,
    fitReason: 'Evaluación de respaldo.',
  });

  assert.ok(result.score <= LANGUAGE_PENALIZE_MAX_SCORE);
  assert.equal(result.decision, 'archive');
});

test('exposes chips for the extracted English cap', () => {
  const chips = describeHardConstraintChips(
    parseHardConstraints({
      curationCriteria: 'No evalúe con puntuaciones muy altas ofertas en inglés.',
    }),
  );
  assert.ok(chips.some((chip) => /inglés/i.test(chip)));
});

test('C1/C2 requirement text is not treated as “ads written in English”', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'Penaliza si en la oferta piden c1 o c2 en ingles',
  });
  assert.equal(constraints.language?.penalizeOfferLanguage, undefined);
  assert.equal(constraints.language?.englishMaxOk, 'b2');
  assert.equal(constraints.language?.englishRequirementPolicy, 'penalize');
});

test('detects required English level from the JD, not the ad language', () => {
  assert.equal(
    detectRequiredEnglishLevel('Buscamos desarrollador React. Requisitos: inglés C1. El puesto es remoto.'),
    'c1',
  );
  assert.equal(
    detectRequiredEnglishLevel(ENGLISH_JD),
    null,
  );
  assert.equal(
    detectRequiredEnglishLevel('Fluent English required. Spanish is a plus.'),
    'c1',
  );
});

test('a Spanish JD that requires C1 is capped; an English JD without a bar is not', () => {
  const constraints = parseHardConstraints({
    curationCriteria: 'Penaliza si en la oferta piden c1 o c2 en ingles',
  });

  const spanishC1 = enforceCurationConstraints({
    score: 88,
    offerLanguage: 'es',
    offerRequiredEnglish: 'c1',
    constraints,
    targetThreshold: 65,
  });
  assert.equal(spanishC1.score, LANGUAGE_PENALIZE_MAX_SCORE);
  assert.equal(spanishC1.decision, 'archive');
  assert.match(spanishC1.fitReason, /C1/);

  const englishNoBar = enforceCurationConstraints({
    score: 88,
    offerLanguage: 'en',
    offerRequiredEnglish: null,
    constraints,
    targetThreshold: 65,
  });
  assert.equal(englishNoBar.score, 88);
  assert.equal(englishNoBar.decision, 'keep');
});

test('structured englishLevel wins over free-text C1/C2 rule', () => {
  const constraints = parseMatchConstraints({
    curationCriteria: 'Penaliza si piden c1 o c2 en ingles',
    englishLevel: 'c1',
    englishOverLevelPolicy: 'penalize',
  });
  assert.equal(constraints.language?.englishMaxOk, 'c1');

  const c1ok = enforceCurationConstraints({
    score: 80,
    offerLanguage: 'es',
    offerRequiredEnglish: 'c1',
    constraints,
    targetThreshold: 65,
  });
  assert.equal(c1ok.score, 80);

  const c2cap = enforceCurationConstraints({
    score: 80,
    offerLanguage: 'es',
    offerRequiredEnglish: 'c2',
    constraints,
    targetThreshold: 65,
  });
  assert.equal(c2cap.score, LANGUAGE_PENALIZE_MAX_SCORE);
});
