import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionFields } from '@/lib/application-transition';
import { parseOutreachResult } from '@/lib/outreach-validation';
import { articlesFor, translatedArticle, articlePath } from '@/content/blog';
import { heuristicClassifyCareerProfile, genericSoftwareInterviewQuestions } from '@/lib/profile-classification';
import { normalizeCareerProfileFields } from '@/lib/career-profile';

const empty = { status: 'interested', nextFollowupDate: null, nextAction: null, followupVersion: 0 };
test('submission defaults once; null, explicit dates and terminal stages preserve intent', () => {
  const first = transitionFields(empty, { status: 'applied' }, new Date('2026-10-22T10:00:00Z'));
  assert.equal(first.nextFollowupDate?.toISOString(), '2026-10-27T08:00:00.000Z');
  assert.equal(transitionFields(first, { status: 'applied' }).followupVersion, 1);
  assert.equal(transitionFields(empty, { status: 'applied', nextFollowupDate: null }).nextFollowupDate, null);
  const manual = new Date('2026-11-12T10:00:00Z');
  assert.equal(transitionFields({ ...empty, nextFollowupDate: manual }, { status: 'applied' }).nextFollowupDate, manual);
  for (const status of ['rejected', 'archived', 'archived:interview']) assert.equal(transitionFields(first, { status }).nextFollowupDate, null);
  assert.throws(() => transitionFields(empty, { status: 'invalid' }), /INVALID_STATUS/);
});
test('outreach rejects malformed, incomplete and placeholder results; accepts complete factual drafts', () => {
  for (const value of ['not json', '{}', '{"outreachMessage":"Hola..."}']) assert.throws(() => parseOutreachResult(value), /OUTREACH_INVALID_RESPONSE/);
  const valid = { outreachMessage: 'I am writing about the advertised role and my relevant experience.', coverLetter: 'Dear hiring team, I would like to discuss how the experience described in my CV relates to this role.', interviewQuestions: Array.from({ length: 3 }, (_, i) => ({ question: `Can you explain your contribution to project ${i}?`, tip: 'Use a real example from the experience supplied in your CV.' })) };
  assert.deepEqual(parseOutreachResult(JSON.stringify(valid)), valid);
  assert.throws(() => parseOutreachResult(JSON.stringify({ ...valid, coverLetter: '[INSERT]...' })), /OUTREACH_INVALID_RESPONSE/);
});
test('blog has four complete translation pairs with deterministic routes and original sources', () => {
  for (const language of ['es', 'en'] as const) {
    const articles = articlesFor(language); assert.equal(articles.length, 4);
    for (const article of articles) {
      assert.equal(translatedArticle(article).id, article.id);
      assert.notEqual(translatedArticle(article).language, language);
      assert.equal(articlePath(article), `/blog/${language}/${article.slug}`);
      assert.ok(article.sections.length >= 5);
      assert.ok(new URL(article.source.url).protocol === 'https:');
      assert.ok(article.sections.every(section => section.paragraphs.length > 0));
    }
  }
});
test('generalist and beginner profiles are not defaulted to software and retain declared evidence', () => {
  const cases = [
    ['Auxiliar administrativo', 'Office administration assistant'],
    ['Asistente comercial de tienda', 'Sales assistant in a shop'],
    ['Enfermera de hospital', 'Nurse in a hospital'],
    ['Docente en prácticas', 'Teaching placement'],
    ['Electricista', 'Electrician'],
    ['Primer empleo sin experiencia', 'First job, completed school'],
    ['Docente que utiliza Python para preparar material', 'Teacher using Python to prepare learning materials'],
  ];
  for (const text of cases.flat()) {
    const classification = heuristicClassifyCareerProfile(text);
    assert.notEqual(classification.family, 'software_other', text);
    const questions = genericSoftwareInterviewQuestions(classification).map(question => question.question).join(' ');
    assert.doesNotMatch(questions, /framework|cloud|stack|construyes software/i);
  }
  for (const text of ['Desarrollador frontend con React', 'Frontend developer using React']) assert.equal(heuristicClassifyCareerProfile(text).family, 'frontend');
  for (const text of ['Python y Excel, sin experiencia', 'Python and Excel, no work experience']) assert.equal(heuristicClassifyCareerProfile(text).family, 'unknown');
  assert.match(genericSoftwareInterviewQuestions(heuristicClassifyCareerProfile('First job'), 'en')[0].question, /skills|methods|context/i);
  const legacy = { skills: [{ name: 'Atención al paciente', category: 'other', proficiency: 'solid', evidence: 'Prácticas supervisadas' }], techStack: { frontend: ['React'] }, preferredLocations: 'Murcia', masterDocument: 'Formación y prácticas supervisadas.' };
  const normalized = normalizeCareerProfileFields(legacy);
  assert.ok(normalized.skills.some((skill: {name: string}) => skill.name === 'Atención al paciente'));
  assert.ok(normalized.skills.some((skill: {name: string}) => skill.name === 'React'));
  assert.equal(normalized.preferredLocations, 'Murcia');
});

test('generalist prompts preserve facts and optional tools in runtime and debug', async () => {
  const { PROFILE_EXTRACT_PROMPT, PROFILE_INTERVIEW_PROMPT, PROFILE_SYNTHESIS_PROMPT, profilePolishPrompt } = await import('@/lib/profile-prompts');
  for (const prompt of [PROFILE_EXTRACT_PROMPT, PROFILE_INTERVIEW_PROMPT, PROFILE_SYNTHESIS_PROMPT, profilePolishPrompt('project')]) {
    assert.match(prompt, /cualquier profesión|cualquier sector/);
    assert.doesNotMatch(prompt, /Enfatiza arquitectura técnica|redactor de perfiles técnicos/);
  }
});

test('outreach repairs once using the selected provider, then fails safely', async () => {
  const { AIService } = await import('@/lib/ai-service');
  const service = AIService as unknown as { routeModel: (...args: unknown[]) => Promise<{ provider: string; model: string }>; callOpenAIOficial: (...args: unknown[]) => Promise<string> };
  const originalRoute = service.routeModel; const originalCall = service.callOpenAIOficial;
  let calls = 0;
  service.routeModel = async () => ({ provider: 'openai', model: 'synthetic-test' });
  service.callOpenAIOficial = async () => { calls++; return '{invalid'; };
  try {
    await assert.rejects(AIService.generateOutreachAndPrep({ cvContent: 'Synthetic experience', jobDescription: 'Synthetic role', jobTitle: 'Role', company: 'Test employer', userSubscriptionStatus: 'none' }), /OUTREACH_INVALID_RESPONSE/);
    assert.equal(calls, 2);
  } finally { service.routeModel = originalRoute; service.callOpenAIOficial = originalCall; }
});
