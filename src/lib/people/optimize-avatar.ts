import { PERSON_AVATAR_MAX_BYTES, PERSON_AVATAR_MAX_EDGE, PERSON_AVATAR_UPLOAD_MAX_BYTES } from './avatar-limits';
import type { PersonAvatarInput } from './types';

/** Same center crop, size and JPEG quality steps as LinkedIn capture. */
export async function optimizeAvatar(file: File): Promise<PersonAvatarInput> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('PEOPLE_PHOTO_FORMAT');
  if (!file.size || file.size > PERSON_AVATAR_UPLOAD_MAX_BYTES) throw new Error('PEOPLE_PHOTO_SIZE');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('PEOPLE_INVALID_AVATAR'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 16000000) throw new Error('PEOPLE_PHOTO_DIMENSIONS');
    const crop = Math.min(bitmap.width, bitmap.height), edge = Math.min(PERSON_AVATAR_MAX_EDGE, crop);
    const canvas = document.createElement('canvas'); canvas.width = edge; canvas.height = edge;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PEOPLE_INVALID_AVATAR');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, edge, edge);
    ctx.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, edge, edge);
    for (const quality of [0.82, 0.65, 0.45]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob?.type === 'image/jpeg' && blob.size <= PERSON_AVATAR_MAX_BYTES) {
        return { mime: 'image/jpeg', data: btoa(String.fromCharCode(...Array.from(new Uint8Array(await blob.arrayBuffer())))) };
      }
    }
    throw new Error('PEOPLE_INVALID_AVATAR');
  } finally { bitmap.close(); }
}
