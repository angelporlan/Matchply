import { createHash, randomBytes } from 'crypto';

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}
