import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAvatarImage } from '@/lib/avatar/image-input';
import { PROFILE_PHOTO_LIMITS } from '@/lib/avatar/profile-limits';

test('profile photos accept bounded JPEGs and reject oversized, non-image and malformed inputs', () => {
  const bytes = readFileSync('scripts/fixtures/person-avatar.jpg');
  const input = { mime: 'image/jpeg', data: bytes.toString('base64') };
  const parsed = parseAvatarImage(input, PROFILE_PHOTO_LIMITS);
  assert.deepEqual(parsed.bytes, bytes);
  assert.equal(parsed.mime, 'image/jpeg');
  const frame = bytes.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(frame > 0);
  const large = Buffer.from(bytes);
  large.writeUInt16BE(768, frame + 7);
  assert.doesNotThrow(() => parseAvatarImage({ ...input, data: large.toString('base64') }, PROFILE_PHOTO_LIMITS));
  large.writeUInt16BE(769, frame + 7);
  for (const bad of [null, {}, { ...input, mime: 'image/svg+xml' }, { ...input, data: '<svg/>' }, { ...input, data: input.data + '=' }, { ...input, data: bytes.subarray(0, 30).toString('base64') }, { ...input, data: large.toString('base64') }, { ...input, data: Buffer.alloc(PROFILE_PHOTO_LIMITS.maxBytes + 1).toString('base64') }]) {
    assert.throws(() => parseAvatarImage(bad, PROFILE_PHOTO_LIMITS), /PHOTO_INVALID/);
  }
});
