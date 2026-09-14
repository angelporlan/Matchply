import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeCsvCell,
  escapeTsvCell,
  formatDataAsCsv,
  formatDataAsTsv,
  ExportColumnDefinition,
} from '@/lib/export-helpers';

test('escapeCsvCell correctly handles null, plain and special characters', () => {
  assert.equal(escapeCsvCell(null), '');
  assert.equal(escapeCsvCell(undefined), '');
  assert.equal(escapeCsvCell(123), '123');
  assert.equal(escapeCsvCell('Senior Developer'), 'Senior Developer');

  // Commas
  assert.equal(escapeCsvCell('Madrid, Spain'), '"Madrid, Spain"');

  // Quotes
  assert.equal(escapeCsvCell('He said "hello"'), '"He said ""hello"""');

  // Newlines
  assert.equal(escapeCsvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
  assert.equal(escapeCsvCell("Line 1\r\nLine 2"), '"Line 1\r\nLine 2"');

  // All combined
  assert.equal(escapeCsvCell('Title: "Engineer", Location: Madrid\nRequirements'), '"Title: ""Engineer"", Location: Madrid\nRequirements"');
});

test('escapeTsvCell formats cells safely for clipboard paste into spreadsheets', () => {
  assert.equal(escapeTsvCell(null), '');
  assert.equal(escapeTsvCell(undefined), '');
  assert.equal(escapeTsvCell('Google'), 'Google');

  // Tabs
  assert.equal(escapeTsvCell('Col1\tCol2'), '"Col1\tCol2"');

  // Newlines inside a description cell
  assert.equal(escapeTsvCell('Description:\n- React\n- Node'), '"Description:\n- React\n- Node"');

  // Quotes
  assert.equal(escapeTsvCell('Company "X"'), '"Company ""X"""');
});

test('formatDataAsCsv builds valid RFC 4180 CSV with UTF-8 BOM', () => {
  const columns: ExportColumnDefinition[] = [
    { key: 'title', label: 'Puesto' },
    { key: 'company', label: 'Empresa' },
    { key: 'description', label: 'Descripción' },
    { key: 'url', label: 'URL' },
  ];

  const rows = [
    {
      title: 'Full Stack Engineer',
      company: 'Tech, Inc.',
      description: 'Requirements:\n- 3+ years experience\n- English fluent',
      url: 'https://example.com/job/1',
    },
    {
      title: 'Data Scientist',
      company: 'Acme "AI"',
      description: 'Python & SQL',
      url: 'https://example.com/job/2',
    },
  ];

  const csv = formatDataAsCsv(rows, columns);

  // Must start with UTF-8 BOM for Microsoft Excel
  assert.ok(csv.startsWith('\uFEFF'));

  const withoutBom = csv.slice(1);
  const lines = withoutBom.split('\r\n');

  // Header
  assert.equal(lines[0], 'Puesto,Empresa,Descripción,URL');

  // Row 1 company has comma, description has newlines
  assert.match(withoutBom, /"Tech, Inc\."/);
  assert.match(withoutBom, /"Requirements:\n- 3\+ years experience\n- English fluent"/);

  // Row 2 company has quotes
  assert.match(withoutBom, /"Acme ""AI"""/);
});

test('formatDataAsTsv builds tab-delimited text ready for clipboard', () => {
  const columns: ExportColumnDefinition[] = [
    { key: 'title', label: 'Puesto' },
    { key: 'company', label: 'Empresa' },
    { key: 'status', label: 'Estado' },
  ];

  const rows = [
    {
      title: 'AI Engineer',
      company: 'OpenAI',
      status: 'En entrevista',
    },
    {
      title: 'DevOps',
      company: 'Docker\tK8s',
      status: 'Interesado',
    },
  ];

  const tsv = formatDataAsTsv(rows, columns);
  const lines = tsv.split('\n');

  assert.equal(lines[0], 'Puesto\tEmpresa\tEstado');
  assert.equal(lines[1], 'AI Engineer\tOpenAI\tEn entrevista');
  assert.equal(lines[2], 'DevOps\t"Docker\tK8s"\tInteresado');
});
