import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OfferImportError } from '@/lib/offer-import/service';
import {
  LOOKUP_FAILURE_TTL_MS, classifyLookupError, decideDescriptionLookup, failedLookupMetadata, isListCardDump,
  lookupFailureMessage, offerNeedsDescriptionLookup, recoveredDescriptionMetadata, rememberedLookupFailure,
} from '@/lib/matching/description-lookup';

const card = {
  title: 'Senior Engineer',
  company: 'Zurich Insurance',
  description: 'Senior Engineer\nZurich Insurance\nBarcelona\nHíbrido',
  url: 'https://www.linkedin.com/jobs/view/4477259122',
  sourceMetadata: { captureKind: 'list', location: 'Barcelona', workplaceType: 'Híbrido' },
};

test('a list card is looked up and a saved description is not', () => {
  assert.equal(isListCardDump(card), true);
  assert.equal(offerNeedsDescriptionLookup(card), true);
  assert.equal(offerNeedsDescriptionLookup({ ...card, description: 'Zurich Insurance\n.\nBarcelona\nHíbrido', title: 'Zurich Insurance', company: '.' }), true);
  assert.equal(offerNeedsDescriptionLookup({ description: '', sourceMetadata: {} }), true);
  assert.equal(offerNeedsDescriptionLookup({ description: '   ' }), true);
  assert.equal(offerNeedsDescriptionLookup({ description: 'DESCRIPTION_SENTINEL', sourceMetadata: {} }), false);
  assert.equal(offerNeedsDescriptionLookup({ description: `${'Requisito de React. '.repeat(8)}`, sourceMetadata: { captureKind: 'detail' } }), false);
  const written = `${'La persona diseñará el producto y hablará con clientes. '.repeat(4)}`;
  assert.equal(offerNeedsDescriptionLookup({ ...card, description: written }), false);
  assert.deepEqual(decideDescriptionLookup(card), { action: 'search', url: card.url });
  assert.deepEqual(decideDescriptionLookup({ ...card, description: written }), { action: 'ready' });
  const missingUrl = decideDescriptionLookup({ ...card, url: '  ' });
  assert.equal(missingUrl.action, 'fail');
  if (missingUrl.action === 'fail') {
    assert.equal(missingUrl.code, 'NO_URL');
    assert.equal(missingUrl.remember, true);
    assert.match(missingUrl.message, /enlace público/);
  }
});

test('a confirmed miss is skipped only for the same URL and only for two hours', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const at = new Date(now - 60_000).toISOString();
  const sourceMetadata = failedLookupMetadata(card.sourceMetadata, 'OFFER_NOT_FOUND', card.url, at);
  assert.equal(rememberedLookupFailure(sourceMetadata, card.url, now), 'OFFER_NOT_FOUND');
  assert.equal(rememberedLookupFailure(sourceMetadata, 'https://www.linkedin.com/jobs/view/999', now), null);
  assert.equal(rememberedLookupFailure(sourceMetadata, card.url, now + LOOKUP_FAILURE_TTL_MS), null);
  const decision = decideDescriptionLookup({ ...card, sourceMetadata }, now);
  assert.equal(decision.action, 'fail');
  if (decision.action === 'fail') assert.equal(decision.remember, false);
  assert.equal(decideDescriptionLookup({ ...card, sourceMetadata }, now + LOOKUP_FAILURE_TTL_MS).action, 'search');
  const retryable = failedLookupMetadata(card.sourceMetadata, 'OFFER_IMPORT_TIMEOUT', card.url, at);
  assert.equal(rememberedLookupFailure(retryable, card.url, now), null);
  assert.equal(rememberedLookupFailure({ descriptionLookup: { status: 'failed', code: 'OFFER_SOURCE_MISMATCH', url: card.url, at } }, card.url, now), null, 'retry cached misses after the retrieval strategy changes');
});

test('lookup failures stay separate from the description text', () => {
  assert.equal(classifyLookupError(new OfferImportError('OFFER_SOURCE_MISMATCH')).remember, true);
  assert.equal(classifyLookupError(new OfferImportError('OFFER_IMPORT_TIMEOUT', true)).remember, false);
  assert.equal(classifyLookupError(new OfferImportError('OFFER_AI_HTTP_429', true)).remember, false);
  assert.equal(classifyLookupError(new Error('socket hang up')).code, 'OFFER_LOOKUP_FAILED');
  assert.match(lookupFailureMessage('OFFER_NOT_FOUND'), /vuelve a capturarla/);
  const saved = recoveredDescriptionMetadata(
    { ...card.sourceMetadata, descriptionLookup: { status: 'failed', code: 'OFFER_NOT_FOUND' } },
    [' https://www.linkedin.com/jobs/view/4477259122/ '],
    'web_search',
  );
  assert.equal(saved.captureKind, 'detail');
  assert.equal(saved.location, 'Barcelona');
  assert.equal(saved.descriptionSource, 'web_search');
  assert.equal('descriptionLookup' in saved, false);
  assert.deepEqual(saved.descriptionSources, ['https://www.linkedin.com/jobs/view/4477259122/']);
  assert.equal(recoveredDescriptionMetadata({}, [], 'direct').descriptionSource, 'public_page');
});

test('Decisions keeps scoring and the description search stays on the offer import', () => {
  const batch = readFileSync('src/lib/ai-jobs/match-batch.ts', 'utf8');
  const decisions = readFileSync('src/lib/ai-service.ts', 'utf8');
  const worker = readFileSync('src/lib/ai-jobs/process.ts', 'utf8');
  assert.match(batch, /importOffer\(/);
  assert.match(batch, /description: imported\.jobDescription/);
  assert.doesNotMatch(batch, /jobTitle|imported\.company/);
  assert.match(decisions, /https:\/\/api\.openai\.com\/v1\/decisions/);
  assert.match(decisions, /model: DECISION_MODEL, input, questions/);
  assert.doesNotMatch(decisions, /web_search/);
  assert.match(worker, /processMatchBatch\(job, importController\.signal\)/);
});
