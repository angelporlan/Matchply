import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, cvPhotos, users } from '@/db/schema';
import { requireEditableCv } from '@/lib/cv-access';
import { UsageError } from '@/lib/usage';
import { parseAvatarImage } from '@/lib/avatar/image-input';
import { PROFILE_PHOTO_LIMITS } from '@/lib/avatar/profile-limits';
import { getProfilePhoto } from '@/lib/avatar/profile';
import { fetchGooglePhoto } from '@/lib/avatar/google-photo';
import type { CvPhotoState } from '@/lib/cv-photo-types';

export type CvPhoto = { mime: string; bytes: string; byteSize: number; hash: string; source: 'custom' | 'account' };
const remotePhotos = new Map<string, { photo: CvPhoto; until: number }>();

async function ownedCv(userId: string, cvId: string) {
  const [cv] = await db.select({ showPhoto: cvs.showPhoto }).from(cvs).where(and(eq(cvs.id, cvId), eq(cvs.userId, userId))).limit(1);
  if (!cv) throw new UsageError(404, 'CV_NOT_FOUND', 'Resume not found');
  return cv;
}

export async function resolveCvPhoto(userId: string, cvId: string): Promise<CvPhoto | null> {
  await ownedCv(userId, cvId);
  const [custom] = await db.select().from(cvPhotos).where(eq(cvPhotos.cvId, cvId)).limit(1);
  if (custom) return { ...custom, source: 'custom' };
  const profile = await getProfilePhoto(userId);
  if (profile) return { ...profile, source: 'account' };
  const [user] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.image) return null;
  const cached = remotePhotos.get(user.image);
  if (cached && cached.until > Date.now()) return cached.photo;
  const fetched = await fetchGooglePhoto(user.image);
  if (!fetched) return null;
  const photo: CvPhoto = { ...fetched, source: 'account' };
  if (remotePhotos.size >= 32) remotePhotos.delete(remotePhotos.keys().next().value!);
  remotePhotos.set(user.image, { photo, until: Date.now() + 5 * 60_000 });
  return photo;
}

export async function getCvPhotoState(userId: string, cvId: string): Promise<CvPhotoState> {
  const { showPhoto } = await ownedCv(userId, cvId);
  const photo = showPhoto ? await resolveCvPhoto(userId, cvId) : null;
  return { enabled: showPhoto, url: photo ? `/api/cv/${cvId}/photo?v=${photo.hash}` : null, source: photo?.source ?? null };
}

async function editable(tx: Parameters<typeof requireEditableCv>[0], userId: string, cvId: string) {
  const cv = await requireEditableCv(tx, userId, cvId);
  if (cv.pendingUsageOperationId) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'This resume is being generated');
}

export async function saveCvPhoto(userId: string, cvId: string, input: unknown) {
  const photo = parseAvatarImage(input, PROFILE_PHOTO_LIMITS);
  await db.transaction(async tx => {
    await editable(tx, userId, cvId);
    await tx.insert(cvPhotos).values({ cvId, mime: photo.mime, bytes: photo.bytes.toString('base64'), byteSize: photo.bytes.length, hash: photo.hash })
      .onConflictDoUpdate({ target: cvPhotos.cvId, set: { mime: photo.mime, bytes: photo.bytes.toString('base64'), byteSize: photo.bytes.length, hash: photo.hash, updatedAt: new Date() } });
    await tx.update(cvs).set({ showPhoto: true, updatedAt: new Date() }).where(eq(cvs.id, cvId));
  });
  return getCvPhotoState(userId, cvId);
}

export async function setCvPhotoEnabled(userId: string, cvId: string, enabled: unknown) {
  if (typeof enabled !== 'boolean') throw new UsageError(400, 'PHOTO_INVALID', 'Invalid photo option');
  if (enabled && !await resolveCvPhoto(userId, cvId)) throw new UsageError(422, 'PHOTO_MISSING', 'Add a photo first');
  await db.transaction(async tx => {
    await editable(tx, userId, cvId);
    await tx.update(cvs).set({ showPhoto: enabled, updatedAt: new Date() }).where(eq(cvs.id, cvId));
  });
  return getCvPhotoState(userId, cvId);
}

export async function resetCvPhoto(userId: string, cvId: string) {
  await db.transaction(async tx => {
    await editable(tx, userId, cvId);
    await tx.delete(cvPhotos).where(eq(cvPhotos.cvId, cvId));
    await tx.update(cvs).set({ updatedAt: new Date() }).where(eq(cvs.id, cvId));
  });
  return getCvPhotoState(userId, cvId);
}
