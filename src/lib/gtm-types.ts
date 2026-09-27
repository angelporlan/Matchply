export const GTM_CANONICAL_FILES = [
  'README.md',
  'testers.md',
  'dm-borradores.md',
  'objeciones.md',
] as const;

export type GtmCanonicalFileName = (typeof GTM_CANONICAL_FILES)[number];

export type GtmRunStatus = 'running' | 'completed' | 'failed' | 'incomplete';

export type GtmFileKind = 'markdown' | 'json' | 'text' | 'binary';

export interface GtmOutputFile {
  path: string;
  name: string;
  extension: string;
  kind: GtmFileKind;
  sizeBytes: number;
  modifiedAt: string;
}

export interface GtmRunManifest {
  schemaVersion: 1;
  runId: string;
  botName: string;
  botSlug: string;
  title: string | null;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  summary: string | null;
  outputs: GtmOutputFile[];
}

export interface GtmRunSummary {
  runId: string;
  directory: string;
  dateKey: string;
  botName: string;
  botSlug: string;
  title: string | null;
  status: GtmRunStatus;
  startedAt: string;
  completedAt: string | null;
  summary: string | null;
  outputs: GtmOutputFile[];
}

export interface GtmContentRef {
  source: 'canonical' | 'run';
  file: string;
  runId?: string;
}

export interface GtmSearchResult extends GtmContentRef {
  botName: string | null;
  title: string | null;
  modifiedAt: string;
}

export interface GtmWorkspaceSnapshot {
  canonical: GtmOutputFile[];
  runs: GtmRunSummary[];
  bots: string[];
  generatedAt: string;
}
