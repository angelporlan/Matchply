import type { GtmFileKind } from './gtm-types';

export function gtmExtension(filePath: string) {
  const name = filePath.split('/').pop() ?? filePath;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

export function gtmFileKind(filePath: string): GtmFileKind {
  const extension = gtmExtension(filePath);
  if (extension === '.md' || extension === '.markdown') return 'markdown';
  if (extension === '.json') return 'json';
  if (['.txt', '.csv', '.tsv', '.log'].includes(extension)) return 'text';
  return 'binary';
}

export function isGtmPreviewable(kind: GtmFileKind) {
  return kind !== 'binary';
}

export function slugifyGtmBot(value: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'bot';
}
