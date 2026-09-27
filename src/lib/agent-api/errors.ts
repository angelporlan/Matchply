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
