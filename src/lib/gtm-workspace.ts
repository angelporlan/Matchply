import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { gtmExtension, gtmFileKind, isGtmPreviewable } from './gtm-format';
import {
  GTM_CANONICAL_FILES,
  type GtmContentRef,
  type GtmOutputFile,
  type GtmRunManifest,
  type GtmRunStatus,
  type GtmRunSummary,
  type GtmSearchResult,
  type GtmWorkspaceSnapshot,
} from './gtm-types';

export const DEFAULT_GTM_WORKSPACE_ROOT = path.resolve(process.cwd(), 'docs/gtm');
export const GTM_PREVIEW_MAX_BYTES = 1_000_000;
export const GTM_DOWNLOAD_MAX_BYTES = 25_000_000;
export const GTM_STALE_RUN_MS = 30 * 60 * 1000;

export class GtmWorkspaceError extends Error {
  readonly code: 'INVALID_REFERENCE' | 'FILE_NOT_FOUND' | 'WORKSPACE_ERROR';

  constructor(
    code: 'INVALID_REFERENCE' | 'FILE_NOT_FOUND' | 'WORKSPACE_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'GtmWorkspaceError';
    this.code = code;
  }
}

function rootPath(root?: string) {
  return path.resolve(root || DEFAULT_GTM_WORKSPACE_ROOT);
}

function toPosix(relativePath: string) {
  return relativePath.split(path.sep).join('/');
}

function isInside(root: string, candidate: string) {
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

export function normalizeGtmRelativePath(value: string) {
  if (!value || value.includes('\0')) {
    throw new GtmWorkspaceError('INVALID_REFERENCE', 'La referencia de archivo no es válida.');
  }
  const slashValue = value.replaceAll('\\', '/');
  if (slashValue.startsWith('/') || /^[A-Za-z]:\//.test(slashValue)) {
    throw new GtmWorkspaceError('INVALID_REFERENCE', 'Las rutas absolutas no están permitidas.');
  }
  const normalized = path.posix.normalize(slashValue);
  if (
    normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
  ) {
    throw new GtmWorkspaceError('INVALID_REFERENCE', 'La ruta solicitada sale del workspace GTM.');
  }
  return normalized;
}

async function directoryEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return [];
    throw error;
  }
}

async function rootRealPath(root: string) {
  try {
    return await realpath(root);
  } catch (error: any) {
    if (error?.code === 'ENOENT') return root;
    throw error;
  }
}

async function describeFile(rootReal: string, filePath: string, relativePath: string): Promise<GtmOutputFile | null> {
  let fileStat;
  try {
    fileStat = await lstat(filePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) return null;

  let fileRealPath: string;
  try {
    fileRealPath = await realpath(filePath);
  } catch {
    return null;
  }
  if (!isInside(rootReal, fileRealPath)) return null;

  const normalizedPath = toPosix(relativePath);
  return {
    path: normalizedPath,
    name: path.posix.basename(normalizedPath),
    extension: gtmExtension(normalizedPath),
    kind: gtmFileKind(normalizedPath),
    sizeBytes: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
  };
}

async function walkFiles(
  rootReal: string,
  directory: string,
  relativeDirectory: string,
): Promise<GtmOutputFile[]> {
  const files: GtmOutputFile[] = [];
  const entries = await directoryEntries(directory);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = relativeDirectory ? path.join(relativeDirectory, entry.name) : entry.name;
    let entryStat;
    try {
      entryStat = await lstat(fullPath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (entryStat.isSymbolicLink()) continue;
    if (entryStat.isDirectory()) {
      files.push(...await walkFiles(rootReal, fullPath, relativePath));
      continue;
    }
    if (!entryStat.isFile()) continue;
    const descriptor = await describeFile(rootReal, fullPath, relativePath);
    if (descriptor) files.push(descriptor);
  }
  return files;
}

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function fallbackBotName(runDirectoryName: string) {
  const parts = runDirectoryName.split('__');
  return parts[1] || 'Bot desconocido';
}

function manifestStatus(value: unknown): GtmRunManifest['status'] | null {
  return value === 'running' || value === 'completed' || value === 'failed' ? value : null;
}

async function runSummary(
  rootReal: string,
  root: string,
  dateKey: string,
  runDirectory: string,
  nowMs: number,
): Promise<GtmRunSummary> {
  const runDirectoryName = path.basename(runDirectory);
  const manifestPath = path.join(runDirectory, 'manifest.json');
  let raw: Record<string, unknown> = {};
  try {
    const manifestStat = await lstat(manifestPath);
    if (manifestStat.isFile() && !manifestStat.isSymbolicLink()) {
      const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
    }
  } catch {
    // An interrupted or malformed run remains visible as incomplete.
  }

  const startedAt = validIsoDate(raw.startedAt)
    ? raw.startedAt
    : (await lstat(runDirectory)).mtime.toISOString();
  const rawStatus = manifestStatus(raw.status);
  const stale = rawStatus === 'running'
    && nowMs - Date.parse(startedAt) > GTM_STALE_RUN_MS;
  const status: GtmRunStatus = stale
    ? 'incomplete'
    : rawStatus || 'incomplete';
  const outputs = await walkFiles(rootReal, path.join(runDirectory, 'outputs'), 'outputs');
  const directory = toPosix(path.relative(path.join(root, 'runs'), runDirectory));
  const botName = nullableString(raw.botName) || fallbackBotName(runDirectoryName);

  return {
    runId: nullableString(raw.runId) || runDirectoryName,
    directory,
    dateKey,
    botName,
    botSlug: nullableString(raw.botSlug) || botName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: nullableString(raw.title),
    status,
    startedAt,
    completedAt: validIsoDate(raw.completedAt) ? raw.completedAt : null,
    summary: nullableString(raw.summary),
    outputs,
  };
}

async function canonicalFiles(root: string, rootReal: string) {
  const files: GtmOutputFile[] = [];
  for (const fileName of GTM_CANONICAL_FILES) {
    const descriptor = await describeFile(rootReal, path.join(root, fileName), fileName);
    if (descriptor) files.push(descriptor);
  }
  return files;
}

async function runDirectories(root: string) {
  const runsRoot = path.join(root, 'runs');
  const candidates: Array<{ dateKey: string; directory: string }> = [];
  for (const dateEntry of await directoryEntries(runsRoot)) {
    const dateDirectory = path.join(runsRoot, dateEntry.name);
    let dateStat;
    try {
      dateStat = await lstat(dateDirectory);
    } catch (error: any) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (!dateStat.isDirectory() || dateStat.isSymbolicLink()) continue;
    for (const runEntry of await directoryEntries(dateDirectory)) {
      const runPath = path.join(dateDirectory, runEntry.name);
      let runStat;
      try {
        runStat = await lstat(runPath);
      } catch (error: any) {
        if (error?.code === 'ENOENT') continue;
        throw error;
      }
      if (runStat.isDirectory() && !runStat.isSymbolicLink()) {
        candidates.push({ dateKey: dateEntry.name, directory: runPath });
      }
    }
  }
  return candidates;
}

export async function scanGtmWorkspace(rootInput?: string): Promise<GtmWorkspaceSnapshot> {
  const root = rootPath(rootInput);
  const rootReal = await rootRealPath(root);
  const nowMs = Date.now();
  const runs: GtmRunSummary[] = [];
  for (const candidate of await runDirectories(root)) {
    runs.push(await runSummary(rootReal, root, candidate.dateKey, candidate.directory, nowMs));
  }
  runs.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const canonical = await canonicalFiles(root, rootReal);
  const bots = Array.from(new Set(runs.map((run) => run.botName))).sort((a, b) => a.localeCompare(b));
  return {
    canonical,
    runs,
    bots,
    generatedAt: new Date().toISOString(),
  };
}

function runDirectoryFromSummary(root: string, run: GtmRunSummary) {
  const relative = normalizeGtmRelativePath(run.directory);
  const runsRoot = path.join(root, 'runs');
  const directory = path.resolve(runsRoot, ...relative.split('/'));
  if (!isInside(runsRoot, directory)) {
    throw new GtmWorkspaceError('INVALID_REFERENCE', 'La ejecución solicitada no es válida.');
  }
  return directory;
}

export interface ResolvedGtmFile {
  ref: GtmContentRef;
  filePath: string;
  descriptor: GtmOutputFile;
  botName: string | null;
  title: string | null;
}

export async function resolveGtmFile(ref: GtmContentRef, rootInput?: string): Promise<ResolvedGtmFile> {
  const root = rootPath(rootInput);
  const rootReal = await rootRealPath(root);
  const snapshot = await scanGtmWorkspace(root);

  if (ref.source === 'canonical') {
    const file = normalizeGtmRelativePath(ref.file);
    if (!GTM_CANONICAL_FILES.includes(file as (typeof GTM_CANONICAL_FILES)[number])) {
      throw new GtmWorkspaceError('INVALID_REFERENCE', 'El archivo canónico solicitado no está permitido.');
    }
    const descriptor = snapshot.canonical.find((candidate) => candidate.path === file);
    if (!descriptor) throw new GtmWorkspaceError('FILE_NOT_FOUND', 'El archivo canónico no existe.');
    const filePath = path.resolve(root, ...file.split('/'));
    if (!isInside(root, filePath)) throw new GtmWorkspaceError('INVALID_REFERENCE', 'La ruta solicitada no es válida.');
    const fileRealPath = await realpath(filePath).catch(() => null);
    const fileStat = await lstat(filePath).catch(() => null);
    if (!fileRealPath || !isInside(rootReal, fileRealPath) || !fileStat?.isFile() || fileStat.isSymbolicLink()) {
      throw new GtmWorkspaceError('FILE_NOT_FOUND', 'El archivo canónico no existe.');
    }
    return { ref: { source: 'canonical', file }, filePath, descriptor, botName: null, title: null };
  }

  if (!ref.runId) throw new GtmWorkspaceError('INVALID_REFERENCE', 'Falta el identificador de la ejecución.');
  const run = snapshot.runs.find((candidate) => candidate.runId === ref.runId);
  if (!run) throw new GtmWorkspaceError('FILE_NOT_FOUND', 'La ejecución solicitada no existe.');
  const file = normalizeGtmRelativePath(ref.file);
  const descriptor = run.outputs.find((candidate) => candidate.path === file);
  if (!descriptor) throw new GtmWorkspaceError('FILE_NOT_FOUND', 'El archivo de la ejecución no existe.');
  const runDirectory = runDirectoryFromSummary(root, run);
  const filePath = path.resolve(runDirectory, ...file.split('/'));
  if (!isInside(runDirectory, filePath)) {
    throw new GtmWorkspaceError('INVALID_REFERENCE', 'La ruta del output no es válida.');
  }
  const fileRealPath = await realpath(filePath).catch(() => null);
  if (!fileRealPath || !isInside(rootReal, fileRealPath)) {
    throw new GtmWorkspaceError('INVALID_REFERENCE', 'El archivo está fuera del workspace GTM.');
  }
  const fileStat = await lstat(filePath).catch(() => null);
  if (!fileStat?.isFile() || fileStat.isSymbolicLink()) {
    throw new GtmWorkspaceError('FILE_NOT_FOUND', 'El archivo de la ejecución no existe.');
  }
  return { ref: { source: 'run', runId: ref.runId, file }, filePath, descriptor, botName: run.botName, title: run.title };
}

export async function readGtmFile(ref: GtmContentRef, rootInput?: string) {
  const resolved = await resolveGtmFile(ref, rootInput);
  const buffer = await readFile(resolved.filePath);
  return { ...resolved, buffer };
}

export async function searchGtmWorkspace(query: string, rootInput?: string): Promise<GtmSearchResult[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const snapshot = await scanGtmWorkspace(rootInput);
  const root = rootPath(rootInput);
  const results: GtmSearchResult[] = [];
  const seen = new Set<string>();

  const inspect = async (item: GtmOutputFile, ref: GtmContentRef, botName: string | null, title: string | null, fullPath: string) => {
    const key = `${ref.source}:${ref.runId || ''}:${ref.file}`;
    if (seen.has(key)) return;
    const nameMatch = `${item.name} ${item.path} ${botName || ''} ${title || ''}`.toLocaleLowerCase().includes(normalizedQuery);
    let contentMatch = false;
    if (!nameMatch && isGtmPreviewable(item.kind) && item.sizeBytes <= GTM_PREVIEW_MAX_BYTES) {
      try {
        contentMatch = (await readFile(fullPath, 'utf8')).toLocaleLowerCase().includes(normalizedQuery);
      } catch {
        contentMatch = false;
      }
    }
    if (nameMatch || contentMatch) {
      seen.add(key);
      results.push({ ...ref, botName, title, modifiedAt: item.modifiedAt });
    }
  };

  for (const item of snapshot.canonical) {
    await inspect(item, { source: 'canonical', file: item.path }, null, null, path.join(root, item.path));
  }
  for (const run of snapshot.runs) {
    const runDirectory = runDirectoryFromSummary(root, run);
    for (const item of run.outputs) {
      await inspect(item, { source: 'run', runId: run.runId, file: item.path }, run.botName, run.title, path.join(runDirectory, ...item.path.split('/')));
    }
  }
  results.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
  return results.slice(0, 300);
}
