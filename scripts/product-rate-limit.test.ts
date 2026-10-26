import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIpKey, trustedClientIp } from '@/lib/client-ip';
import { consumeProductIp, consumeProductSession, checkProductIp, PRODUCT_RATE_POLICIES } from '@/lib/product-rate-limit';
import { RateLimitError, resetRateLimitBucketsForTests } from '@/lib/rate-limit';

const request = (headers: Record<string, string> = {}) => ({ headers: new Headers(headers) });

test('the trusted proxy IP takes priority over spoofed forwarded values and is normalized', () => {
  assert.equal(trustedClientIp(request({ 'x-real-ip': '203.0.113.10', 'x-forwarded-for': '192.0.2.100, 203.0.113.10' })), '203.0.113.10');
  assert.equal(trustedClientIp(request({ 'x-forwarded-for': '192.0.2.100, 203.0.113.10' })), '203.0.113.10');
  assert.equal(trustedClientIp(request({ 'x-real-ip': 'bad', 'x-forwarded-for': '192.0.2.100, 203.0.113.10' })), '203.0.113.10');
  assert.equal(trustedClientIp(request({ 'x-real-ip': '::ffff:203.0.113.10' })), '203.0.113.10');
  assert.equal(trustedClientIp(request({ 'x-real-ip': 'not-an-ip' })), 'unknown');
  assert.match(clientIpKey(request({ 'x-real-ip': '203.0.113.10' })), /^[a-f0-9]{64}$/);
  assert.equal(clientIpKey(request({ 'x-real-ip': '::ffff:203.0.113.10' })), clientIpKey(request({ 'x-real-ip': '203.0.113.10' })));
});

test('IP and verified session limits are independent, bounded, and return a retry time', async t => {
  resetRateLimitBucketsForTests();
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const ip = request({ 'x-real-ip': '198.18.0.1' });
  const otherIp = request({ 'x-real-ip': '198.18.0.2' });
  const policy = PRODUCT_RATE_POLICIES.parsePdf;
  for (let i = 0; i < policy.session; i++) consumeProductSession('session-a', 'parsePdf');
  assert.throws(() => consumeProductSession('session-a', 'parsePdf'), (error: unknown) => error instanceof RateLimitError && error.retryAfterSeconds === 600);
  assert.doesNotThrow(() => consumeProductSession('session-b', 'parsePdf'));
  for (let i = 0; i < policy.ip; i++) consumeProductIp(ip, 'parsePdf');
  const blocked = checkProductIp(ip, 'parsePdf'); assert.ok(blocked);
  assert.equal(blocked.status, 429); assert.equal(blocked.headers.get('retry-after'), '600');
  assert.equal((await blocked.json()).code, 'RATE_LIMITED');
  assert.doesNotThrow(() => consumeProductIp(otherIp, 'parsePdf'));
  assert.doesNotThrow(() => consumeProductIp(ip, 'optimize'));
  now += 300_000;
  assert.throws(() => consumeProductSession('session-a', 'parsePdf'), (error: unknown) => error instanceof RateLimitError && error.retryAfterSeconds === 300);
  now += 300_000;
  assert.doesNotThrow(() => consumeProductSession('session-a', 'parsePdf'));
  assert.doesNotThrow(() => consumeProductIp(ip, 'parsePdf'));
});

test('costly HTTP entry points reject an exhausted IP before authentication or body parsing', async () => {
  const { NextRequest } = await import('next/server');
  const id = '11111111-1111-4111-8111-111111111111';
  const routes: Array<{ kind: keyof typeof PRODUCT_RATE_POLICIES; path: string; run: (request: InstanceType<typeof NextRequest>) => Promise<Response>; extension?: boolean }> = [
    { kind:'guest', path:'/api/guest', run:(await import('@/app/api/guest/route')).GET },
    { kind:'optimize', path:'/api/ai/optimize', run:(await import('@/app/api/ai/optimize/route')).POST },
    { kind:'optimize', path:`/api/ai/optimize/${id}/generate`, run:req => import('@/app/api/ai/optimize/[id]/generate/route').then(m=>m.POST(req,{params:{id}})) },
    { kind:'optimize', path:`/api/ai/optimize/${id}/retry`, run:req => import('@/app/api/ai/optimize/[id]/retry/route').then(m=>m.POST(req,{params:{id}})) },
    { kind:'offerImport', path:'/api/ai/offers/import', run:(await import('@/app/api/ai/offers/import/route')).POST },
    { kind:'discovery', path:'/api/ai/offers/discover', run:(await import('@/app/api/ai/offers/discover/route')).POST },
    { kind:'curate', path:'/api/ai/curate', run:(await import('@/app/api/ai/curate/route')).POST },
    { kind:'outreach', path:'/api/ai/outreach', run:(await import('@/app/api/ai/outreach/route')).POST },
    { kind:'networking', path:'/api/ai/networking', run:(await import('@/app/api/ai/networking/route')).POST },
    { kind:'profileExtract', path:'/api/ai/profile/extract', run:(await import('@/app/api/ai/profile/extract/route')).POST },
    { kind:'profileInterview', path:'/api/ai/profile/interview', run:(await import('@/app/api/ai/profile/interview/route')).POST },
    { kind:'cvImport', path:'/api/cv/import', run:(await import('@/app/api/cv/import/route')).POST },
    { kind:'parsePdf', path:'/api/cv/parse-pdf', run:(await import('@/app/api/cv/parse-pdf/route')).POST },
    { kind:'research', path:`/api/research/${id}`, run:req => import('@/app/api/research/[offerId]/route').then(m=>m.POST(req,{params:{offerId:id}})) },
    { kind:'cvPhoto', path:`/api/cv/${id}/photo`, run:req => import('@/app/api/cv/[cvId]/photo/route').then(m=>m.POST(req,{params:{cvId:id}})) },
    { kind:'profilePhoto', path:'/api/account/avatar', run:(await import('@/app/api/account/avatar/route')).POST },
    { kind:'personPhoto', path:`/api/people/${id}/avatar`, run:req => import('@/app/api/people/[id]/avatar/route').then(m=>m.POST(req,{params:{id}})) },
    { kind:'extensionUpload', path:'/api/extension/linkedin/ingest', run:(await import('@/app/api/extension/linkedin/ingest/route')).POST, extension:true },
    { kind:'extensionUpload', path:'/api/extension/linkedin/people', run:(await import('@/app/api/extension/linkedin/people/route')).POST, extension:true },
    { kind:'extensionUpload', path:'/api/extension/linkedin/people/avatar', run:(await import('@/app/api/extension/linkedin/people/avatar/route')).POST, extension:true },
  ];
  for (const route of routes) {
    resetRateLimitBucketsForTests();
    const method = route.kind === 'guest' ? 'GET' : 'POST';
    const req = new NextRequest(`http://localhost${route.path}`, { method, headers:{'x-real-ip':'203.0.113.42'}, ...(method === 'POST' ? {body:'unread body'} : {}) });
    for (let i=0; i<PRODUCT_RATE_POLICIES[route.kind].ip; i++) consumeProductIp(req, route.kind);
    const response = await route.run(req);
    assert.equal(response.status,429,route.path);
    assert.equal((await response.json()).code,'RATE_LIMITED',route.path);
    assert.ok(Number(response.headers.get('retry-after')) > 0,route.path);
    if (route.extension) assert.equal(response.headers.get('access-control-allow-origin'),'*',route.path);
    if (method === 'POST') assert.equal(req.bodyUsed,false,route.path);
  }
});
