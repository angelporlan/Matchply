import { createHash } from 'node:crypto';

export const COMPANY_ICON_MAX_BYTES = 8 * 1024;
export const COMPANY_ICON_ALLOWED_MIMES = [
  'image/png',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/jpeg',
] as const;

export type CompanyIconMime = (typeof COMPANY_ICON_ALLOWED_MIMES)[number];

export function hashIconBytes(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

export function detectIconMime(bytes: Buffer): CompanyIconMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

export function assertCompanyIcon(bytes: Buffer, mime?: string | null) {
  if (bytes.length === 0) {
    throw new Error('COMPANY_ICON_EMPTY');
  }
  if (bytes.length > COMPANY_ICON_MAX_BYTES) {
    throw new Error('COMPANY_ICON_TOO_LARGE');
  }
  const detected = detectIconMime(bytes);
  const resolved = detected || (COMPANY_ICON_ALLOWED_MIMES.includes(mime as CompanyIconMime) ? mime as CompanyIconMime : null);
  if (!resolved) {
    throw new Error('COMPANY_ICON_UNSUPPORTED');
  }
  return resolved;
}
