import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers, people, personAvatars, personOffers } from '@/db/schema';
import { PeopleError, type PersonAvatarInput } from './types';
import { id, linkedinUrl } from './validation';

export const PERSON_AVATAR_MAX_BYTES = 48 * 1024;
export const PERSON_AVATAR_MAX_EDGE = 192;

/** Accept only the small JPEG produced by the extension's canvas, never URLs or SVG. */
export function avatarInput(input: unknown) {
  const value = input as PersonAvatarInput | null;
  if (!value || value.mime !== 'image/jpeg' || typeof value.data !== 'string' || value.data.length > Math.ceil(PERSON_AVATAR_MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) throw new PeopleError('PEOPLE_INVALID_AVATAR');
  const bytes = Buffer.from(value.data, 'base64');
  if (bytes.toString('base64') !== value.data || bytes.length < 12 || bytes.length > PERSON_AVATAR_MAX_BYTES || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw new PeopleError('PEOPLE_INVALID_AVATAR');
  let offset = 2, dimensions: { width: number; height: number } | null = null;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) throw new PeopleError('PEOPLE_INVALID_AVATAR');
    while (bytes[offset] === 0xff) offset++;
    if (offset + 3 > bytes.length) throw new PeopleError('PEOPLE_INVALID_AVATAR');
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new PeopleError('PEOPLE_INVALID_AVATAR');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) throw new PeopleError('PEOPLE_INVALID_AVATAR');
      dimensions = { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      break;
    }
    offset += length;
  }
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > PERSON_AVATAR_MAX_EDGE || dimensions.height > PERSON_AVATAR_MAX_EDGE) throw new PeopleError('PEOPLE_INVALID_AVATAR');
  return { bytes, mime: 'image/jpeg' as const, hash: createHash('sha256').update(bytes).digest('hex').slice(0, 24) };
}

export async function saveCapturedAvatar(userId: string, sourceJobId: string, profileUrl: unknown, input: unknown) {
  const url = linkedinUrl(profileUrl);
  if (!url) throw new PeopleError('PEOPLE_INVALID_LINKEDIN');
  const avatar = avatarInput(input);
  return db.transaction(async tx => {
    const [contact] = await tx.select({ id: people.id }).from(people)
      .where(and(eq(people.userId, userId), eq(people.linkedinUrl, url))).for('update').limit(1);
    if (!contact) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
    const [link] = await tx.select({ personId: personOffers.personId }).from(personOffers)
      .innerJoin(jobOffers, eq(jobOffers.id, personOffers.offerId))
      .where(and(eq(personOffers.userId, userId), eq(personOffers.personId, contact.id), eq(jobOffers.userId, userId), eq(jobOffers.externalSource, 'linkedin'), eq(jobOffers.externalId, sourceJobId))).for('key share').limit(1);
    if (!link) throw new PeopleError('PEOPLE_OFFER_NOT_FOUND', 404);
    await tx.insert(personAvatars).values({ personId: contact.id, userId, mime: avatar.mime, bytes: avatar.bytes.toString('base64'), byteSize: avatar.bytes.length })
      .onConflictDoUpdate({ target: personAvatars.personId, set: { mime: avatar.mime, bytes: avatar.bytes.toString('base64'), byteSize: avatar.bytes.length, updatedAt: new Date() } });
    // A photo is presentation data; it does not alter networking context or contact ordering.
    await tx.update(people).set({ avatarHash: avatar.hash }).where(and(eq(people.id, contact.id), eq(people.userId, userId)));
    return { personId: contact.id, avatarHash: avatar.hash };
  });
}

export async function getPersonAvatar(userId: string, personId: string) {
  const [row] = await db.select({ mime: personAvatars.mime, bytes: personAvatars.bytes, byteSize: personAvatars.byteSize, avatarHash: people.avatarHash })
    .from(personAvatars).innerJoin(people, and(eq(people.id, personAvatars.personId), eq(people.userId, personAvatars.userId)))
    .where(and(eq(personAvatars.personId, id(personId)), eq(personAvatars.userId, userId))).limit(1);
  return row || null;
}
