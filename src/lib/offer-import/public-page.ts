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

export function assertPublicOfferUrl(rawUrl: string): URL {
  const url = new URL(normalizeOfferUrl(rawUrl));
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host === 'metadata.google.internal' || (ipaddr.isValid(host) && !isPublicAddress(host))) {
    throw new Error('OFFER_URL_BLOCKED');
  }
  return url;
}

export async function resolvePublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '');
  const records = ipaddr.isValid(host)
    ? [{ address: host, family: ipaddr.parse(host).kind() === 'ipv4' ? 4 : 6 }]
    : await lookup(host, { all: true });
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

type DownloadDependencies = {
  resolveHost?: typeof resolvePublicHost;
  request?: typeof httpRequest;
};

/** DNS is checked once per hop and the socket uses that exact address. */
export async function downloadPublicPage(rawUrl: string, signal?: AbortSignal, dependencies: DownloadDependencies = {}): Promise<PublicPage> {
  let url = assertPublicOfferUrl(rawUrl);
  const visitedUrls: string[] = [];
  const boundedSignal = AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]);
  for (let hop = 0; hop <= 3; hop++) {
    boundedSignal.throwIfAborted();
    // Do not normalize redirects back to the original LinkedIn URL.
    assertPublicOfferUrl(url.toString());
    const address = await abortable((dependencies.resolveHost || resolvePublicHost)(url.hostname), boundedSignal);
    if (!isPublicAddress(address.address)) throw new Error('OFFER_URL_BLOCKED');
    boundedSignal.throwIfAborted();
    visitedUrls.push(url.toString());
    const response = await new Promise<{ html: string; redirect?: string }>((resolve, reject) => {
      const request = (dependencies.request || (url.protocol === 'https:' ? httpsRequest : httpRequest))(url, {
        agent: false,
        signal: boundedSignal,
        headers: { 'User-Agent': 'MatchplyResearchBot/1.0 (+https://matchply.com)', 'Accept-Encoding': 'identity', Accept: 'text/html,application/xhtml+xml' },
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
        if (status < 200 || status >= 300 || !/text\/html|application\/xhtml\+xml/i.test(res.headers['content-type'] || '') ||
            (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
          res.destroy();
          reject(new Error('OFFER_PAGE_UNAVAILABLE'));
          return;
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_PAGE_BYTES) { res.destroy(new Error('OFFER_PAGE_TOO_LARGE')); return; }
          chunks.push(chunk);
        });
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
