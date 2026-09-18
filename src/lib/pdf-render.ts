import path from 'path';
import { existsSync } from 'fs';
import { Worker } from 'worker_threads';
import { generatePdfBuffer } from '@/lib/pdf-engine';
import { log } from '@/lib/logger';

/**
 * PDF rendering entry point for request handlers.
 *
 * PDFKit is CPU-bound; running it on the Next.js main thread stalls every other
 * request while a CV renders. We dispatch to a small pool of `worker_threads`
 * running `dist/workers/pdf-worker.js` (built by `npm run build:workers`) and fall
 * back to in-process rendering when the bundle is missing or a worker dies.
 */

const POOL_SIZE = Math.max(0, Number(process.env.PDF_WORKER_POOL_SIZE ?? 2));
const JOB_TIMEOUT_MS = Math.max(5_000, Number(process.env.PDF_WORKER_TIMEOUT_MS || 30_000));
const MAX_QUEUE = Math.max(8, Number(process.env.PDF_WORKER_MAX_QUEUE || 64));
const WORKER_FILE = path.join(process.cwd(), 'dist/workers/pdf-worker.js');

type Job = {
  id: number;
  content: string;
  options: Record<string, unknown>;
  resolve: (buffer: Buffer) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
};

type PooledWorker = { worker: Worker; busy: Job | null };

const workers: PooledWorker[] = [];
const queue: Job[] = [];
let nextJobId = 1;
let workerDisabledReason: string | null = null;

function workersAvailable() {
  if (POOL_SIZE === 0) return false;
  if (workerDisabledReason) return false;
  if (!existsSync(WORKER_FILE)) {
    workerDisabledReason = `worker bundle not found at ${WORKER_FILE}`;
    log({ event: 'pdf_worker_disabled', level: 'warn', reason: workerDisabledReason });
    return false;
  }
  return true;
}

function failJob(job: Job, error: Error) {
  if (job.timer) clearTimeout(job.timer);
  job.reject(error);
}

function spawnWorker(): PooledWorker {
  const worker = new Worker(WORKER_FILE, {
    env: process.env as NodeJS.ProcessEnv,
    resourceLimits: { maxOldGenerationSizeMb: Number(process.env.PDF_WORKER_MAX_HEAP_MB || 256) },
  });
  const pooled: PooledWorker = { worker, busy: null };

  worker.on('message', (message: { id: number; ok: boolean; data?: Uint8Array; error?: string }) => {
    const job = pooled.busy;
    if (!job || job.id !== message.id) return;
    pooled.busy = null;
    if (job.timer) clearTimeout(job.timer);
    if (message.ok && message.data) {
      job.resolve(Buffer.from(message.data.buffer, message.data.byteOffset, message.data.byteLength));
    } else {
      job.reject(new Error(message.error || 'PDF worker failed'));
    }
    pump();
  });

  const onGone = (error?: Error) => {
    const index = workers.indexOf(pooled);
    if (index >= 0) workers.splice(index, 1);
    const job = pooled.busy;
    pooled.busy = null;
    if (job) {
      // Recover transparently: render this one in-process.
      if (job.timer) clearTimeout(job.timer);
      log({ event: 'pdf_worker_crashed', level: 'warn', error, fallback: 'in-process' });
      generatePdfBuffer(job.content, job.options).then(job.resolve, job.reject);
    }
    pump();
  };
  worker.on('error', (error) => onGone(error));
  worker.on('exit', (code) => {
    if (code !== 0) onGone(new Error(`pdf worker exited with code ${code}`));
    else onGone();
  });

  workers.push(pooled);
  return pooled;
}

function pump() {
  while (queue.length > 0) {
    let slot = workers.find((w) => !w.busy);
    if (!slot && workers.length < POOL_SIZE) slot = spawnWorker();
    if (!slot) return;

    const job = queue.shift()!;
    slot.busy = job;
    job.timer = setTimeout(() => {
      if (slot!.busy !== job) return;
      slot!.busy = null;
      log({ event: 'pdf_worker_timeout', level: 'error', timeoutMs: JOB_TIMEOUT_MS });
      // A stuck worker is terminated; 'exit' handler removes it from the pool.
      slot!.worker.terminate().catch(() => undefined);
      failJob(job, new Error('PDF render timed out'));
    }, JOB_TIMEOUT_MS);
    slot.worker.postMessage({ id: job.id, content: job.content, options: job.options });
  }
}

export function renderPdf(content: string, options: Record<string, unknown> = {}): Promise<Buffer> {
  if (!workersAvailable()) {
    return generatePdfBuffer(content, options);
  }
  if (queue.length >= MAX_QUEUE) {
    return Promise.reject(new Error('PDF renderer is busy; try again shortly'));
  }
  return new Promise<Buffer>((resolve, reject) => {
    queue.push({ id: nextJobId++, content, options, resolve, reject });
    pump();
  });
}

export function pdfRenderStats() {
  return {
    workers: workers.length,
    busy: workers.filter((w) => w.busy).length,
    queued: queue.length,
    disabledReason: workerDisabledReason,
  };
}
