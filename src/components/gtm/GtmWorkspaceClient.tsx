'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FolderClock,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import GtmMarkdownPreview from './GtmMarkdownPreview';
import type {
  GtmContentRef,
  GtmFileKind,
  GtmOutputFile,
  GtmRunStatus,
  GtmRunSummary,
  GtmSearchResult,
  GtmWorkspaceSnapshot,
} from '@/lib/gtm-types';

type FileFilter = 'all' | GtmFileKind;
type StatusFilter = 'all' | GtmRunStatus;

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading'; ref: GtmContentRef }
  | {
      status: 'ready';
      ref: GtmContentRef;
      kind: GtmFileKind;
      previewable: boolean;
      content?: string;
      sizeBytes: number;
      modifiedAt: string;
      botName: string | null;
      title: string | null;
    }
  | { status: 'error'; ref: GtmContentRef; message: string };

function refKey(ref: GtmContentRef) {
  return `${ref.source}:${ref.runId || ''}:${ref.file}`;
}

function outputRef(run: GtmRunSummary, output: GtmOutputFile): GtmContentRef {
  return { source: 'run', runId: run.runId, file: output.path };
}

function contentUrl(ref: GtmContentRef, download = false) {
  const params = new URLSearchParams({ source: ref.source, file: ref.file });
  if (ref.runId) params.set('runId', ref.runId);
  if (download) params.set('download', '1');
  return `/api/gtm/content?${params.toString()}`;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
      ...options,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateKey(value: string) {
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeZone: 'Europe/Madrid' }).format(new Date(`${value}T12:00:00+01:00`));
  } catch {
    return value;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(kind: GtmFileKind) {
  return { markdown: 'Markdown', json: 'JSON', text: 'Texto', binary: 'Archivo' }[kind];
}

function statusLabel(status: GtmRunStatus) {
  return {
    running: 'En curso',
    completed: 'Completada',
    failed: 'Fallida',
    incomplete: 'Incompleta',
  }[status];
}

function statusClass(status: GtmRunStatus) {
  return {
    running: 'bg-info-surface text-info-text',
    completed: 'bg-success-surface text-success-text',
    failed: 'bg-danger-surface text-danger-text',
    incomplete: 'bg-warning-surface text-warning-text',
  }[status];
}

function statusIcon(status: GtmRunStatus) {
  if (status === 'completed') return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === 'failed') return <X className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === 'incomplete') return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />;
}

function defaultSelection(snapshot: GtmWorkspaceSnapshot): GtmContentRef | null {
  const run = snapshot.runs.find((candidate) => candidate.outputs.length > 0);
  if (run) return outputRef(run, run.outputs[0]);
  const canonical = snapshot.canonical[0];
  return canonical ? { source: 'canonical', file: canonical.path } : null;
}

function hasDate(run: GtmRunSummary, dateFrom: string, dateTo: string) {
  if (dateFrom && run.dateKey < dateFrom) return false;
  if (dateTo && run.dateKey > dateTo) return false;
  return true;
}

export default function GtmWorkspaceClient({ initialSnapshot }: { initialSnapshot: GtmWorkspaceSnapshot }) {
  const [botFilter, setBotFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GtmSearchResult[] | null>(null);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [selected, setSelected] = useState<GtmContentRef | null>(() => defaultSelection(initialSnapshot));
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearchState('idle');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState('loading');
      try {
        const response = await fetch(`/api/gtm/search?q=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('No se pudo buscar.');
        const payload = await response.json() as { results: GtmSearchResult[] };
        setSearchResults(payload.results);
        setSearchState('idle');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSearchState('error');
        setSearchResults([]);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!selected) {
      setPreview({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setPreview({ status: 'loading', ref: selected });
    fetch(contentUrl(selected), { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el archivo.');
        return payload as Omit<Extract<PreviewState, { status: 'ready' }>, 'status' | 'ref'>;
      })
      .then((payload) => setPreview({ status: 'ready', ref: selected, ...payload }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPreview({ status: 'error', ref: selected, message: error instanceof Error ? error.message : 'No se pudo cargar el archivo.' });
      });
    return () => controller.abort();
  }, [selected]);

  const searchKeys = useMemo(() => new Set((searchResults || []).map(refKey)), [searchResults]);
  const matchesSearch = (ref: GtmContentRef) => !searchResults || searchKeys.has(refKey(ref));
  const matchesFile = (output: GtmOutputFile) => fileFilter === 'all' || output.kind === fileFilter;

  const filteredCanonical = useMemo(
    () => initialSnapshot.canonical.filter((file) => matchesFile(file) && matchesSearch({ source: 'canonical', file: file.path })),
    [fileFilter, initialSnapshot.canonical, searchResults], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filteredRuns = useMemo(() => initialSnapshot.runs
    .filter((run) => (botFilter === 'all' || run.botName === botFilter)
      && (statusFilter === 'all' || run.status === statusFilter)
      && hasDate(run, dateFrom, dateTo))
    .map((run) => ({
      ...run,
      outputs: run.outputs.filter((file) => matchesFile(file) && matchesSearch(outputRef(run, file))),
    }))
    .filter((run) => run.outputs.length > 0 || (fileFilter === 'all' && !query.trim())),
    [botFilter, dateFrom, dateTo, fileFilter, initialSnapshot.runs, query, searchResults, statusFilter], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const groupedRuns = useMemo<Array<[string, GtmRunSummary[]]>>(() => {
    const groups = new Map<string, GtmRunSummary[]>();
    for (const run of filteredRuns) {
      const current = groups.get(run.dateKey) || [];
      current.push(run);
      groups.set(run.dateKey, current);
    }
    return Array.from(groups.entries());
  }, [filteredRuns]);

  const totalOutputs = initialSnapshot.runs.reduce((total, run) => total + run.outputs.length, 0);
  const clearFilters = () => {
    setBotFilter('all');
    setStatusFilter('all');
    setFileFilter('all');
    setDateFrom('');
    setDateTo('');
    setQuery('');
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-[12px] border border-subtle bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Canónicos</p>
          <p className="mt-2 text-2xl font-display font-semibold">{initialSnapshot.canonical.length}</p>
          <p className="mt-1 text-xs text-text-muted">Documentos actuales de GTM</p>
        </div>
        <div className="rounded-[12px] border border-subtle bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Ejecuciones</p>
          <p className="mt-2 text-2xl font-display font-semibold">{initialSnapshot.runs.length}</p>
          <p className="mt-1 text-xs text-text-muted">{initialSnapshot.bots.length} bots detectados</p>
        </div>
        <div className="rounded-[12px] border border-subtle bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Outputs</p>
          <p className="mt-2 text-2xl font-display font-semibold">{totalOutputs}</p>
          <p className="mt-1 text-xs text-text-muted">Último escaneo {formatDate(initialSnapshot.generatedAt)}</p>
        </div>
      </section>

      <section className="grid lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] gap-6 items-start">
        <aside className="rounded-[12px] border border-subtle bg-surface overflow-hidden">
          <div className="p-4 border-b border-subtle space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold">Explorar GTM</h2>
                <p className="text-xs text-text-muted mt-1">Canónico e histórico separados</p>
              </div>
              <button type="button" onClick={() => window.location.reload()} className="p-2 rounded-[8px] border border-subtle text-text-muted hover:text-text hover:bg-surface-muted" aria-label="Actualizar GTM">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <label className="block">
              <span className="sr-only">Buscar por nombre o contenido</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre o contenido" className="w-full rounded-[8px] border border-control bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-focus" />
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-text-muted">
                <span className="mb-1 block">Bot</span>
                <select value={botFilter} onChange={(event) => setBotFilter(event.target.value)} className="w-full rounded-[8px] border border-control bg-surface px-2 py-2 text-sm text-text">
                  <option value="all">Todos</option>
                  {initialSnapshot.bots.map((bot) => <option key={bot} value={bot}>{bot}</option>)}
                </select>
              </label>
              <label className="text-xs text-text-muted">
                <span className="mb-1 block">Estado</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="w-full rounded-[8px] border border-control bg-surface px-2 py-2 text-sm text-text">
                  <option value="all">Todos</option>
                  <option value="completed">Completadas</option>
                  <option value="running">En curso</option>
                  <option value="incomplete">Incompletas</option>
                  <option value="failed">Fallidas</option>
                </select>
              </label>
              <label className="text-xs text-text-muted">
                <span className="mb-1 block">Tipo</span>
                <select value={fileFilter} onChange={(event) => setFileFilter(event.target.value as FileFilter)} className="w-full rounded-[8px] border border-control bg-surface px-2 py-2 text-sm text-text">
                  <option value="all">Todos</option>
                  <option value="markdown">Markdown</option>
                  <option value="json">JSON</option>
                  <option value="text">Texto</option>
                  <option value="binary">Archivo</option>
                </select>
              </label>
              <button type="button" onClick={clearFilters} className="self-end rounded-[8px] border border-subtle px-2 py-2 text-xs font-semibold text-text-muted hover:bg-surface-muted hover:text-text">Limpiar filtros</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-text-muted">
                <span className="mb-1 block">Desde</span>
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-[8px] border border-control bg-surface px-2 py-2 text-sm text-text" />
              </label>
              <label className="text-xs text-text-muted">
                <span className="mb-1 block">Hasta</span>
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-[8px] border border-control bg-surface px-2 py-2 text-sm text-text" />
              </label>
            </div>
            {searchState === 'loading' && <p className="text-xs text-text-muted" aria-live="polite">Buscando en el contenido…</p>}
            {searchState === 'error' && <p className="text-xs text-danger-text" aria-live="polite">No se pudo completar la búsqueda.</p>}
            {query.trim() && searchState === 'idle' && <p className="text-xs text-text-muted" aria-live="polite">{searchResults?.length || 0} coincidencias</p>}
          </div>

          <div className="max-h-[calc(100vh-330px)] min-h-[420px] overflow-y-auto p-3 space-y-5">
            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Canónico / aprobado</h3>
                <span className="text-xs text-text-muted">{filteredCanonical.length}</span>
              </div>
              <div className="space-y-1">
                {filteredCanonical.map((file) => {
                  const ref = { source: 'canonical' as const, file: file.path };
                  const active = selected && refKey(selected) === refKey(ref);
                  return (
                    <button key={file.path} type="button" onClick={() => setSelected(ref)} className={`w-full rounded-[8px] border px-3 py-2.5 text-left transition-colors ${active ? 'border-control bg-surface-muted' : 'border-transparent hover:border-subtle hover:bg-surface-muted/60'}`}>
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-success-text" aria-hidden="true" />
                        <span className="truncate text-sm font-semibold">{file.name}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2 pl-6 text-[11px] text-text-muted"><span>{kindLabel(file.kind)}</span><span>·</span><span>{formatDate(file.modifiedAt)}</span></span>
                    </button>
                  );
                })}
                {!filteredCanonical.length && <p className="px-1 text-xs text-text-muted">No hay documentos que coincidan.</p>}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Histórico de ejecuciones</h3>
                <span className="text-xs text-text-muted">{filteredRuns.length}</span>
              </div>
              <div className="space-y-4">
                {groupedRuns.map(([dateKey, runs]) => (
                  <div key={dateKey} className="space-y-2">
                    <p className="px-1 text-xs font-semibold text-text-muted capitalize">{formatDateKey(dateKey)}</p>
                    {runs.map((run) => (
                      <div key={run.runId} className="rounded-[8px] border border-subtle bg-canvas/40 overflow-hidden">
                        <div className="px-3 py-2.5 border-b border-subtle">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{run.botName}</p>
                              <p className="mt-0.5 truncate text-xs text-text-muted">{run.title || 'Ejecución GTM'} · {formatDate(run.startedAt)}</p>
                            </div>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(run.status)}`}>
                              {statusIcon(run.status)}{statusLabel(run.status)}
                            </span>
                          </div>
                          {run.summary && <p className="mt-2 line-clamp-2 text-xs text-text-muted">{run.summary}</p>}
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          {run.outputs.map((file) => {
                            const ref = outputRef(run, file);
                            const active = selected && refKey(selected) === refKey(ref);
                            return (
                              <button key={file.path} type="button" onClick={() => setSelected(ref)} className={`w-full rounded-[6px] px-2 py-2 text-left transition-colors ${active ? 'bg-surface-muted' : 'hover:bg-surface-muted/70'}`}>
                                <span className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-ai-text" aria-hidden="true" />
                                  <span className="truncate text-xs font-semibold">{file.name}</span>
                                  <span className="ml-auto shrink-0 text-[10px] text-text-muted">{kindLabel(file.kind)}</span>
                                </span>
                              </button>
                            );
                          })}
                          {!run.outputs.length && <p className="px-2 py-2 text-xs text-text-muted">Sin outputs todavía.</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {!filteredRuns.length && <p className="px-1 text-xs text-text-muted">No hay ejecuciones que coincidan con los filtros.</p>}
              </div>
            </section>
          </div>
        </aside>

        <article className="min-h-[620px] rounded-[12px] border border-subtle bg-surface overflow-hidden">
          {!selected && (
            <div className="flex min-h-[620px] flex-col items-center justify-center gap-3 p-8 text-center">
              <FolderClock className="h-10 w-10 text-text-muted" aria-hidden="true" />
              <h2 className="font-display text-lg font-semibold">Aún no hay archivos GTM</h2>
              <p className="max-w-md text-sm text-text-muted">Inicia una ejecución con <code className="font-mono">npm run gtm:run -- start --bot &quot;Nombre&quot;</code> y selecciona el output cuando el bot lo haya exportado.</p>
            </div>
          )}
          {selected && preview.status === 'loading' && (
            <div className="flex min-h-[620px] items-center justify-center text-sm text-text-muted">Cargando contenido…</div>
          )}
          {selected && preview.status === 'error' && (
            <div className="flex min-h-[620px] flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-danger-text" aria-hidden="true" />
              <h2 className="font-display text-lg font-semibold">No se pudo abrir el archivo</h2>
              <p className="text-sm text-text-muted">{preview.message}</p>
            </div>
          )}
          {selected && preview.status === 'ready' && (
            <>
              <header className="flex flex-col gap-4 border-b border-subtle p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${preview.ref.source === 'canonical' ? 'bg-success-surface text-success-text' : 'bg-ai-surface text-ai-text'}`}>
                      {preview.ref.source === 'canonical' ? 'Canónico / aprobado' : 'Histórico de ejecución'}
                    </span>
                    <span className="text-xs text-text-muted">{kindLabel(preview.kind)} · {formatBytes(preview.sizeBytes)}</span>
                  </div>
                  <h2 className="mt-3 truncate font-display text-xl font-semibold" title={preview.ref.file}>{preview.ref.file.replace(/^outputs\//, '')}</h2>
                  <p className="mt-1 text-xs text-text-muted">
                    {preview.botName ? `${preview.botName}${preview.title ? ` · ${preview.title}` : ''} · ` : ''}
                    Actualizado {formatDate(preview.modifiedAt)}
                  </p>
                </div>
                <a href={contentUrl(preview.ref, true)} className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-[8px] border border-control px-3 py-2 text-sm font-semibold text-text hover:bg-surface-muted">
                  <Download className="h-4 w-4" aria-hidden="true" /> Descargar
                </a>
              </header>
              <div className="p-5">
                {preview.previewable && preview.content !== undefined ? (
                  <GtmMarkdownPreview content={preview.content} kind={preview.kind as 'markdown' | 'json' | 'text'} />
                ) : (
                  <div className="rounded-[8px] border border-subtle bg-surface-muted p-5 text-sm text-text-muted">
                    Este tipo de archivo no se ejecuta ni se previsualiza por seguridad. Puedes descargarlo para abrirlo localmente.
                  </div>
                )}
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  );
}
