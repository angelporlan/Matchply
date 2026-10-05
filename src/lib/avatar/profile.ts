import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { userAvatars, users } from '@/db/schema';
import { parseAvatarImage } from './image-input';
import { PROFILE_PHOTO_LIMITS } from './profile-limits';

/** Google seeds the photo only once; an atomic condition protects concurrent manual uploads. */
export async function seedGoogleProfilePhoto(userId: string, image: string | null | undefined) {
  if (image) {
    await db.update(users).set({ image }).where(and(eq(users.id, userId), isNull(users.image)));
  }
  const [user] = await db.select({ image: users.image, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

export async function saveProfilePhoto(userId: string, input: unknown) {
  const avatar = parseAvatarImage(input, PROFILE_PHOTO_LIMITS);
  const image = `/api/account/avatar?v=${avatar.hash}`;
  await db.transaction(async tx => {
    // Serialize account photo changes, including Google's conditional update.
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update').limit(1);
    if (!user) throw new Error('Unauthorized');
    await tx.insert(userAvatars).values({ userId, mime: avatar.mime, bytes: avatar.bytes.toString('base64'), byteSize: avatar.bytes.length, hash: avatar.hash })
      .onConflictDoUpdate({ target: userAvatars.userId, set: { mime: avatar.mime, bytes: avatar.bytes.toString('base64'), byteSize: avatar.bytes.length, hash: avatar.hash, updatedAt: new Date() } });
    await tx.update(users).set({ image }).where(eq(users.id, userId));
  });
  return { image };
}

/** Also reusable by a future server-side CV photo renderer. */
export async function getProfilePhoto(userId: string) {
  const [avatar] = await db.select({ mime: userAvatars.mime, bytes: userAvatars.bytes, byteSize: userAvatars.byteSize, hash: userAvatars.hash })
    .from(userAvatars).where(eq(userAvatars.userId, userId)).limit(1);
  return avatar || null;
}
