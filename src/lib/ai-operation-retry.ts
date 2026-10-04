/** A lost response can hide a committed result. Keep its identity until the server
 * explicitly confirms that the operation was released without a usable result.
 * The next user click may then create a new operation; this never starts work itself. */
export function shouldResetAiOperation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  const nested = response.error && typeof response.error === 'object' ? response.error as Record<string, unknown> : {};
  const code = response.code ?? nested.code;
  return typeof code === 'string' && code.toUpperCase() === 'OPERATION_RELEASED';
}
