import { createHash } from 'crypto';
import { isIP } from 'net';
import { lookup } from 'node:dns/promises';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { DEFAULT_PRO_MODEL, DEFAULT_PRO_PROVIDER, getDefaultModelForProvider } from '@/lib/models';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_FETCHED_TEXT = 24_000;
const MAX_SOURCE_EXCERPT = 6_000;

export type WebSearchResult = {
  url: string;
  title?: string;
  snippet?: string;
  publishedAt?: string | null;
};

export type PublicSource = WebSearchResult & {
  canonicalUrl: string;
  domain: string;
  excerpt: string;
  contentHash: string;
  sourceType: string;
};

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7));
  return normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd');
}

export function assertPublicHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('SOURCE_URL_INVALID');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const ipType = isIP(hostname);
  if (!(url.protocol === 'http:' || url.protocol === 'https:')) throw new Error('SOURCE_URL_SCHEME_BLOCKED');
  if (url.username || url.password) throw new Error('SOURCE_URL_CREDENTIALS_BLOCKED');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('SOURCE_URL_PORT_BLOCKED');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
      hostname === 'metadata.google.internal' || hostname === '169.254.169.254' ||
      (ipType === 4 && isPrivateIpv4(hostname)) || (ipType === 6 && isPrivateIpv6(hostname))) {
    throw new Error('SOURCE_URL_PRIVATE_NETWORK_BLOCKED');
  }
  url.hash = '';
  return url;
}

async function assertPublicResolvedHost(hostname: string) {
  if (isIP(hostname)) return;
  const records = await lookup(hostname, { all: true });
  if (!records.length || records.some(record => {
    const type = isIP(record.address);
    return (type === 4 && isPrivateIpv4(record.address)) || (type === 6 && isPrivateIpv6(record.address));
  })) {
    throw new Error('SOURCE_DNS_PRIVATE_NETWORK_BLOCKED');
  }
}

function sourceTypeForDomain(domain: string) {
  if (/linkedin\.com$/i.test(domain)) return 'linkedin';
  if (/news|reuters|bloomberg|techcrunch|forbes/i.test(domain)) return 'news';
  if (/glassdoor|indeed|comparably|kununu/i.test(domain)) return 'review';
  return 'web';
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: query.slice(0, 500),
        search_depth: 'basic',
        max_results: Math.min(5, Math.max(1, maxResults)),
        include_answer: false,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`TAVILY_HTTP_${response.status}`);
    const body = await response.json() as { results?: Array<{ url?: string; title?: string; content?: string; published_date?: string }> };
    return (body.results || []).flatMap(item => item.url ? [{
      url: item.url,
      title: item.title,
      snippet: item.content?.slice(0, MAX_SOURCE_EXCERPT),
      publishedAt: item.published_date || null,
    }] : []);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPublicSource(result: WebSearchResult): Promise<PublicSource | null> {
  let url: URL;
  try {
    url = assertPublicHttpUrl(result.url);
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    await assertPublicResolvedHost(url.hostname);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MatchplyResearchBot/1.0 (+https://matchply.com)' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/') && !contentType.includes('json')) return null;
    const raw = (await response.text()).slice(0, MAX_FETCHED_TEXT);
    const excerpt = stripHtml(raw).slice(0, MAX_SOURCE_EXCERPT);
    if (!excerpt) return null;
    const canonicalUrl = url.toString();
    return {
      ...result,
      canonicalUrl,
      domain: url.hostname,
      excerpt,
      contentHash: createHash('sha256').update(`${canonicalUrl}\n${excerpt}`).digest('hex'),
      sourceType: sourceTypeForDomain(url.hostname),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getProModelConfig() {
  const getSetting = async (key: string, fallback: string) => {
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return row?.value || fallback;
  };
  const provider = await getSetting('pro_provider', DEFAULT_PRO_PROVIDER);
  const model = await getSetting('pro_model', getDefaultModelForProvider('pro', provider));
  return { provider, model: model || DEFAULT_PRO_MODEL };
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error('LLM_INVALID_JSON');
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeJson(systemPrompt: string, userPrompt: string, config?: { provider?: string; model?: string }) {
  const resolved = config || await getProModelConfig();
  const provider = resolved.provider || DEFAULT_PRO_PROVIDER;
  const model = resolved.model || DEFAULT_PRO_MODEL;
  let text: string;

  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('LLM_NOT_CONFIGURED');
    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    });
    if (!response.ok) throw new Error(`LLM_HTTP_${response.status}`);
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    text = body.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  } else {
    const key = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('LLM_NOT_CONFIGURED');
    const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(provider === 'openrouter' ? { 'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://matchply.com', 'X-OpenRouter-Title': 'Matchply Research' } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM_HTTP_${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    text = body.choices?.[0]?.message?.content || '';
  }
  if (!text) throw new Error('LLM_EMPTY_RESPONSE');
  return parseJsonObject(text);
}
