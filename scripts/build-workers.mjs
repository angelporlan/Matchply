// Bundles worker_threads entries (TypeScript) into plain CommonJS so the Next.js
// server can spawn them with `new Worker(path)` without touching the app bundle.
import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('dist/workers', { recursive: true });

await build({
  entryPoints: ['src/workers/pdf-worker.ts'],
  outfile: 'dist/workers/pdf-worker.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
  // pdfkit reads its AFM/data files relative to its own package; keep it external.
  external: ['pdfkit'],
});
