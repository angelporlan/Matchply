/**
 * Export helpers for generating CSV and clipboard TSV text from structured tabular data.
 */

export interface ExportColumnDefinition {
  key: string;
  label: string;
}

/**
 * Escapes a single cell value according to RFC 4180 for CSV.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // If the string contains comma, quote, or newline, it must be enclosed in quotes and internal quotes doubled.
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escapes a single cell value for Tab-Separated Values (TSV / Clipboard).
 */
export function escapeTsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // If the cell contains tabs, quotes, or newlines, enclose in quotes with doubled quotes for Excel/Sheets paste.
  if (str.includes('\t') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a standard UTF-8 CSV string with BOM for Excel compatibility.
 */
export function formatDataAsCsv(
  rows: Record<string, unknown>[],
  columns: ExportColumnDefinition[],
): string {
  const headerRow = columns.map((col) => escapeCsvCell(col.label)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key])).join(','),
  );

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens accented characters and ñ properly
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Generates a TSV string optimized for copying and pasting directly into Google Sheets, Excel, or Numbers.
 */
export function formatDataAsTsv(
  rows: Record<string, unknown>[],
  columns: ExportColumnDefinition[],
): string {
  const headerRow = columns.map((col) => escapeTsvCell(col.label)).join('\t');
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeTsvCell(row[col.key])).join('\t'),
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers a client-side download of a CSV file.
 */
export function triggerCsvDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
