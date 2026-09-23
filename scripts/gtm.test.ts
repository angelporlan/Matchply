import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createGtmRun,
  finishGtmRun,
} from '@/lib/gtm-runner';
import {
  GTM_STALE_RUN_MS,
  GtmWorkspaceError,
  readGtmFile,
  resolveGtmFile,
  scanGtmWorkspace,
  searchGtmWorkspace,
} from '@/lib/gtm-workspace';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'matchply-gtm-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'runs'), { recursive: true });
  await writeFile(path.join(root, 'README.md'), '# GTM\n', 'utf8');
  await writeFile(path.join(root, 'testers.md'), 'tester alpha\n', 'utf8');
  await writeFile(path.join(root, 'dm-borradores.md'), 'DM draft\n', 'utf8');
  await writeFile(path.join(root, 'objeciones.md'), 'objeción beta\n', 'utf8');
  return root;
}

test('GTM runs are unique, finalized outputs are discoverable, and canonical files stay separate', async () => {
  const root = await temporaryWorkspace();
  const now = new Date();
  const [first, second] = await Promise.all([
    createGtmRun({ root, botName: 'Captador', title: 'Primera entrega', now }),
    createGtmRun({ root, botName: 'Captador', title: 'Segunda entrega', now }),
  ]);

  assert.notEqual(first.manifest.runId, second.manifest.runId);
  assert.notEqual(first.runDirectory, second.runDirectory);
  await writeFile(path.join(first.outputDirectory, 'informe.md'), '# Primera\n\n- alpha\n', 'utf8');
  await writeFile(path.join(second.outputDirectory, 'informe.md'), '# Segunda\n\n- beta\n', 'utf8');
  const finished = await finishGtmRun({ root, runId: first.manifest.runId, status: 'completed', now });
  assert.equal(finished.manifest.outputs.length, 1);

  const snapshot = await scanGtmWorkspace(root);
  assert.equal(snapshot.canonical.length, 4);
  assert.equal(snapshot.runs.length, 2);
  assert.equal(snapshot.runs.find((run) => run.runId === first.manifest.runId)?.status, 'completed');
  assert.equal(snapshot.runs.find((run) => run.runId === second.manifest.runId)?.status, 'running');
  assert.equal(snapshot.runs.find((run) => run.runId === first.manifest.runId)?.outputs[0].path, 'outputs/informe.md');
});

test('stale runs become incomplete and search finds output content', async () => {
  const root = await temporaryWorkspace();
  const stale = await createGtmRun({
    root,
    botName: 'Aha',
    title: 'Informe de aha',
    now: new Date(Date.now() - GTM_STALE_RUN_MS - 1_000),
  });
  await writeFile(path.join(stale.outputDirectory, 'informe.md'), '# Hallazgo\n\nEl cierre rompe por el PDF.\n', 'utf8');

  const snapshot = await scanGtmWorkspace(root);
  assert.equal(snapshot.runs[0].status, 'incomplete');
  const results = await searchGtmWorkspace('PDF', root);
  assert.deepEqual(results.map((result) => result.runId), [stale.manifest.runId]);
  assert.equal(results[0].botName, 'Aha');
});

test('content reads reject traversal and ignore symlink outputs', async () => {
  const root = await temporaryWorkspace();
  const run = await createGtmRun({ root, botName: 'Auditor' });
  const outsideDirectory = await mkdtemp(path.join(os.tmpdir(), 'matchply-gtm-outside-'));
  temporaryRoots.push(outsideDirectory);
  const outside = path.join(outsideDirectory, 'secret.txt');
  await writeFile(outside, 'secret', 'utf8');
  await symlink(outside, path.join(run.outputDirectory, 'leak.txt'));

  const snapshot = await scanGtmWorkspace(root);
  assert.equal(snapshot.runs[0].outputs.some((file) => file.name === 'leak.txt'), false);
  await assert.rejects(
    () => resolveGtmFile({ source: 'canonical', file: '../gtm-outside-secret.txt' }, root),
    (error: unknown) => error instanceof GtmWorkspaceError && error.code === 'INVALID_REFERENCE',
  );
  await assert.rejects(
    () => readGtmFile({ source: 'run', runId: run.manifest.runId, file: 'outputs/leak.txt' }, root),
    (error: unknown) => error instanceof GtmWorkspaceError && error.code === 'FILE_NOT_FOUND',
  );
});
