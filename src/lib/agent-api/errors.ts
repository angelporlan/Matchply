export class AgentApiError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AgentApiError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Quota payload has to travel beside the error, so this is not an AgentApiError. */
export class ResearchQuotaError extends Error {
  readonly status = 429;
  readonly code = 'QUOTA_EXCEEDED';

  constructor(readonly quota: unknown) {
    super('Has agotado las acciones de IA de este mes.');
    this.name = 'ResearchQuotaError';
  }
}
