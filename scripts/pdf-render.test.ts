import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
  let now = 0;
  const timers: Array<{ at: number; callback: () => void; cleared: boolean }> = [];
  const workers: FakeWorker[] = [];
  class FakeWorker extends EventEmitter {
    message?: { id: number }; terminated = false;
    constructor() { super(); workers.push(this); }
    postMessage(message: { id: number }) { this.message = message; }
    async terminate() { this.terminated = true; this.emit('exit', 1); return 1; }
    finish() { this.emit('message', { id: this.message!.id, ok: true, data: Buffer.from('pdf'), pageBreaks: [420] }); }
  }
  const module = { exports: {} as typeof import('@/lib/pdf-render') };
  vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/pdf-render.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports, Buffer,
    Date: class extends Date { static now() { return now; } },
    process: { cwd: () => '/test', env: { PDF_WORKER_POOL_SIZE: '1', PDF_WORKER_TIMEOUT_MS: '5000', PDF_WORKER_MAX_QUEUE: '8' } },
    setTimeout(callback: () => void, delay: number) { const timer = { callback, at: now + delay, cleared: false }; timers.push(timer); return timer; },
    clearTimeout(timer: typeof timers[number]) { timer.cleared = true; },
    require(id: string) {
      if (id === 'path') return path;
      if (id === 'fs') return { existsSync: () => true };
      if (id === 'worker_threads') return { Worker: FakeWorker };
      if (id.endsWith('logger')) return { log() {} };
      if (id.endsWith('pdf-engine')) return { generatePdfBuffer: async () => ({ buffer: Buffer.from('fallback'), pageBreaks: [] }) };
      throw new Error(id);
    },
  });
  function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const timer = timers.filter(t => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!timer) break;
      now = timer.at; timer.cleared = true; timer.callback();
    }
    now = end;
  }
  return { ...module.exports, workers, advance };
}

test('PDF deadline includes queue wait and timed-out workers are never reused', async () => {
  const f = fixture();
  const a = f.renderPdf('a'); const failedA = assert.rejects(a, /timed out/);
  f.advance(1000);
  const b = f.renderPdf('b'); const failedB = assert.rejects(b, /timed out/);
  assert.equal(f.pdfRenderStats().queued, 1);
  f.advance(4000); await failedA;
  assert.equal(f.workers[0].terminated, true); assert.equal(f.workers.length, 2);
  f.workers[0].finish(); // Late data from an expired worker is ignored.
  f.advance(1000); await failedB;
  assert.equal(f.pdfRenderStats().queued, 0); assert.equal(f.pdfRenderStats().busy, 0);
  const retry = f.renderPdf('retry'); f.workers[2].finish();
  assert.equal((await retry).buffer.toString(), 'pdf');
});

test('PDF queue rejects overflow and worker crash preserves fallback and queue progress', async () => {
  const f = fixture(); const jobs = Array.from({ length: 9 }, () => f.renderPdf('document'));
  await assert.rejects(f.renderPdf('overflow'), /busy/);
  f.workers[0].emit('error', new Error('crash'));
  assert.equal((await jobs[0]).buffer.toString(), 'fallback');
  for (let i = 1; i < jobs.length; i++) { f.workers[1].finish(); await jobs[i]; }
  assert.equal(f.pdfRenderStats().queued, 0);
});

test('already expired queued PDFs never start even when timer callbacks are delayed', async () => {
  const f = fixture();
  const jobs = Array.from({ length: 5 }, () => f.renderPdf('document'));
  const failures = jobs.map(job => assert.rejects(job, /timed out/));
  f.advance(5000); await Promise.all(failures);
  assert.equal(f.workers.length, 1); assert.equal(f.pdfRenderStats().queued, 0);
});
