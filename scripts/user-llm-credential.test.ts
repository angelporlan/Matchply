import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';
import {
  credentialKeyForProvider,
  llmCredentialWriteBlocked,
  toPublicLlmCredential,
  validateLlmApiKey,
  LlmCredentialError,
} from '@/lib/user-llm-credential';
import { AGENT_CV_OFFER_COLUMNS, agentCvAdmissionError } from '@/lib/agent-cv';
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

test('startAgentCvAction rejects foreign offers, empty descriptions and never selects rawReport', () => {
  assert.equal(agentCvAdmissionError(null), 'not_found');
  assert.equal(agentCvAdmissionError({ description: '' }), 'offer_description_required');
  assert.equal(agentCvAdmissionError({ description: '   ' }), 'offer_description_required');
  assert.equal(agentCvAdmissionError({ description: 'We need a React engineer in Madrid.' }), null);
  assert.equal('rawReport' in AGENT_CV_OFFER_COLUMNS, false);
  assert.deepEqual(Object.keys(AGENT_CV_OFFER_COLUMNS).sort(), ['company', 'cvId', 'description', 'id', 'platform', 'title', 'url']);
});

test('sidebar and agents i18n keys exist in Spanish and English', () => {
  assert.equal(es.sidebar.menu.agents, 'Agentes');
  assert.equal(en.sidebar.menu.agents, 'Agents');
  assert.deepEqual(Object.keys(es.agents), Object.keys(en.agents));
  assert.deepEqual(Object.keys(es.agents.provider), Object.keys(en.agents.provider));
  assert.deepEqual(Object.keys(es.agents.provider.errors), Object.keys(en.agents.provider.errors));
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
