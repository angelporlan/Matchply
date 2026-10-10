import type { AiModelRef } from '@/lib/ai-runtime-config';
import { CvOptimizationError } from './validation';

/** Parse complete SSE events across arbitrary UTF-8/body boundaries. Never expose raw parser errors. */
export async function readCvAiStream(body: ReadableStream<Uint8Array>, provider: AiModelRef['provider'], onContent: (content: string) => Promise<void>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', dataLines: string[] = [], content = '', finished = false;
  let inputTokens: number | undefined, outputTokens: number | undefined;
  const dispatch = async () => {
    if (!dataLines.length) return;
    const data = dataLines.join('\n').trim(); dataLines = [];
    if (data === '[DONE]') return;
    let chunk;
    try { chunk = JSON.parse(data); } catch { throw new CvOptimizationError('AI_INVALID_STREAM', true); }
    if (chunk.error) throw new CvOptimizationError('AI_STREAM_ERROR', true);
    inputTokens = chunk.usage?.prompt_tokens ?? chunk.usageMetadata?.promptTokenCount ?? inputTokens;
    outputTokens = chunk.usage?.completion_tokens ?? chunk.usageMetadata?.candidatesTokenCount ?? outputTokens;
    const finish = provider === 'gemini' ? chunk.candidates?.[0]?.finishReason : chunk.choices?.[0]?.finish_reason;
    if (finish === 'length' || finish === 'MAX_TOKENS') throw new CvOptimizationError('AI_INCOMPLETE_RESPONSE', true);
    if (finish === 'stop' || finish === 'STOP') finished = true;
    const delta = provider === 'gemini'
      ? chunk.candidates?.[0]?.content?.parts?.filter((part: {thought?:boolean}) => !part.thought).map((part: {text?:string}) => part.text || '').join('')
      : chunk.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) {
      content += delta;
      if (content.length > 250_000) throw new CvOptimizationError('AI_RESPONSE_TOO_LARGE');
      await onContent(content);
    }
  };
  const line = async (value: string) => {
    value = value.replace(/\r$/, '');
    if (!value) await dispatch();
    else if (value.startsWith('data:')) dataLines.push(value.slice(5).replace(/^ /, ''));
  };
  try {
    while (true) {
      const next = await reader.read();
      buffer += decoder.decode(next.value, {stream:!next.done});
      if (buffer.length > 1_000_000) throw new CvOptimizationError('AI_RESPONSE_TOO_LARGE');
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) { const value = buffer.slice(0,end); buffer = buffer.slice(end+1); await line(value); }
      if (next.done) break;
    }
    if (buffer) await line(buffer);
    await dispatch();
    if (!finished || !content.trim()) throw new CvOptimizationError('AI_INCOMPLETE_RESPONSE', true);
    return {content:content.trim(), inputTokens, outputTokens};
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
