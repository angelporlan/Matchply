import { parseAvatarImage } from './image-input';
import { PROFILE_PHOTO_LIMITS } from './profile-limits';

/** Only Google's known picture host; never follow user-controlled redirects. */
export function isGooglePhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^lh[3-6]\.googleusercontent\.com$/.test(url.hostname)
      && !url.username && !url.password && !url.port;
  } catch { return false; }
}

export async function fetchGooglePhoto(url: string) {
  if (!isGooglePhotoUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(url, { redirect: 'error', credentials: 'omit', headers: { Accept: 'image/jpeg' }, signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg') || Number(response.headers.get('content-length')) > PROFILE_PHOTO_LIMITS.maxBytes) return null;
    reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > PROFILE_PHOTO_LIMITS.maxBytes) return null;
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const photo = parseAvatarImage({ mime: 'image/jpeg', data: bytes.toString('base64') }, PROFILE_PHOTO_LIMITS);
    return { ...photo, bytes: bytes.toString('base64'), byteSize: bytes.length };
  } catch { return null; }
  finally { clearTimeout(timer); await reader?.cancel().catch(() => {}); }
}
