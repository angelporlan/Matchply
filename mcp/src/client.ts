export type ToolResult = {
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
};

export type MatchplyClientOptions = {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_BASE = 'https://matchply.com';
const TIMEOUT_MS = 20_000;

export function matchplyBase(value?: string) {
  return (value || process.env.MATCHPLY_API_BASE || DEFAULT_BASE).trim().replace(/\/+$/, '');
}

export function requireMatchplyToken(env: NodeJS.ProcessEnv = process.env) {
  const token = env.MATCHPLY_API_TOKEN?.trim();
  if (!token) return { ok: false as const, message: 'MATCHPLY_API_TOKEN es obligatorio.' };
  return { ok: true as const, token };
}

function redact(value: string, token: string) {
  return token ? value.split(token).join('[redacted]') : value;
}

function toolError(code: string, message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code, message }) }] };
}

function errorPayload(text: string, status: number, token: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<')) return { code: 'http_error', message: `La API respondió ${status}.` };
  try {
    const parsed = JSON.parse(trimmed) as { error?: { code?: unknown; message?: unknown } };
    const code = typeof parsed.error?.code === 'string' ? parsed.error.code : 'http_error';
    const message = typeof parsed.error?.message === 'string' ? parsed.error.message : `La API respondió ${status}.`;
    return { code, message: redact(message, token) };
  } catch {
    return { code: 'http_error', message: `La API respondió ${status}.` };
  }
}

export async function matchplyFetch(
  method: string,
  path: string,
  extra: { body?: unknown; query?: Record<string, string | number | null | undefined> } = {},
  options: MatchplyClientOptions = {},
): Promise<ToolResult> {
  const token = options.token ?? process.env.MATCHPLY_API_TOKEN ?? '';
  const url = new URL(path, `${matchplyBase(options.baseUrl)}/`);
  for (const [key, value] of Object.entries(extra.query || {})) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS) };
  if (extra.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(extra.body);
  }
  try {
    const response = await (options.fetch ?? fetch)(url, init);
    const text = await response.text();
    if (!response.ok) {
      const error = errorPayload(text, response.status, token);
      return toolError(error.code, error.message);
    }
    return { content: [{ type: 'text', text }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo contactar con Matchply.';
    return toolError('network', redact(message, token));
  }
}
