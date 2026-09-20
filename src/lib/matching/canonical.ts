import { createHash } from 'crypto';

export function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, normalize(value)]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function evidenceHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function normalizedEvidenceText(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}
