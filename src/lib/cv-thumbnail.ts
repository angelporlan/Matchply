const THUMB_CACHE = new Map<string, string>();
const THUMB_CACHE_MAX = 80;
const MAX_CONCURRENT = 2;

type InFlightTask = {
  key: string;
  promise: Promise<string>;
  subscribers: number;
  abort: () => void;
};

const IN_FLIGHT = new Map<string, InFlightTask>();
type Queued = { key: string; run: () => void };
const QUEUE: Queued[] = [];
let activeCount = 0;

function rememberThumbnail(key: string, dataUrl: string) {
  THUMB_CACHE.delete(key);
  THUMB_CACHE.set(key, dataUrl);
  while (THUMB_CACHE.size > THUMB_CACHE_MAX) {
    const oldest = THUMB_CACHE.keys().next().value;
    if (oldest === undefined) break;
    THUMB_CACHE.delete(oldest);
  }
}

export function cvThumbnailKey(cvId: string, version: string | number) {
  return `${cvId}:${version}`;
}

export function getCachedCvThumbnail(key: string) {
  return THUMB_CACHE.get(key);
}

function pumpQueue() {
  while (activeCount < MAX_CONCURRENT && QUEUE.length > 0) {
    const next = QUEUE.shift();
    if (!next) return;
    if (!IN_FLIGHT.has(next.key)) continue;
    next.run();
  }
}

export function renderCvThumbnail(
  cvId: string,
  version: string | number,
  width = 560,
  signal?: AbortSignal,
): Promise<string> {
  const key = cvThumbnailKey(cvId, version);
  const cached = THUMB_CACHE.get(key);
  if (cached) return Promise.resolve(cached);

  const existing = IN_FLIGHT.get(key);
  if (existing) {
    existing.subscribers += 1;
    return subscribe(existing, signal);
  }

  let aborted = false;
  let destroy: (() => void) | null = null;
  const task: InFlightTask = {
    key,
    subscribers: 1,
    abort: () => {
      aborted = true;
      destroy?.();
    },
    promise: Promise.resolve(''),
  };

  const render = async () => {
    const pdfjs = await import('pdfjs-dist');
    if (aborted) throw new DOMException('Aborted', 'AbortError');
    pdfjs.GlobalWorkerOptions.workerSrc = `/api/pdf-worker?v=${pdfjs.version}`;

    const loadingTask = pdfjs.getDocument({
      url: `/api/pdf?cvId=${encodeURIComponent(cvId)}&v=${encodeURIComponent(String(version))}`,
    });
    destroy = () => {
      void loadingTask.destroy();
    };
    if (aborted) {
      await loadingTask.destroy();
      throw new DOMException('Aborted', 'AbortError');
    }

    const doc = await loadingTask.promise;
    try {
      if (aborted) throw new DOMException('Aborted', 'AbortError');
      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / baseViewport.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D not available');
      const renderTask = page.render({ canvas, canvasContext: context, viewport });
      destroy = () => {
        renderTask.cancel();
        void loadingTask.destroy();
      };
      await renderTask.promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      rememberThumbnail(key, dataUrl);
      return dataUrl;
    } finally {
      doc.cleanup();
    }
  };

  const start = () => {
    activeCount += 1;
    task.promise = render()
      .finally(() => {
        IN_FLIGHT.delete(key);
        activeCount -= 1;
        pumpQueue();
      });
  };

  IN_FLIGHT.set(key, task);
  if (activeCount < MAX_CONCURRENT) {
    start();
  } else {
    QUEUE.push({ key, run: start });
  }

  return subscribe(task, signal);
}

function subscribe(task: InFlightTask, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const onAbort = () => {
      task.subscribers -= 1;
      if (task.subscribers <= 0) {
        const queuedIndex = QUEUE.findIndex((item) => item.key === task.key);
        if (queuedIndex >= 0) QUEUE.splice(queuedIndex, 1);
        task.abort();
        IN_FLIGHT.delete(task.key);
      }
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    task.promise.then(
      (value) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function __resetCvThumbnailsForTests() {
  THUMB_CACHE.clear();
  IN_FLIGHT.clear();
  QUEUE.length = 0;
  activeCount = 0;
}
