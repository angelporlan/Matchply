/** Only enable installation once the real Chrome Web Store listing is configured. */
export function chromeExtensionStoreUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== 'https://chromewebstore.google.com'
      || url.username || url.password
      || !/^\/detail\/(?:[^/]+\/)?[a-p]{32}\/?$/.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}
