import { createHash } from 'crypto';
import { assertPublicWebUrl, downloadPublicText, type DownloadDependencies } from '@/lib/offer-import/public-page';
import { resolveRouteModel } from '@/lib/ai-runtime-store';
import { DEFAULT_PRO_MODEL, DEFAULT_PRO_PROVIDER } from '@/lib/models';
import { fetchWithAiUsage } from '@/lib/ai-usage-fetch';

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

export function assertPublicHttpUrl(rawUrl: string) {
  return assertPublicWebUrl(rawUrl);
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

export async function searchWeb(query: string, maxResults = 5, signal?: AbortSignal): Promise<WebSearchResult[]> {
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
      signal: AbortSignal.any([controller.signal, ...(signal ? [signal] : [])]),
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

export async function fetchPublicSource(result: WebSearchResult, signal?: AbortSignal, dependencies: DownloadDependencies = {}): Promise<PublicSource | null> {
  try {
    const page = await downloadPublicText(result.url, signal, dependencies);
    const raw = page.html.slice(0, MAX_FETCHED_TEXT);
    const excerpt = stripHtml(raw).slice(0, MAX_SOURCE_EXCERPT);
    if (!excerpt) return null;
    const canonicalUrl = page.url;
    const domain = new URL(canonicalUrl).hostname;
    return {
      ...result, canonicalUrl, domain, excerpt,
      contentHash: createHash('sha256').update(`${canonicalUrl}\n${excerpt}`).digest('hex'),
      sourceType: sourceTypeForDomain(domain),
    };
  } catch {
    return null;
  }
}

export async function getProModelConfig() {
  const routed = await resolveRouteModel('research', true);
  return { provider: routed.provider, model: routed.model || DEFAULT_PRO_MODEL };
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
    return await fetchWithAiUsage(url, { ...init, signal: AbortSignal.any([controller.signal, ...(init.signal ? [init.signal] : [])]) });
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeJson(systemPrompt: string, userPrompt: string, config?: { provider?: string; model?: string }, signal?: AbortSignal) {
  const resolved = config || await getProModelConfig();
  const provider = resolved.provider || DEFAULT_PRO_PROVIDER;
  const model = resolved.model || DEFAULT_PRO_MODEL;
  let text: string;

  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('LLM_NOT_CONFIGURED');
    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', signal,
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
  } else if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('LLM_NOT_CONFIGURED');
    const isFixedTemp = /luna|o1|o3/i.test(model);
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        ...(isFixedTemp ? {} : { temperature: 0.1 }),
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
  } else {
    const key = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('LLM_NOT_CONFIGURED');
    const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST', signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(provider === 'openrouter' ? { 'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://matchply.com', 'X-OpenRouter-Title': 'Matchply Research' } : {}),
      },
      body: JSON.stringify({
        model,
        ...(provider === 'openrouter' ? { usage: { include: true } } : {}),
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
