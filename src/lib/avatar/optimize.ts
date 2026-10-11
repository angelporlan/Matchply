import type { AvatarImageInput } from './image-input';

async function blobBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)));
  return btoa(binary);
}

/** Center-crop and strip metadata by drawing to a canvas, then compress. */
export async function optimizeAvatarImage(file: File, limits: { maxBytes: number; maxEdge: number; uploadMaxBytes: number }): Promise<AvatarImageInput> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('PHOTO_FORMAT');
  if (!file.size || file.size > limits.uploadMaxBytes) throw new Error('PHOTO_SIZE');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('PHOTO_INVALID'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 16000000) throw new Error('PHOTO_DIMENSIONS');
    const crop = Math.min(bitmap.width, bitmap.height), edge = Math.min(limits.maxEdge, crop);
    const canvas = document.createElement('canvas'); canvas.width = edge; canvas.height = edge;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PHOTO_INVALID');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, edge, edge);
    ctx.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, edge, edge);
    for (const quality of [0.82, 0.65, 0.45]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob?.type === 'image/jpeg' && blob.size <= limits.maxBytes) {
        return { mime: 'image/jpeg', data: await blobBase64(blob) };
      }
    }
    throw new Error('PHOTO_INVALID');
  } finally { bitmap.close(); }
}
