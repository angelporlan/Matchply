import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_PENALIZE_MAX_SCORE,
  LANGUAGE_REJECT_MAX_SCORE,
  detectOfferLanguage,
  detectOfferLanguageRequirements,
  detectRequiredEnglishLevel,
  describeHardConstraintChips,
  enforceCurationConstraints,
  normalizeScoringPreferences,
  parseHardConstraints,
  parseMatchConstraints,
  type LanguageScoringRule,
} from '@/lib/curation-constraints';

const ENGLISH_JD = 'We are looking for a software engineer to join our team. You will work with React, TypeScript and Node.js. This role is fully remote. Spanish is a plus.';
const SPANISH_JD = 'Buscamos un desarrollador para unirse al equipo. El puesto es remoto. Requisitos: experiencia con React y Node.js.';

function explicitRule(overrides: Partial<LanguageScoringRule> = {}): LanguageScoringRule {
  return { id: 'en-c1', language: 'en', condition: 'minimum_level', minimumLevel: 'c1', action: 'penalize', source: 'explicit', ...overrides };
}

function evaluate(profile: Parameters<typeof parseMatchConstraints>[0], description = ENGLISH_JD, score = 88) {
  return enforceCurationConstraints({ score, offerLanguage: detectOfferLanguage({ description }),
    offerLanguageRequirements: detectOfferLanguageRequirements(description), constraints: parseMatchConstraints(profile), targetThreshold: 65 });
}

test('factual English level alone never activates a score cap', () => {
  for (const englishLevel of ['', 'b1', 'b2', 'c1', 'c2', 'native']) {
    assert.equal(evaluate({ englishLevel }, 'English C2 required.').score, 88);
    assert.equal(parseMatchConstraints({ englishLevel }).language, undefined);
  }
});

test('legacy English policy is inactive and requires review, including old automatic default', () => {
  for (const englishOverLevelPolicy of ['penalize', 'reject']) {
    const profile = { englishLevel: 'b2', englishOverLevelPolicy };
    assert.equal(evaluate(profile, 'English C2 required.').score, 88);
    assert.equal(normalizeScoringPreferences(profile).languageRules.length, 0);
    assert.ok(normalizeScoringPreferences(profile).reviewRequired.length > 0);
  }
});

test('old writing-language criteria stay visible for review and never cap scores', () => {
  for (const curationCriteria of ['Descarta ofertas en inglés.', 'Penaliza ofertas redactadas en inglés.', 'Solo español.', 'No evalúe con puntuaciones muy altas ofertas en inglés.']) {
    const preferences = normalizeScoringPreferences({ curationCriteria });
    assert.deepEqual(preferences.languageRules, []);
    assert.deepEqual(preferences.reviewRequired, [curationCriteria]);
    assert.equal(evaluate({ curationCriteria }).score, 88);
  }
});

test('the same requirements written in English or Spanish produce the same language adjustment', () => {
  const profile = { scoringPreferences: { version: 1, languageRules: [explicitRule()], reviewRequired: [] } };
  assert.equal(evaluate(profile, 'English C1 required.').score, 40);
  assert.equal(evaluate(profile, 'Requisitos: inglés C1.').score, 40);
  assert.equal(evaluate(profile, ENGLISH_JD).score, 88);
  assert.equal(evaluate(profile, SPANISH_JD).score, 88);
});

test('explicit C1+ preference remains active regardless of candidate English ability', () => {
  const curationCriteria = 'Penaliza inglés C1+.';
  const constraints = parseMatchConstraints({ curationCriteria, englishLevel: 'c2' });
  assert.equal(constraints.language?.rules?.[0]?.minimumLevel, 'c1');
  assert.equal(evaluate({ curationCriteria, englishLevel: 'c2' }, 'English C1 required.').score, LANGUAGE_PENALIZE_MAX_SCORE);
  assert.equal(evaluate({ curationCriteria }, 'English B2 required.').score, 88);
});

test('explicit level criteria can put the level before the language name', () => {
  const constraints = parseHardConstraints({ curationCriteria: 'Penaliza si en la oferta piden C1 o C2 en inglés.' });
  assert.equal(constraints.language?.rules?.[0]?.minimumLevel, 'c1');
  assert.equal(constraints.language?.rules?.[0]?.action, 'penalize');
});

test('third-language mandatory rejection does not depend on advert language', () => {
  const profile = { curationCriteria: 'Descarta si el alemán es obligatorio.' };
  assert.equal(evaluate(profile, 'German is mandatory. English B2 required.').score, LANGUAGE_REJECT_MAX_SCORE);
  assert.equal(evaluate(profile, 'German is a plus. English B2 required.').score, 88);
  assert.equal(evaluate(profile, 'No se requiere alemán.').score, 88);
});

test('mixed explicit actions in adjacent clauses remain scoped to their languages', () => {
  const profile = { curationCriteria: 'Penaliza inglés C1 y descarta alemán obligatorio.' };
  assert.equal(evaluate(profile, 'English C1 required.').score, 40);
  assert.equal(evaluate(profile, 'German mandatory.').score, 30);
});

test('English detector does not borrow another language level, optionality, or another sentence', () => {
  for (const text of ['English B2 required. German C2 required.', 'English B2, German C2 required.', 'English B2 and German C2 required.']) {
    assert.equal(detectRequiredEnglishLevel(text), 'b2');
    assert.equal(detectOfferLanguageRequirements(text).find((item) => item.language === 'de')?.minimumLevel, 'c2');
  }
  assert.equal(detectRequiredEnglishLevel('English B2 required. Spanish is a plus.'), 'b2');
  assert.equal(detectRequiredEnglishLevel('English is a plus. German C2 required.'), null);
  assert.equal(detectRequiredEnglishLevel('English is optional. Requirements: C2 German.'), null);
});

test('unknown language requirements stay unknown rather than inventing CEFR levels', () => {
  assert.equal(detectRequiredEnglishLevel('English required.'), null);
  assert.equal(detectRequiredEnglishLevel('Fluent English required.'), null);
  assert.equal(detectOfferLanguageRequirements('English required.')[0]?.required, true);
  assert.equal(detectRequiredEnglishLevel(ENGLISH_JD), null);
});

test('a shared mandatory language list applies to each listed language without borrowing levels', () => {
  const requirements = detectOfferLanguageRequirements('English and German required.');
  assert.deepEqual(requirements.map((item) => [item.language, item.required, item.minimumLevel]), [
    ['en', true, null], ['de', true, null],
  ]);
  assert.equal(evaluate({ curationCriteria: 'Descarta inglés obligatorio.' }, 'English and German required.').score, 30);
});

test('explicit above-B2 policy begins at C1 and never penalizes B2 itself', () => {
  const profile = { curationCriteria: 'Penaliza si piden inglés por encima de B2.' };
  assert.equal(normalizeScoringPreferences(profile).languageRules[0].minimumLevel, 'c1');
  assert.equal(evaluate(profile, 'English B2 required.').score, 88);
  assert.equal(evaluate(profile, 'English C1 required.').score, 40);
});

test('language alternatives, courses and optional skills do not trigger mandatory-language rules', () => {
  const profile = { curationCriteria: 'Descarta alemán obligatorio.' };
  for (const description of ['English or German required.', 'Inglés o alemán obligatorio.', 'Free German C1 classes.', 'German C1 is optional.']) {
    assert.equal(evaluate(profile, description).score, 88);
  }
});

test('negated preference actions do not create rules', () => {
  for (const curationCriteria of ['No penalices inglés C1.', 'No descartar alemán obligatorio.', 'Do not reject English C2.']) {
    assert.deepEqual(normalizeScoringPreferences({ curationCriteria }).languageRules, []);
  }
});

test('bio language notes never become scoring preferences', () => {
  const constraints = parseHardConstraints({ curationCriteria: 'Prioriza producto.', bio: 'Descarta inglés C1.' });
  assert.equal(constraints.language, undefined);
});

test('normalization is idempotent, preserves custom rules, and refreshes only text-derived rules', () => {
  const profile = { curationCriteria: 'Penaliza inglés C1.', englishOverLevelPolicy: 'penalize',
    scoringPreferences: { version: 1, languageRules: [explicitRule({ language: 'fr', id: 'fr-c1' })], reviewRequired: [] } };
  const first = normalizeScoringPreferences(profile);
  assert.equal(first.languageRules.length, 2);
  assert.deepEqual(normalizeScoringPreferences({ ...profile, scoringPreferences: first }), first);
  const cleared = normalizeScoringPreferences({ ...profile, scoringPreferences: first, curationCriteria: '' });
  assert.equal(cleared.languageRules.length, 1);
  assert.equal(cleared.languageRules[0].language, 'fr');
});

test('an explicit rule takes precedence over text for the same condition', () => {
  const preferences = normalizeScoringPreferences({ curationCriteria: 'Descarta inglés C1.',
    scoringPreferences: { version: 1, languageRules: [explicitRule()], reviewRequired: [] } });
  assert.equal(preferences.languageRules.length, 1);
  assert.equal(preferences.languageRules[0].action, 'penalize');
});

test('invalid structured conditions cannot silently become broad or active rules', () => {
  const preferences = normalizeScoringPreferences({ scoringPreferences: { version: 1, languageRules: [
    { language: 'en', condition: 'minimum_level', action: 'penalize', minimumLevel: 'unknown' },
    { language: 'en', condition: 'written_in', action: 'reject' },
    { language: 'en', condition: 'required', action: 'none' },
  ] } });
  assert.deepEqual(preferences.languageRules, []);
});

test('arbitrary model violatedRules claims cannot veto an offer', () => {
  const result = enforceCurationConstraints({ score: 90, offerLanguage: 'en', constraints: {}, targetThreshold: 65,
    violatedRules: ['Inglés', 'El perfil no parece adecuado', 'Candidato no cumple regla inventada'] });
  assert.equal(result.score, 90);
  assert.equal(result.decision, 'keep');
});

test('workplace and salary constraints keep their existing verified behavior', () => {
  const constraints = parseMatchConstraints({ preferredWorkplaces: ['remote'], salaryMin: 50000 });
  const apply = (data: { offerWorkplace?: 'onsite' | 'hybrid' | 'remote'; offerSalaryMax?: number | null }) =>
    enforceCurationConstraints({ score: 90, offerLanguage: 'en', constraints, targetThreshold: 65, ...data });
  assert.equal(apply({ offerWorkplace: 'onsite' }).score, 30);
  assert.equal(apply({ offerWorkplace: 'hybrid' }).score, 50);
  assert.equal(apply({ offerWorkplace: 'remote', offerSalaryMax: 49000 }).score, 30);
  assert.equal(apply({ offerWorkplace: 'remote', offerSalaryMax: null }).score, 90);
});

test('active chips explain the actual condition and exclude inactive legacy criteria', () => {
  assert.deepEqual(describeHardConstraintChips(parseMatchConstraints({ curationCriteria: 'Penaliza ofertas en inglés.' })), []);
  assert.ok(describeHardConstraintChips(parseMatchConstraints({ curationCriteria: 'Penaliza inglés C1.' }))
    .includes('Inglés C1 o superior: máx. 40 pts'));
});

test('offer-language detection remains available as descriptive metadata', () => {
  assert.equal(detectOfferLanguage({ title: 'Senior Software Engineer', description: ENGLISH_JD }), 'en');
  assert.equal(detectOfferLanguage({ title: 'Ingeniero Full Stack', description: SPANISH_JD }), 'es');
});
