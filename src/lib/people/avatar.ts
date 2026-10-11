import { parseAvatarImage } from '@/lib/avatar/image-input';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobOffers, people, personAvatars, personOffers } from '@/db/schema';
import { PeopleError } from './types';
import { id, linkedinUrl } from './validation';

import { PERSON_AVATAR_MAX_BYTES, PERSON_AVATAR_MAX_EDGE } from './avatar-limits';
export { PERSON_AVATAR_MAX_BYTES, PERSON_AVATAR_MAX_EDGE } from './avatar-limits';

/** Accept only the small JPEG produced by the upload or extension canvas. */
export function avatarInput(input: unknown) {
  try { return parseAvatarImage(input, { maxBytes: PERSON_AVATAR_MAX_BYTES, maxEdge: PERSON_AVATAR_MAX_EDGE }); }
  catch { throw new PeopleError('PEOPLE_INVALID_AVATAR'); }
}

type AvatarTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function writeAvatar(tx: AvatarTransaction, userId: string, personId: string, avatar: ReturnType<typeof avatarInput>, source: 'manual' | 'linkedin') {
  await tx.insert(personAvatars).values({ personId, userId, source, mime: avatar.mime, bytes: avatar.bytes.toString('base64'), byteSize: avatar.bytes.length })
    .onConflictDoUpdate({ target: personAvatars.personId, set: { source, mime: avatar.mime, bytes: avatar.bytes.toString('base64'), byteSize: avatar.bytes.length, updatedAt: new Date() } });
  // Photos do not alter networking context or contact ordering.
  await tx.update(people).set({ avatarHash: avatar.hash }).where(and(eq(people.id, personId), eq(people.userId, userId)));
  return { personId, avatarHash: avatar.hash };
}

export async function saveManualAvatar(userId: string, personId: string, input: unknown) {
  const avatar = avatarInput(input);
  return db.transaction(async tx => {
    const [contact] = await tx.select({ id: people.id }).from(people).where(and(eq(people.userId, userId), eq(people.id, id(personId)))).for('update').limit(1);
    if (!contact) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
    return writeAvatar(tx, userId, contact.id, avatar, 'manual');
  });
}

export async function saveCapturedAvatar(userId: string, sourceJobId: string, profileUrl: unknown, input: unknown) {
  const url = linkedinUrl(profileUrl);
  if (!url) throw new PeopleError('PEOPLE_INVALID_LINKEDIN');
  const avatar = avatarInput(input);
  return db.transaction(async tx => {
    const [contact] = await tx.select({ id: people.id, avatarHash: people.avatarHash }).from(people)
      .where(and(eq(people.userId, userId), eq(people.linkedinUrl, url))).for('update').limit(1);
    if (!contact) throw new PeopleError('PEOPLE_NOT_FOUND', 404);
    const [link] = await tx.select({ personId: personOffers.personId }).from(personOffers)
      .innerJoin(jobOffers, eq(jobOffers.id, personOffers.offerId))
      .where(and(eq(personOffers.userId, userId), eq(personOffers.personId, contact.id), eq(jobOffers.userId, userId), eq(jobOffers.externalSource, 'linkedin'), eq(jobOffers.externalId, sourceJobId))).for('key share').limit(1);
    if (!link) throw new PeopleError('PEOPLE_OFFER_NOT_FOUND', 404);
    const [previous] = await tx.select({ source: personAvatars.source }).from(personAvatars).where(eq(personAvatars.personId, contact.id)).limit(1);
    if (previous?.source === 'manual') return { personId: contact.id, avatarHash: contact.avatarHash };
    return writeAvatar(tx, userId, contact.id, avatar, 'linkedin');
  });
}

export async function getPersonAvatar(userId: string, personId: string) {
  const [row] = await db.select({ mime: personAvatars.mime, bytes: personAvatars.bytes, byteSize: personAvatars.byteSize, avatarHash: people.avatarHash })
    .from(personAvatars).innerJoin(people, and(eq(people.id, personAvatars.personId), eq(people.userId, personAvatars.userId)))
    .where(and(eq(personAvatars.personId, id(personId)), eq(personAvatars.userId, userId))).limit(1);
  return row || null;
}
