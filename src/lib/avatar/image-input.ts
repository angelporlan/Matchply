import { createHash } from 'node:crypto';

export type AvatarImageInput = { mime: 'image/jpeg'; data: string };

/** Validate bounded JPEG data before storing it. */
export function parseAvatarImage(input: unknown, limits: { maxBytes: number; maxEdge: number }) {
  const value = input as AvatarImageInput | null;
  if (!value || value.mime !== 'image/jpeg' || typeof value.data !== 'string' || value.data.length > Math.ceil(limits.maxBytes / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) throw new Error('PHOTO_INVALID');
  const bytes = Buffer.from(value.data, 'base64');
  if (bytes.toString('base64') !== value.data || bytes.length < 12 || bytes.length > limits.maxBytes || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw new Error('PHOTO_INVALID');
  let offset = 2, dimensions: { width: number; height: number } | null = null;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('PHOTO_INVALID');
    while (bytes[offset] === 0xff) offset++;
    if (offset + 3 > bytes.length) throw new Error('PHOTO_INVALID');
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error('PHOTO_INVALID');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) throw new Error('PHOTO_INVALID');
      dimensions = { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      break;
    }
    offset += length;
  }
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > limits.maxEdge || dimensions.height > limits.maxEdge) throw new Error('PHOTO_INVALID');
  return { bytes, mime: 'image/jpeg' as const, hash: createHash('sha256').update(bytes).digest('hex').slice(0, 24) };
}
