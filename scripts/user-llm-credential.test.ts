import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';
import {
  credentialKeyForProvider,
  llmCredentialWriteBlocked,
  toPublicLlmCredential,
  validateAgentModels,
  validateLlmApiKey,
  LlmCredentialError,
} from '@/lib/user-llm-credential';
import { agentResearchAdmission, profileGoalOffer } from '@/lib/agent-cv';
import { CatalogError, fetchProviderModels } from '@/lib/ai-model-catalog';
import { userErrorMessage } from '@/lib/user-errors';
import { readFileSync } from 'node:fs';
import { diagnosticRoute } from '@/lib/diagnostics-schema';
import es from '@/lib/i18n/es';
import en from '@/lib/i18n/en';
import { providerCredential } from '@/lib/ai-provider-credentials';

process.env.NEXTAUTH_SECRET = 'test-secret-for-llm-credentials';

const openaiKey = `sk-${'live'.repeat(8)}abcd`;
const openrouterKey = `sk-or-${'live'.repeat(6)}wxyz`;

test('credential round-trip encrypts the key and the public view omits the cipher', () => {
  const sealed = encryptSecret(openaiKey);
  assert.equal(sealed.includes(openaiKey), false);
  assert.equal(decryptSecret(sealed), openaiKey);
  const publicView = toPublicLlmCredential({
    provider: 'openai',
    lastChars: openaiKey.slice(-4),
    updatedAt: new Date('2026-11-02T10:00:00.000Z'),
  });
  assert.deepEqual(publicView, {
    connected: true,
    provider: 'openai',
    lastChars: 'abcd',
    updatedAt: '2026-11-02T10:00:00.000Z',
    scoutModel: null,
    researchModel: null,
    cvModel: null,
  });
  assert.equal(JSON.stringify(publicView).includes('keyCipher'), false);
  assert.equal(JSON.stringify(publicView).includes(openaiKey), false);
  assert.equal(credentialKeyForProvider({ provider: 'openai', keyCipher: sealed }, 'openai'), openaiKey);
});

test('guest and impersonation cannot write the credential table', () => {
  assert.equal(llmCredentialWriteBlocked({ authenticated: false, impersonation: false, isGuest: false }), 'unauthorized');
  assert.equal(llmCredentialWriteBlocked({ authenticated: true, impersonation: true, isGuest: false }), 'forbidden');
  assert.equal(llmCredentialWriteBlocked({ authenticated: true, impersonation: false, isGuest: true }), 'forbidden');
  assert.equal(llmCredentialWriteBlocked({ authenticated: true, impersonation: false, isGuest: false }), null);
});

test('invalid keys are rejected before insert', () => {
  for (const [provider, apiKey, code] of [
    ['claude', openaiKey, 'invalid_provider'],
    ['openai', 'short', 'too_short'],
    ['openai', `sk-${'x'.repeat(260)}`, 'too_long'],
    ['openai', 'sk-this has spaces-and-is-long-enough', 'invalid_key'],
    ['openai', 'sk-mock-key-that-is-long-enough', 'mock_key'],
    ['openai', 'sk-your_api_key-that-is-long-enough', 'mock_key'],
    ['openai', 'not-a-secret-but-long-enough-xx', 'prefix'],
    ['openrouter', openaiKey, 'prefix'],
    ['deepseek', 'not-sk-but-long-enough-value', 'prefix'],
  ] as const) {
    assert.throws(() => validateLlmApiKey(provider, apiKey), (error: unknown) => (
      error instanceof LlmCredentialError && error.code === code
    ), `${provider} ${code}`);
  }
});

test('upsert validation replaces provider and lastChars', () => {
  const first = validateLlmApiKey('openai', openaiKey);
  const second = validateLlmApiKey('openrouter', openrouterKey);
  assert.equal(first.provider, 'openai');
  assert.equal(first.lastChars, 'abcd');
  assert.equal(second.provider, 'openrouter');
  assert.equal(second.lastChars, 'wxyz');
  assert.notEqual(first.lastChars, second.lastChars);
});

test('resolveUserOrEnvCredential uses the user key only when the provider matches', () => {
  const sealed = encryptSecret(openaiKey);
  process.env.OPENROUTER_API_KEY = 'sk-or-env-fallback-key-xxxx';
  delete process.env.OPENAI_API_KEY;
  assert.equal(credentialKeyForProvider({ provider: 'openai', keyCipher: sealed }, 'openai'), openaiKey);
  assert.equal(credentialKeyForProvider({ provider: 'openai', keyCipher: sealed }, 'openrouter'), null);
  assert.equal(providerCredential('openrouter'), 'sk-or-env-fallback-key-xxxx');
  const previous = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = 'other-secret';
  assert.equal(credentialKeyForProvider({ provider: 'openai', keyCipher: sealed }, 'openai'), null);
  process.env.NEXTAUTH_SECRET = previous;
});

test('startAgentCvAction builds a profile goal offer without a stored application', () => {
  const goal = profileGoalOffer({
    targetRoles: ['Staff Engineer'],
    preferredWorkplaces: ['Remote'],
    preferredLocations: 'Madrid',
    bio: 'Backend engineer focused on TypeScript platforms.',
    skills: [{ name: 'TypeScript', category: 'other', proficiency: 'solid', evidence: '5 years' }],
  });
  assert.equal(goal.jobTitle, 'Staff Engineer');
  assert.equal(goal.company, 'Remote');
  assert.equal(goal.platform, 'other');
  assert.equal(goal.addToApplications, false);
  assert.equal(goal.url, null);
  assert.match(goal.jobDescription, /TypeScript|Staff Engineer|Madrid|Remote/);
  assert.equal('rawReport' in goal, false);
  assert.equal('jobOfferId' in goal, false);
});

test('startAgentResearchAction maps profile and scout admission without a client offer id', () => {
  assert.equal(agentResearchAdmission({ sufficient: false, hasDescribedOffer: false }), 'PROFILE_REQUIRED');
  assert.equal(agentResearchAdmission({ sufficient: true, hasDescribedOffer: false }), 'SCOUT_REQUIRED');
  assert.equal(agentResearchAdmission({ sufficient: true, hasDescribedOffer: true }), null);
  const source = readFileSync(new URL('../src/app/dashboard/agents/actions.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function startAgentResearchAction\(\)/);
  assert.match(source, /export async function startAgentCvAction\(\)/);
  assert.match(source, /enqueueResearchForOffer\(user\.id, offer\.id/);
  assert.doesNotMatch(source, /startAgentResearchAction\(jobOfferId/);
  assert.doesNotMatch(source, /startAgentCvAction\(jobOfferId/);
});

test('saveAgentModelsAction rejects a model that is not in the live catalog', () => {
  assert.throws(() => validateAgentModels(['gpt-4o'], { scout: 'gpt-4o', research: 'secret-model', cv: '' }), (error: unknown) => (
    error instanceof LlmCredentialError && error.code === 'invalid_model'
  ));
  assert.deepEqual(validateAgentModels(['gpt-4o'], { scout: 'gpt-4o', research: '', cv: undefined }), {
    scoutModel: 'gpt-4o',
    researchModel: null,
    cvModel: null,
  });
});

test('listing models uses the supplied user key and maps 401 to invalid_key', async () => {
  process.env.OPENAI_API_KEY = 'sk-env-key-must-not-be-used-zzzz';
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (_url: unknown, init?: { headers?: HeadersInit }) => {
    const headers = new Headers(init?.headers);
    seen.push(headers.get('Authorization') || '');
    if (seen.length === 1) return new Response('denied', { status: 401 });
    return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'whisper-1' }, { id: 'gpt-4.1' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchProviderModels('openai', openaiKey), (error: unknown) => (
      error instanceof CatalogError && error.code === 'invalid_key'
    ));
    const models = await fetchProviderModels('openai', openaiKey);
    assert.deepEqual(models.map(model => model.id).sort(), ['gpt-4.1', 'gpt-4o']);
    assert.equal(seen.length, 2);
    assert.equal(seen.every(value => value.includes(openaiKey) && !value.includes('sk-env-key-must-not-be-used')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AgentsWorkspace selects are only provider or model, never an application', () => {
  const source = readFileSync(new URL('../src/components/agents/AgentsWorkspace.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('selectOffer'), false);
  assert.equal(source.includes('researchOfferId'), false);
  assert.equal(source.includes('cvOfferId'), false);
  assert.equal(source.includes('emptyOffers'), false);
  assert.equal(source.includes('/api/research/'), true);
  assert.match(source, /startAgentResearchAction\(\)/);
  assert.match(source, /startAgentCvAction\(\)/);
  const selects = Array.from(source.matchAll(/<select[\s\S]*?<\/select>/g)).map(match => match[0]);
  assert.equal(selects.length, 4);
  assert.equal(selects.some(block => /PROVIDERS\.map/.test(block)), true);
  assert.equal(selects.filter(block => /models\.map/.test(block)).length, 3);
  assert.equal(selects.some(block => /offerOptions|offer\.title|candidatura/i.test(block)), false);
});

test('userErrorMessage keeps PROFILE_REQUIRED distinct from AI_UNAVAILABLE', () => {
  const profile = userErrorMessage('PROFILE_REQUIRED');
  const unavailable = userErrorMessage('AI_UNAVAILABLE');
  assert.equal(profile, 'Completa tu perfil o el CV base en Perfil y criterios.');
  assert.notEqual(profile, unavailable);
  assert.equal(userErrorMessage('SCOUT_REQUIRED'), 'Todavía no hay una oferta con descripción. Pulsa Buscar ofertas.');
  assert.equal(userErrorMessage('PROVIDER_REQUIRED'), 'Conecta un proveedor y asigna un modelo a este agente.');
});

test('sidebar and agents i18n keys exist in Spanish and English', () => {
  assert.equal(es.sidebar.menu.agents, 'Agentes');
  assert.equal(en.sidebar.menu.agents, 'Agents');
  assert.deepEqual(Object.keys(es.agents), Object.keys(en.agents));
  assert.deepEqual(Object.keys(es.agents.provider), Object.keys(en.agents.provider));
  assert.deepEqual(Object.keys(es.agents.provider.errors), Object.keys(en.agents.provider.errors));
  assert.deepEqual(Object.keys(es.agents.profile), Object.keys(en.agents.profile));
  assert.deepEqual(Object.keys(es.agents.scout), Object.keys(en.agents.scout));
  assert.deepEqual(Object.keys(es.agents.research), Object.keys(en.agents.research));
  assert.deepEqual(Object.keys(es.agents.cv), Object.keys(en.agents.cv));
  assert.deepEqual(Object.keys(es.agents.status), Object.keys(en.agents.status));
});

test('diagnosticRoute and e2e routes include /dashboard/agents', () => {
  assert.equal(diagnosticRoute('/dashboard/agents'), '/dashboard/agents');
  assert.equal(diagnosticRoute('/dashboard/agents?tab=scout'), '/dashboard/agents');
  assert.match(readFileSync(new URL('../e2e/support.ts', import.meta.url), 'utf8'), /'\/dashboard\/agents'/);
});
