import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPlanConfig, parsePlanConfig, renderPaywallCopy } from '@/lib/plan-config';
import { utcUsageMonth, nextUsageMonth, usageInputHash } from '@/lib/usage';

test('agreed plan defaults use three CVs and monthly AI, matching and research pools', () => {
  const config = parsePlanConfig(defaultPlanConfig());
  assert.deepEqual(config.free, { maxCvs: 3, maxBaseCvs: 1, maxAdaptedCvs: 2, generalAiMonthly: 10, matchingMonthly: 10, researchMonthly: 0, matchBatchSize: 1, apiKeys: 0, apiRequestsPerMinute: 0 });
  assert.equal(config.pro.maxCvs, null); assert.equal(config.pro.generalAiMonthly, 200); assert.equal(config.pro.matchBatchSize, 50);
});
test('invalid units, permissions, CV coherence and batch capacity cannot be published', () => {
  for (const mutate of [(c: any) => c.free.generalAiMonthly = -1, (c: any) => c.free.matchingMonthly = 1.5, (c: any) => c.pro.matchBatchSize = 301, (c: any) => c.pro.apiKeys = 0, (c: any) => c.free.maxCvs = 2, (c: any) => c.free.generalAiMonthly = null]) {
    const config = defaultPlanConfig(); mutate(config); assert.throws(() => parsePlanConfig(config));
  }
  const disabled = defaultPlanConfig(); disabled.free.matchBatchSize = 0; disabled.free.matchingMonthly = 0; assert.equal(parsePlanConfig(disabled).free.matchingMonthly, 0);
});
test('paywall text is bilingual plain text with known dynamic values', () => {
  const config = defaultPlanConfig(); const copy = renderPaywallCopy(config.paywall.copy.b.en, config.pro);
  assert.match(copy.body, /300/); assert.match(copy.body, /10/);
  config.paywall.copy.a.es.body = '<script>'; assert.throws(() => parsePlanConfig(config));
  config.paywall.copy.a.es.body = '{unknown}'; assert.throws(() => parsePlanConfig(config));
});
test('the default paywall reflects finite or unlimited Pro storage in both languages', () => {
  const config = defaultPlanConfig();
  for (const locale of ['es', 'en'] as const) {
    const copy = config.paywall.copy.a[locale];
    assert.match(renderPaywallCopy(copy, config.pro).body, /∞/);
    const finite = renderPaywallCopy(copy, { ...config.pro, maxCvs: 5, generalAiMonthly: 40 });
    assert.match(finite.body, /5/); assert.match(finite.body, /40/);
    assert.doesNotMatch(finite.body, /sin límite|unlimited|∞/);
  }
});
test('calendar periods are UTC and operation identity is independent of JSON key order', () => {
  assert.equal(utcUsageMonth(new Date('2026-12-31T23:59:59Z')).toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(nextUsageMonth(new Date('2026-12-01Z')).toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(usageInputHash({ a: 1, nested: { b: 2, c: 3 } }), usageInputHash({ nested: { c: 3, b: 2 }, a: 1 }));
  assert.notEqual(usageInputHash([1, 2]), usageInputHash([2, 1]));
});
