const THUMB_CACHE = new Map<string, string>();
const PENDING: Array<() => void> = [];
const MAX_CONCURRENT = 2;
let activeCount = 0;

export function cvThumbnailKey(cvId: string, version: string | number) {
  return `${cvId}:${version}`;
}

export function getCachedCvThumbnail(key: string) {
  return THUMB_CACHE.get(key);
}

export function renderCvThumbnail(
  cvId: string,
  version: string | number,
  width = 560,
): Promise<string> {
  const key = cvThumbnailKey(cvId, version);
  const cached = THUMB_CACHE.get(key);
  if (cached) return Promise.resolve(cached);

  return new Promise<string>((resolve, reject) => {
    const run = () => {
      activeCount += 1;
      render()
        .then(resolve, reject)
        .finally(() => {
          activeCount -= 1;
          PENDING.shift()?.();
        });
    };

    const render = async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `/api/pdf-worker?v=${pdfjs.version}`;

      const doc = await pdfjs.getDocument({
        url: `/api/pdf?cvId=${encodeURIComponent(cvId)}&v=${encodeURIComponent(String(version))}`,
      }).promise;

      try {
        const page = await doc.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / baseViewport.width });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D not available');

        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        THUMB_CACHE.set(key, dataUrl);
        return dataUrl;
      } finally {
        doc.cleanup();
      }
    };

    if (activeCount < MAX_CONCURRENT) {
      run();
    } else {
      PENDING.push(run);
    }
  });
}
