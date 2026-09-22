import { mkdir, readdir, lstat, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { gtmExtension, gtmFileKind, slugifyGtmBot } from './gtm-format';
import type { GtmOutputFile, GtmRunManifest } from './gtm-types';

export const DEFAULT_GTM_WORKSPACE_ROOT = path.resolve(process.cwd(), 'docs/gtm');
const GTM_TIME_ZONE = 'Europe/Madrid';

export class GtmRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GtmRunnerError';
  }
}

function madridDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GTM_TIME_ZONE,
    calendar: 'iso8601',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    timeKey: `${value('hour')}-${value('minute')}-${value('second')}`,
  };
}

function workspaceRoot(root?: string) {
  return path.resolve(root || DEFAULT_GTM_WORKSPACE_ROOT);
}

function toOutputPath(relativePath: string) {
  return relativePath.split(path.sep).join('/');
}

async function listOutputFiles(outputDir: string): Promise<GtmOutputFile[]> {
  const files: GtmOutputFile[] = [];

  async function visit(directory: string, relativeDirectory: string) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relativePath = relativeDirectory ? path.join(relativeDirectory, entry.name) : entry.name;
      const fullPath = path.join(directory, entry.name);
      const entryStat = await lstat(fullPath);
      if (entryStat.isSymbolicLink()) continue;
      if (entryStat.isDirectory()) {
        await visit(fullPath, relativePath);
        continue;
      }
      if (!entryStat.isFile()) continue;

      files.push({
        path: toOutputPath(path.join('outputs', relativePath)),
        name: entry.name,
        extension: gtmExtension(entry.name),
        kind: gtmFileKind(entry.name),
        sizeBytes: entryStat.size,
        modifiedAt: entryStat.mtime.toISOString(),
      });
    }
  }

  await visit(outputDir, '');
  return files;
}

async function writeManifestAtomic(runDirectory: string, manifest: GtmRunManifest) {
  const manifestPath = path.join(runDirectory, 'manifest.json');
  const temporaryPath = path.join(runDirectory, `.manifest.${process.pid}.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, manifestPath);
}

export interface CreateGtmRunOptions {
  root?: string;
  botName: string;
  title?: string | null;
  summary?: string | null;
  now?: Date;
}

export interface CreatedGtmRun {
  manifest: GtmRunManifest;
  runDirectory: string;
  outputDirectory: string;
}

export async function createGtmRun(options: CreateGtmRunOptions): Promise<CreatedGtmRun> {
  const botName = options.botName.trim();
  if (!botName) throw new GtmRunnerError('Debes indicar el nombre del bot con --bot.');

  const now = options.now ?? new Date();
  const root = workspaceRoot(options.root);
  const { dateKey, timeKey } = madridDateParts(now);
  const dateDirectory = path.join(root, 'runs', dateKey);
  await mkdir(dateDirectory, { recursive: true });

  let runDirectory = '';
  let runId = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    runId = randomUUID();
    const directoryName = `${timeKey}__${slugifyGtmBot(botName)}__${runId.slice(0, 8)}`;
    const candidate = path.join(dateDirectory, directoryName);
    try {
      await mkdir(candidate);
      runDirectory = candidate;
      break;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }

  if (!runDirectory) throw new GtmRunnerError('No se pudo reservar una carpeta única para la ejecución.');

  const outputDirectory = path.join(runDirectory, 'outputs');
  await mkdir(outputDirectory);
  const manifest: GtmRunManifest = {
    schemaVersion: 1,
    runId,
    botName,
    botSlug: slugifyGtmBot(botName),
    title: options.title?.trim() || null,
    status: 'running',
    startedAt: now.toISOString(),
    completedAt: null,
    summary: options.summary?.trim() || null,
    outputs: [],
  };
  await writeManifestAtomic(runDirectory, manifest);
  return { manifest, runDirectory, outputDirectory };
}

async function findRunDirectory(root: string, runId: string) {
  const runsDirectory = path.join(root, 'runs');
  let dateEntries;
  try {
    dateEntries = await readdir(runsDirectory, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') throw new GtmRunnerError(`No existe la ejecución ${runId}.`);
    throw error;
  }

  for (const dateEntry of dateEntries) {
    if (!dateEntry.isDirectory()) continue;
    const dateDirectory = path.join(runsDirectory, dateEntry.name);
    const runEntries = await readdir(dateDirectory, { withFileTypes: true });
    for (const runEntry of runEntries) {
      if (!runEntry.isDirectory()) continue;
      const runDirectory = path.join(dateDirectory, runEntry.name);
      try {
        const raw = await readFile(path.join(runDirectory, 'manifest.json'), 'utf8');
        const manifest = JSON.parse(raw) as Partial<GtmRunManifest>;
        if (manifest.runId === runId) return runDirectory;
      } catch {
        // A damaged/incomplete run is left visible to the viewer but cannot be finalized by ID.
      }
    }
  }

  throw new GtmRunnerError(`No existe la ejecución ${runId}.`);
}

export interface FinishGtmRunOptions {
  root?: string;
  runId: string;
  status: 'completed' | 'failed';
  summary?: string | null;
  now?: Date;
}

export async function finishGtmRun(options: FinishGtmRunOptions) {
  if (!options.runId.trim()) throw new GtmRunnerError('Debes indicar el runId con --run.');
  const root = workspaceRoot(options.root);
  const runDirectory = await findRunDirectory(root, options.runId.trim());
  const manifestPath = path.join(runDirectory, 'manifest.json');
  let manifest: GtmRunManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GtmRunManifest;
  } catch {
    throw new GtmRunnerError(`El manifiesto de ${options.runId} no es válido.`);
  }

  if (manifest.runId !== options.runId.trim()) {
    throw new GtmRunnerError(`El manifiesto de ${options.runId} no coincide con su carpeta.`);
  }

  const updated: GtmRunManifest = {
    ...manifest,
    status: options.status,
    completedAt: (options.now ?? new Date()).toISOString(),
    summary: options.summary === undefined ? manifest.summary : options.summary?.trim() || null,
    outputs: await listOutputFiles(path.join(runDirectory, 'outputs')),
  };
  await writeManifestAtomic(runDirectory, updated);
  return { manifest: updated, runDirectory, outputDirectory: path.join(runDirectory, 'outputs') };
}
