import { getAiUsageContext, type AiUsageContext } from './ai-usage-context';
import { readTokenUsage, type TokenUsage } from './ai-request-cost';
import { recordAiRequestUsage, type AiRequestMetric } from './ai-request-usage';

type RequestMeta = AiUsageContext & { provider: string; model: string; endpoint: string; serviceTier?: string };
type Recorder = (metric: AiRequestMetric) => void;
const persist: Recorder = recordAiRequestUsage;

/** Observe bytes as the caller reads them. No cloned body, second consumer or persisted text. */
export function observeAiResponse(response: Response, meta: RequestMeta, started: number, record: Recorder = persist): Response {
  let recorded = false; let payload: Record<string, any> = {}; let usage: TokenUsage = readTokenUsage(null);
  let serviceTier = meta.serviceTier; let streamError = false;
  const finish = (errorCode?: string) => {
    if (recorded) return; recorded = true;
    record({ ...meta, ...usage, serviceTier, success: response.ok && !errorCode && !streamError,
      latencyMs: Date.now() - started, providerRequestId: response.headers.get('x-request-id') ?? (typeof payload.id === 'string' ? payload.id : undefined),
      errorCode: errorCode ?? (streamError ? 'STREAM_ERROR' : undefined) });
  };
  if (!response.ok || !response.body) { finish(response.ok ? 'EMPTY_RESPONSE' : `HTTP_${response.status}`); return response; }
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  const sse = response.headers.get('content-type')?.includes('text/event-stream');
  let buffer = ''; let exceeded = false;
  const accept = (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const event = data as Record<string, any>;
    streamError ||= Boolean(event.error || event.type === 'error' || event.type === 'response.failed');
    const value = event.response ?? event;
    payload = { id: value.id };
    serviceTier = value.service_tier ?? serviceTier;
    if (value.usage || value.usageMetadata) usage = readTokenUsage(value);
  };
  const parse = (value: string) => { try { accept(JSON.parse(value)); } catch { /* Accounting never changes provider parsing. */ } };
  const ingest = (bytes?: Uint8Array, done = false) => {
    if (exceeded) return;
    buffer += decoder.decode(bytes, { stream: !done });
    if (buffer.length > 2_000_000) { exceeded = true; buffer = ''; return; }
    if (sse) {
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const end = match.index; const separator = match[0].length;
        const event = buffer.slice(0, end); buffer = buffer.slice(end + separator);
        const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data && data !== '[DONE]') parse(data);
      }
      if (done && buffer.trim()) {
        const data = buffer.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data && data !== '[DONE]') parse(data);
      }
    } else if (done) parse(buffer);
  };
  return new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const item = await reader.read(); ingest(item.value, item.done);
        if (item.done) { finish(); reader.releaseLock(); controller.close(); }
        else controller.enqueue(item.value);
      } catch (error) { finish('BODY_READ_FAILED'); controller.error(error); }
    },
    async cancel(reason) { finish('CANCELLED'); await reader.cancel(reason).catch(() => {}); reader.releaseLock(); },
  }), { status: response.status, statusText: response.statusText, headers: response.headers });
}

/** Only inference POSTs inside an attributed operation are tracked. Catalogs and page downloads are excluded. */
export async function fetchWithAiUsage(url: string, init: RequestInit = {}, attribution: Partial<AiUsageContext> = {}): Promise<Response> {
  const inherited = getAiUsageContext();
  const context = inherited ? { ...inherited, ...attribution } : undefined;
  if (!context || init.method?.toUpperCase() !== 'POST') return fetch(url, init);
  const target = new URL(url); let body: Record<string, any>;
  try { body = typeof init.body === 'string' ? JSON.parse(init.body) : {}; } catch { body = {}; }
  let provider: string; let endpoint: string; let model = body.model;
  if (target.hostname === 'generativelanguage.googleapis.com' && /:(streamGenerateContent|generateContent)$/.test(target.pathname)) {
    provider = 'gemini'; endpoint = 'generateContent'; model = decodeURIComponent(target.pathname.split('/models/')[1].split(':')[0]);
  } else {
    provider = ({ 'api.openai.com': 'openai', 'openrouter.ai': 'openrouter', 'api.deepseek.com': 'deepseek' } as Record<string, string>)[target.hostname];
    endpoint = target.pathname.endsWith('/chat/completions') ? 'chat/completions' : target.pathname.endsWith('/responses') ? 'responses' : target.pathname.endsWith('/decisions') ? 'decisions' : '';
    if (!provider || !endpoint) return fetch(url, init);
  }
  const meta = { ...context, provider, model: typeof model === 'string' ? model : 'unknown', endpoint, serviceTier: body.service_tier };
  const started = Date.now();
  try { return observeAiResponse(await fetch(url, init), meta, started); }
  catch (error) {
    persist({ ...meta, ...readTokenUsage(null), success: false, latencyMs: Date.now() - started, errorCode: init.signal?.aborted ? 'CANCELLED' : 'CONNECTION_FAILED' });
    throw error;
  }
}
