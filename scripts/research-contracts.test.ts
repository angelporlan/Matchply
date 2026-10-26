import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicHttpUrl, fetchPublicSource } from '@/lib/research/providers';
import { downloadPublicText, resolvePublicHost, MAX_PAGE_BYTES } from '@/lib/offer-import/public-page';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { request as httpRequest } from 'node:http';
import { clampConfidence, clampScore } from '@/lib/research/types';

test('SSRF guard accepts public HTTP(S) and canonicalizes fragments', () => {
  assert.equal(assertPublicHttpUrl('https://example.com/jobs/1#details').toString(), 'https://example.com/jobs/1');
  assert.equal(assertPublicHttpUrl('http://example.com:80/jobs').hostname, 'example.com');
});

test('SSRF guard blocks local, private and credential URLs', () => {
  for (const value of [
    'http://localhost/admin',
    'http://127.0.0.1:8080/admin',
    'http://192.168.1.10/private',
    'http://169.254.169.254/latest/meta-data',
    'file:///etc/passwd',
    'https://user:password@example.com/private',
  ]) {
    assert.throws(() => assertPublicHttpUrl(value));
  }
});

test('research scores are bounded before persistence', () => {
  assert.equal(clampScore(120), 100);
  assert.equal(clampScore(-2), 0);
  assert.equal(clampScore('not-a-number'), null);
  assert.equal(clampConfidence(2), 1);
  assert.equal(clampConfidence(-1), 0);
});


test('research blocks reserved, mapped and unusual local URLs before opening a socket', async () => {
  let sockets = 0;
  for (const value of ['http://localhost./', 'http://service.localhost./', 'http://metadata.google.internal./',
    'http://100.64.0.1/', 'http://198.18.0.1/', 'http://192.0.2.1/', 'http://[::ffff:7f00:1]/',
    'http://[64:ff9b::a00:1]/', 'http://[2002:7f00:1::]/', 'http://[fec0::1]/', 'ftp://example.com/',
    'https://user:password@example.com/', 'http://example.com:8080/', `https://example.com/${'x'.repeat(8192)}`]) {
    assert.throws(() => assertPublicHttpUrl(value), value);
    assert.equal(await fetchPublicSource({url:value}, undefined, { request: (() => { sockets++; throw new Error('Blocked address opened a socket'); }) as typeof httpRequest }), null, value);
  }
  assert.equal(sockets, 0);
  assert.equal(assertPublicHttpUrl('https://www.linkedin.com/company/example/#people').toString(), 'https://www.linkedin.com/company/example/');
});

test('all DNS answers must be public and the validated address is pinned to the connection', async () => {
  await assert.rejects(resolvePublicHost('mixed.example', async () => [{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]), /BLOCKED/);
  await assert.rejects(resolvePublicHost('mixed.example', async () => [{address:'2606:4700:4700::1111',family:6},{address:'::ffff:7f00:1',family:6}]), /BLOCKED/);
  await assert.rejects(resolvePublicHost('empty.example', async () => []), /BLOCKED/);
  let resolutions = 0, sockets = 0;
  const resolver = async () => { resolutions++; return { address: '8.8.8.8', family: 4 }; };
  const request = ((target: URL, options: Record<string, unknown>, callback: (response: PassThrough) => void) => {
    sockets++;
    assert.equal(target.hostname, 'public.example');
    const lookup = options.lookup as (host:string, options:object, callback:(...args:unknown[])=>void)=>void;
    lookup('public.example', {}, (error, address, family) => { assert.equal(error,null); assert.equal(address,'8.8.8.8'); assert.equal(family,4); });
    lookup('public.example', { all:true }, (error, addresses) => { assert.equal(error,null); assert.deepEqual(addresses,[{address:'8.8.8.8',family:4}]); });
    const out = new EventEmitter();
    Object.assign(out,{ end: () => queueMicrotask(() => {
      const body = Object.assign(new PassThrough(),{statusCode:200,headers:{'content-type':'text/html; charset=utf-8'}});
      callback(body); body.end('<main>Public job research content</main>');
    }) });
    return out;
  }) as unknown as typeof httpRequest;
  const source = await fetchPublicSource({url:'https://public.example/company#fragment'}, undefined, { resolveHost:resolver, request });
  assert.equal(resolutions,1); assert.equal(sockets,1);
  assert.equal(source?.canonicalUrl,'https://public.example/company'); assert.equal(source?.excerpt,'Public job research content');
});

test('research rejects redirects, oversized responses and stalled DNS with a bounded deadline', async () => {
  let sockets = 0;
  const resolveHost = async () => ({address:'8.8.8.8',family:4});
  const response = (headers: Record<string,string>, status: number, body = '') => ((target: URL, options: Record<string,unknown>, callback:(response:PassThrough)=>void) => {
    sockets++;
    const lookup = options.lookup as (host:string, options:object, callback:(...args:unknown[])=>void)=>void;
    lookup(target.hostname, {}, (error,address) => { assert.equal(error,null); assert.equal(address,'8.8.8.8'); });
    const out = new EventEmitter(); Object.assign(out,{end:()=>queueMicrotask(()=>{
      const res = Object.assign(new PassThrough(),{statusCode:status,headers}); callback(res);
      if(status===200) res.end(body);
    })}); return out;
  }) as unknown as typeof httpRequest;
  const redirect = response({location:'http://127.0.0.1/private'},302);
  assert.equal(await fetchPublicSource({url:'https://public.example/'},undefined,{resolveHost,request:redirect}),null);
  assert.equal(sockets,1); // No redirected connection, even before checking its address.
  await assert.rejects(downloadPublicText('https://public.example/',undefined,{resolveHost,
    request:response({'content-type':'text/plain'},200,'x'.repeat(MAX_PAGE_BYTES+1))}),/OFFER_PAGE_TOO_LARGE/);
  await assert.rejects(downloadPublicText('https://public.example/',undefined,{resolveHost,
    request:response({'content-type':'text/plain','content-length':String(MAX_PAGE_BYTES+1)},200)}),/OFFER_PAGE_TOO_LARGE/);
  await assert.rejects(downloadPublicText('https://public.example/',undefined,{resolveHost,
    request:response({'content-type':'text/html','content-encoding':'gzip'},200)}),/OFFER_PAGE_UNAVAILABLE/);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Synthetic DNS deadline')), 40);
  try {
    const pending = downloadPublicText('https://public.example/',controller.signal,{resolveHost:()=>new Promise(()=>{})});
    await assert.rejects(pending, /Synthetic DNS deadline/);
  } finally { clearTimeout(timer); }
});

test('a stalled response is aborted while streaming, including the underlying socket', async () => {
  const { createServer } = await import('node:http');
  const server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.write('<main>Incomplete'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const local = new URL(`http://127.0.0.1:${address.port}/`);
  const adapter = ((_target: URL, options: Record<string, unknown>, callback: (response: unknown) => void) =>
    httpRequest(local, options, callback as never)) as typeof httpRequest;
  const started = Date.now();
  try {
    await assert.rejects(downloadPublicText('http://public.example/', AbortSignal.timeout(80), {
      resolveHost: async () => ({ address: '8.8.8.8', family: 4 }), request: adapter,
    }));
    assert.ok(Date.now() - started < 3000, 'A streaming timeout must not wait for the remote server');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
