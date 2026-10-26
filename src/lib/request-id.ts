export function validRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(value) ? value : undefined;
}
