import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real browser module with a controlled PDF.js/canvas implementation.
function fixture() {
  const pending: Array<{ resolve: (doc: unknown) => void; reject: (error: Error) => void; destroyed: boolean }> = [];
  const pdfjs = {
    version: 'test', GlobalWorkerOptions: {},
    getDocument() {
      const entry = { resolve: (_doc: unknown) => {}, reject: (_error: Error) => {}, destroyed: false };
      const promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
      pending.push(entry);
      return { promise, destroy: async () => { entry.destroyed = true; entry.reject(new DOMException('Aborted', 'AbortError')); } };
    },
  };
  const module = { exports: {} as typeof import('@/lib/cv-thumbnail') };
  const source = ts.transpileModule(readFileSync('src/lib/cv-thumbnail.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, require: () => pdfjs, DOMException,
    document: { createElement: () => ({ getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,valid' }) },
  });
  const complete = (index: number) => pending[index].resolve({ getPage: async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 560 * scale, height: 792 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
  }) });
  return { ...module.exports, pending, complete };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('third thumbnail waits for a slot and all subscribers receive the rendered image', async () => {
  const f = fixture();
  const a = f.renderCvThumbnail('a', 1); const b = f.renderCvThumbnail('b', 1);
  let settled = false;
  const c = f.renderCvThumbnail('c', 1).then(value => { settled = true; return value; });
  const duplicate = f.renderCvThumbnail('c', 1);
  await tick(); assert.equal(f.pending.length, 2); assert.equal(settled, false);
  f.complete(0); await tick(); assert.equal(f.pending.length, 3); assert.equal(settled, false);
  f.complete(1); f.complete(2);
  for (const value of await Promise.all([a, b, c, duplicate])) assert.match(value, /^data:image/);
  assert.ok(f.pending.every(entry => entry.destroyed));
});

test('thumbnail cancellation is per subscriber, removes queued tasks, and permits retry after failure', async () => {
  const f = fixture(); const first = new AbortController(); const queued = new AbortController();
  const a = f.renderCvThumbnail('a', 1, 560, first.signal);
  const shared = f.renderCvThumbnail('a', 1);
  const b = f.renderCvThumbnail('b', 1);
  const c = f.renderCvThumbnail('c', 1, 560, queued.signal);
  const rejectedA = assert.rejects(a, { name: 'AbortError' });
  const rejectedC = assert.rejects(c, { name: 'AbortError' });
  first.abort(); queued.abort(); await tick();
  assert.equal(f.pending.length, 2); assert.equal(f.pending[0].destroyed, false);
  f.complete(0); f.pending[1].reject(new Error('bad PDF'));
  await Promise.all([rejectedA, rejectedC, shared, assert.rejects(b, /bad PDF/)]);
  const retry = f.renderCvThumbnail('b', 1); await tick(); f.complete(2);
  assert.match(await retry, /^data:image/);
  const version = f.renderCvThumbnail('a', 2); await tick(); f.complete(3); await version;
  assert.equal(f.pending.length, 4);
});

test('aborting all active subscribers releases resources without deleting a replacement task', async () => {
  const f = fixture(); const controller = new AbortController();
  const old = f.renderCvThumbnail('a', 1, 560, controller.signal);
  const oldRejected = assert.rejects(old, { name: 'AbortError' });
  const other = f.renderCvThumbnail('b', 1);
  await tick(); controller.abort();
  const replacement = f.renderCvThumbnail('a', 1);
  const duplicate = f.renderCvThumbnail('a', 1);
  await tick(); assert.equal(f.pending.length, 3); assert.equal(f.pending[0].destroyed, true);
  f.complete(1); f.complete(2);
  await Promise.all([oldRejected, other, replacement, duplicate]);
  assert.equal(f.pending.length, 3);
});
