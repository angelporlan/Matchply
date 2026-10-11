import { PERSON_AVATAR_MAX_BYTES, PERSON_AVATAR_MAX_EDGE, PERSON_AVATAR_UPLOAD_MAX_BYTES } from './avatar-limits';
import { optimizeAvatarImage } from '@/lib/avatar/optimize';

export async function optimizeAvatar(file: File) {
  try {
    return await optimizeAvatarImage(file, { maxBytes: PERSON_AVATAR_MAX_BYTES, maxEdge: PERSON_AVATAR_MAX_EDGE, uploadMaxBytes: PERSON_AVATAR_UPLOAD_MAX_BYTES });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PHOTO_INVALID';
    throw new Error(code === 'PHOTO_INVALID' ? 'PEOPLE_INVALID_AVATAR' : `PEOPLE_${code}`);
  }
}
