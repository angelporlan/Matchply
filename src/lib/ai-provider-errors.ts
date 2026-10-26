import { userErrorMessage } from '@/lib/user-errors';
/** Technical reasons stay on the server; the message is safe at every public boundary. */
export const AI_PUBLIC_ERROR = userErrorMessage('AI_UNAVAILABLE');

export class AiProviderError extends Error {
  readonly retryable: boolean;
  constructor(readonly code: string, readonly status?: number) {
    super(AI_PUBLIC_ERROR);
    this.name = 'AiProviderError';
    this.retryable = status === 408 || status === 429 || (status !== undefined && status >= 500) || ['AI_NETWORK_ERROR', 'AI_TIMEOUT'].includes(code);
  }
}

export function asAiProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof Error && /timed? out|timeout/i.test(error.message)) return new AiProviderError('AI_TIMEOUT');
  if (error instanceof SyntaxError) return new AiProviderError('AI_INVALID_RESPONSE');
  return new AiProviderError('AI_NETWORK_ERROR');
}

export function publicAiFailure(requestId?: string) {
  return { error: AI_PUBLIC_ERROR, code: 'AI_UNAVAILABLE', ...(requestId ? { requestId } : {}) };
}

/** Persisted jobs may predate the safe provider errors. Only error fields are replaced. */
export function publicAiJobResult(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = value as Record<string, unknown>;
  return { ...result,
    ...(Array.isArray(result.variants) ? { variants: result.variants.map(variant => {
      if (!variant || typeof variant !== 'object') return variant;
      return { ...variant, error: variant.error ? AI_PUBLIC_ERROR : null };
    }) } : {}),
    ...(Array.isArray(result.errors) ? { errors: result.errors.map(error => {
      if (!error || typeof error !== 'object') return error;
      return { ...error, message: error.code === 'outdated' ? 'Los datos han cambiado. Vuelve a calcular la afinidad.'
        : error.code === 'lookup' ? 'No se pudo leer esta oferta. Pega su descripción y vuelve a intentarlo.' : AI_PUBLIC_ERROR };
    }) } : {}),
  };
}
