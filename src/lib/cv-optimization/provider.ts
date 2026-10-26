import type { AiModelRef } from '@/lib/ai-runtime-config';
import { recordAiRunStat } from '@/lib/ai-run-stats';
import { fetchWithAiUsage } from '@/lib/ai-usage-fetch';
import { CvOptimizationError } from './validation';
import { readCvAiStream } from './stream';
import { log } from '@/lib/logger';
import { providerCredential } from '@/lib/ai-provider-credentials';
import { getResolvedAiRuntime } from '@/lib/ai-runtime-store';

type CvAiCall = (ref: AiModelRef, system: string, user: string, temperature: number, signal: AbortSignal, mode: string, plan: string, onContent?: (content: string) => Promise<void>) => Promise<string>;
type Transport = {
  request: typeof fetchWithAiUsage;
  record: typeof recordAiRunStat;
  fallback: () => Promise<AiModelRef | undefined>;
  env: Record<string, string | undefined>;
  timeoutMs?: number;
};

export function createCvAiCaller(transport: Transport): CvAiCall {

  /** Shared transport for analysis, generation and repair. Timeout covers the body too. */
  const attempt: CvAiCall = async (ref, system, user, temperature, signal, mode, plan, onContent) => {
    const started = Date.now();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timeout = setTimeout(abort, transport.timeoutMs ?? 60_000);
    let inputTokens: number | undefined; let outputTokens: number | undefined;
    try {
      const key = providerCredential(ref.provider, transport.env);
      if (!key) throw new CvOptimizationError('AI_NOT_CONFIGURED');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let url: string; let body: Record<string, unknown>;
      if (ref.provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ref.model)}:${onContent ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${encodeURIComponent(key)}`;
        body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { temperature } };
      } else {
        url = { openai: 'https://api.openai.com/v1/chat/completions', deepseek: 'https://api.deepseek.com/v1/chat/completions', openrouter: 'https://openrouter.ai/api/v1/chat/completions' }[ref.provider];
        headers.Authorization = `Bearer ${key}`;
        let model = ref.model;
        if (ref.provider === 'openrouter') {
          model = model.replace(/^openrouter\/(?=.*\/)/, '');
          if (model.startsWith('gpt-')) model = `openai/${model}`;
          headers['HTTP-Referer'] = transport.env.NEXTAUTH_URL || 'https://matchply.com';
          headers['X-OpenRouter-Title'] = 'Matchply';
        }
        body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          ...(ref.provider === 'openrouter' ? { usage: { include: true } } : {}),
          ...(onContent ? {stream:true, ...(['openai', 'deepseek'].includes(ref.provider) ? {stream_options:{include_usage:true}} : {})} : {}),
          ...((ref.provider === 'openai' && /luna|^o\d|^gpt-[56]/i.test(model)) ? {} : { temperature }) };
      }
      const response = await transport.request(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal }, { functionKey: `optimize_cv:${mode}` });
      if (!response.ok) {
        await response.body?.cancel();
        throw new CvOptimizationError(`AI_HTTP_${response.status}`, response.status === 429 || response.status >= 500);
      }
      let result: unknown;
      if (onContent) {
        if (!response.body) throw new CvOptimizationError('AI_INCOMPLETE_RESPONSE', true);
        const stream = await readCvAiStream(response.body, ref.provider, onContent);
        result = stream.content; inputTokens = stream.inputTokens; outputTokens = stream.outputTokens;
      } else {
        const data = await response.json();
        inputTokens = data.usage?.prompt_tokens ?? data.usageMetadata?.promptTokenCount;
        outputTokens = data.usage?.completion_tokens ?? data.usageMetadata?.candidatesTokenCount;
        result = ref.provider === 'gemini'
          ? data.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('')
          : data.choices?.[0]?.message?.content;
        if (data.choices?.[0]?.finish_reason === 'length' || data.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new CvOptimizationError('AI_INCOMPLETE_RESPONSE', true);
      }
      if (typeof result !== 'string' || !result.trim()) throw new CvOptimizationError('AI_INCOMPLETE_RESPONSE', true);
      transport.record({ functionKey: `optimize_cv:${mode}`, ...ref, plan, success: true, latencyMs: Date.now()-started, inputTokens, outputTokens });
      return result.trim();
    } catch (error) {
      const failure = error instanceof CvOptimizationError ? error : new CvOptimizationError(signal.aborted ? 'AI_CANCELLED' : controller.signal.aborted ? 'AI_TIMEOUT' : error instanceof SyntaxError ? 'AI_INVALID_RESPONSE' : 'AI_NETWORK_ERROR', !signal.aborted);
      log({ event: 'cv_ai_request_failed', level: 'warn', provider: ref.provider, model: ref.model, phase: mode,
        errorCode: failure.code, retryable: failure.retryable, durationMs: Date.now() - started });
      transport.record({ functionKey: `optimize_cv:${mode}`, ...ref, plan, success: false, latencyMs: Date.now()-started, errorCode: failure.code });
      throw failure;
    } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
  };

  return async (ref, system, user, temperature, signal, mode, plan, onContent) => {
    try { return await attempt(ref, system, user, temperature, signal, mode, plan, onContent); }
    catch (error) {
      if (signal.aborted || !(error instanceof CvOptimizationError) || !error.code.startsWith('AI_') || ['AI_CANCELLED', 'AI_RESPONSE_TOO_LARGE'].includes(error.code)) throw error;
      const fallback = await transport.fallback().catch(() => undefined);
      if (!fallback || fallback.provider === ref.provider || !providerCredential(fallback.provider, transport.env)) throw error;
      log({ event: 'cv_ai_fallback_started', fromProvider: ref.provider, provider: fallback.provider, model: fallback.model, phase: mode, errorCode: error.code });
      await onContent?.(''); // Discard the failed provider's preview before any fallback text.
      return attempt(fallback, system, user, temperature, signal, mode, plan, onContent);
    }
  };
}

export const callCvAi = createCvAiCaller({ request: fetchWithAiUsage, record: recordAiRunStat,
  fallback: async () => (await getResolvedAiRuntime()).cvOptimizationFallback, env: process.env });
