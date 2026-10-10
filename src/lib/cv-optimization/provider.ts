import type { AiModelRef } from '@/lib/ai-runtime-config';
import { recordAiRunStat } from '@/lib/ai-run-stats';
import { CvOptimizationError } from './validation';
import { readCvAiStream } from './stream';

/** Shared transport for analysis, generation and repair. Timeout covers the body too. */
export async function callCvAi(ref: AiModelRef, system: string, user: string, temperature: number, signal: AbortSignal, mode: string, plan: string, onContent?: (content: string) => Promise<void>): Promise<string> {
  const started = Date.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 60_000);
  let inputTokens: number | undefined; let outputTokens: number | undefined;
  try {
    const envKey = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', deepseek: 'DEEPSEEK_API_KEY', openrouter: 'OPENROUTER_API_KEY' }[ref.provider];
    const key = process.env[envKey];
    if (!key || /mock|your_api_key/i.test(key)) throw new CvOptimizationError('AI_NOT_CONFIGURED');
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
        headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'https://matchply.com';
        headers['X-OpenRouter-Title'] = 'Matchply';
      }
      body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(onContent ? {stream:true, ...(ref.provider === 'openai' ? {stream_options:{include_usage:true}} : {})} : {}),
        ...((ref.provider === 'openai' && /luna|^o\d|^gpt-[56]/i.test(model)) ? {} : { temperature }) };
    }
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new CvOptimizationError(`AI_HTTP_${response.status}`, response.status === 429 || response.status >= 500);
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
    void recordAiRunStat({ functionKey: `optimize_cv:${mode}`, ...ref, plan, success: true, latencyMs: Date.now()-started, inputTokens, outputTokens });
    return result.trim();
  } catch (error) {
    const failure = error instanceof CvOptimizationError ? error : new CvOptimizationError(signal.aborted ? 'AI_CANCELLED' : 'AI_UNAVAILABLE', !signal.aborted);
    void recordAiRunStat({ functionKey: `optimize_cv:${mode}`, ...ref, plan, success: false, latencyMs: Date.now()-started, errorCode: failure.code });
    throw failure;
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
