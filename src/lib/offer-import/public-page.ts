import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { normalizeOfferUrl } from './types';

export const MAX_PAGE_BYTES = 2 * 1024 * 1024;

export function isPublicAddress(address: string): boolean {
  try {
    const ip = ipaddr.process(address.replace(/^\[|\]$/g, ''));
    return ip.range() === 'unicast';
  } catch { return false; }
}

/** Validate any public HTTP(S) source, without applying offer-specific LinkedIn rules. */
export function assertPublicWebUrl(rawUrl: string): URL {
  if (typeof rawUrl !== 'string' || rawUrl.length > 8192) throw new Error('OFFER_URL_INVALID');
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('OFFER_URL_INVALID'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port))) throw new Error('OFFER_URL_INVALID');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host === 'metadata.google.internal' || (ipaddr.isValid(host) && !isPublicAddress(host))) {
    throw new Error('OFFER_URL_BLOCKED');
  }
  url.hash = '';
  return url;
}

export function assertPublicOfferUrl(rawUrl: string): URL {
  if (typeof rawUrl !== 'string' || rawUrl.length > 8192) throw new Error('OFFER_URL_INVALID');
  return assertPublicWebUrl(normalizeOfferUrl(rawUrl));
}

export async function resolvePublicHost(hostname: string, resolveAll = (host: string) => lookup(host, { all: true })) {
  const host = hostname.replace(/^\[|\]$/g, '');
  const records = ipaddr.isValid(host)
    ? [{ address: host, family: ipaddr.parse(host).kind() === 'ipv4' ? 4 : 6 }]
    : await resolveAll(host);
  if (!records.length || records.some(record => !isPublicAddress(record.address))) {
    throw new Error('OFFER_URL_BLOCKED');
  }
  return records[0];
}

export type PublicPage = { html: string; url: string; visitedUrls: string[] };

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

export type DownloadDependencies = {
  resolveHost?: typeof resolvePublicHost;
  request?: typeof httpRequest;
};

type DownloadPolicy = { kind: 'offer' | 'research'; timeoutMs: number; maxRedirects: number };

/** Resolve and validate every address, then pin the checked address to the socket. */
async function download(rawUrl: string, signal: AbortSignal | undefined, dependencies: DownloadDependencies, policy: DownloadPolicy): Promise<PublicPage> {
  const checkUrl = policy.kind === 'offer' ? assertPublicOfferUrl : assertPublicWebUrl;
  let url = checkUrl(rawUrl);
  const visitedUrls: string[] = [];
  const boundedSignal = AbortSignal.any([AbortSignal.timeout(policy.timeoutMs), ...(signal ? [signal] : [])]);
  for (let hop = 0; hop <= policy.maxRedirects; hop++) {
    boundedSignal.throwIfAborted();
    // Validate each redirect without replacing the actual URL with LinkedIn's canonical job URL.
    checkUrl(url.toString());
    const address = await abortable((dependencies.resolveHost || resolvePublicHost)(url.hostname), boundedSignal);
    if (!isPublicAddress(address.address)) throw new Error('OFFER_URL_BLOCKED');
    boundedSignal.throwIfAborted();
    visitedUrls.push(url.toString());
    const response = await new Promise<{ html: string; redirect?: string }>((resolve, reject) => {
      const request = (dependencies.request || (url.protocol === 'https:' ? httpsRequest : httpRequest))(url, {
        agent: false,
        signal: boundedSignal,
        headers: { 'User-Agent': 'MatchplyResearchBot/1.0 (+https://matchply.com)', 'Accept-Encoding': 'identity',
          Accept: policy.kind === 'offer' ? 'text/html,application/xhtml+xml' : 'text/*,application/json,application/xhtml+xml' },
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      }, res => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.destroy();
          resolve({ html: '', redirect: res.headers.location });
          return;
        }
        if ([401, 403, 429].includes(status)) {
          res.destroy();
          reject(new Error('OFFER_PORTAL_BLOCKED'));
          return;
        }
        const mediaType = (res.headers['content-type'] || '').split(';', 1)[0].trim();
        const allowed = policy.kind === 'offer' ? /^(?:text\/html|application\/xhtml\+xml)$/i.test(mediaType)
          : /^(?:text\/[a-z0-9.+-]+|application\/(?:json|[a-z0-9.+-]+\+json|xhtml\+xml))$/i.test(mediaType);
        const encoding = res.headers['content-encoding']?.trim().toLowerCase();
        if (status < 200 || status >= 300 || !allowed || (encoding && encoding !== 'identity')) {
          res.destroy();
          reject(new Error('OFFER_PAGE_UNAVAILABLE'));
          return;
        }
        if (Number(res.headers['content-length']) > MAX_PAGE_BYTES) {
          res.destroy(); reject(new Error('OFFER_PAGE_TOO_LARGE')); return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_PAGE_BYTES) { res.destroy(new Error('OFFER_PAGE_TOO_LARGE')); return; }
          chunks.push(chunk);
        });
        res.on('aborted', () => reject(new Error('OFFER_PAGE_UNAVAILABLE')));
        res.on('error', reject);
        res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', reject);
      request.end();
    });
    if (!response.redirect) return { html: response.html, url: url.toString(), visitedUrls };
    url = new URL(response.redirect, url);
  }
  throw new Error('OFFER_REDIRECT_LIMIT');
}

/** Offer imports allow up to three separately validated redirects and fifteen seconds total. */
export function downloadPublicPage(rawUrl: string, signal?: AbortSignal, dependencies: DownloadDependencies = {}): Promise<PublicPage> {
  return download(rawUrl, signal, dependencies, { kind: 'offer', timeoutMs: 15_000, maxRedirects: 3 });
}

/** Research sources keep their no-redirect policy and a twelve-second total deadline. */
export function downloadPublicText(rawUrl: string, signal?: AbortSignal, dependencies: DownloadDependencies = {}): Promise<PublicPage> {
  return download(rawUrl, signal, dependencies, { kind: 'research', timeoutMs: 12_000, maxRedirects: 0 });
}
