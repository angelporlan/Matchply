import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanInputText, InputSafetyError, MAX_INPUT_TEXT, readBoundedBody, readPdfFile, readSafeForm, readSafeJson } from '../src/lib/input-safety';

test('bounded body checks actual bytes even without a content length', async () => {
  const request = new Request('http://localhost/', { method: 'POST', body: 'ááá' });
  await assert.rejects(readBoundedBody(request, 5), (error: unknown) => error instanceof InputSafetyError && error.status === 413);
  const advertised = new Request('http://localhost/', { method: 'POST', body: 'a', headers: { 'content-length': '99' } });
  await assert.rejects(readBoundedBody(advertised, 5), (error: unknown) => error instanceof InputSafetyError && error.status === 413);
});

test('multipart file must contain PDF bytes and fit within the limit', async () => {
  const form = new FormData();
  form.set('file', new Blob(['%PDF-1.7\nexample'], { type: 'application/pdf' }), 'cv.pdf');
  const request = new Request('http://localhost/', { method: 'POST', body: form });
  const parsed = await readSafeForm(request);
  assert.equal(new TextDecoder().decode((await readPdfFile(parsed.get('file')!)).subarray(0, 5)), '%PDF-');
  const fake = new FormData(); fake.set('file', new Blob(['not a pdf'], { type: 'application/pdf' }), 'cv.pdf');
  await assert.rejects(readPdfFile(fake.get('file')!), (error: unknown) => error instanceof InputSafetyError && error.status === 400);
  fake.set('file', new Blob(['%PDF-1.7'], { type: 'image/png' }), 'cv.png');
  await assert.rejects(readPdfFile(fake.get('file')!), (error: unknown) => error instanceof InputSafetyError && error.status === 400);
  await assert.rejects(readPdfFile('not a file'), (error: unknown) => error instanceof InputSafetyError && error.status === 400);
});

test('text cleanup retains Unicode and formatting and rejects oversized text', () => {
  assert.equal(cleanInputText('  Experiencia\nC++\tEspaña\u0000\u001b  '), 'Experiencia\nC++\tEspaña');
  assert.throws(() => cleanInputText('x'.repeat(MAX_INPUT_TEXT + 1)), (error: unknown) => error instanceof InputSafetyError && error.status === 413);
});

test('JSON must be bounded and an object', async () => {
  const make = (body: string) => new Request('http://localhost/', { method: 'POST', body });
  assert.deepEqual(await readSafeJson(make('{"text":"hola"}')), { text: 'hola' });
  await assert.rejects(readSafeJson(make('null')), InputSafetyError);
  await assert.rejects(readSafeJson(make('x'.repeat(512 * 1024 + 1))), (error: unknown) => error instanceof InputSafetyError && error.status === 413);
});
