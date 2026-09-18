/**
 * worker_threads entry: renders PDFs off the Next.js event loop.
 * Bundled by `scripts/build-workers.mjs` into `dist/workers/pdf-worker.js`.
 */
import { parentPort } from 'worker_threads';
import { generatePdfBuffer } from '../lib/pdf-engine';

type RenderRequest = { id: number; content: string; options: Record<string, unknown> };

if (!parentPort) {
  throw new Error('pdf-worker must run inside a worker thread');
}

const port = parentPort;

port.on('message', async (message: RenderRequest) => {
  const { id, content, options } = message;
  try {
    const buffer = await generatePdfBuffer(content, options);
    // Copy into a standalone ArrayBuffer so it can be transferred (Buffer may share the pool).
    const data = new Uint8Array(buffer.byteLength);
    data.set(buffer);
    port.postMessage({ id, ok: true, data }, [data.buffer]);
  } catch (error) {
    port.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
