import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfDownloader, type PdfDownloadDependencies } from '@/lib/pdf-download';

const downloadUrl = '/api/pdf?cvId=example&download=true';

function pdfResponse() {
  return new Response(new Blob(['%PDF-1.7\nexample'], { type: 'application/pdf' }), {
    headers: { 'content-type': 'application/pdf' },
  });
}

function harness(overrides: Partial<PdfDownloadDependencies> = {}) {
  const operations: string[] = [];
  const events: string[] = [];
  let fetched = 0;
  let downloaded = 0;
  let forbidden = 0;
  const link = {
    href: '',
    download: '',
    click: () => { operations.push('click'); },
    remove: () => { operations.push('remove'); },
  };
  const download = createPdfDownloader({
    fetch: async () => { fetched += 1; return pdfResponse(); },
    createObjectURL: () => { operations.push('object-url'); return 'blob:pdf'; },
    revokeObjectURL: () => { operations.push('revoke'); },
    createLink: () => link,
    appendLink: () => { operations.push('append'); },
    ...overrides,
  });
  const options = {
    url: downloadUrl,
    filename: 'Mi candidatura.pdf',
    onDownloaded: () => {
      assert.ok(operations.includes('click'), 'success must follow the browser download');
      events.push('cv_downloaded');
      downloaded += 1;
    },
    onForbidden: () => { forbidden += 1; },
  };
  return {
    download,
    options,
    operations,
    events,
    link,
    counts: () => ({ fetched, downloaded, forbidden }),
  };
}

test('a confirmed PDF starts one browser download before emitting success', async () => {
  const state = harness();
  assert.equal(await state.download(state.options), 'downloaded');
  assert.deepEqual(state.counts(), { fetched: 1, downloaded: 1, forbidden: 0 });
  assert.deepEqual(state.events, ['cv_downloaded']);
  assert.equal(state.link.href, 'blob:pdf');
  assert.equal(state.link.download, 'Mi candidatura.pdf');
  assert.deepEqual(state.operations, ['object-url', 'append', 'click', 'remove', 'revoke']);
});

test('an account download works without a candidacy callback', async () => {
  const state = harness();
  assert.equal(await state.download({ url: downloadUrl, filename: 'CV.pdf' }), 'downloaded');
  assert.ok(state.operations.includes('click'));
  assert.equal(state.link.download, 'CV.pdf');
});

test('native account downloads retain the server filename, while explicit guest names take precedence', async () => {
  const response = () => {
    const pdf = pdfResponse();
    pdf.headers.set('content-disposition', "attachment; filename=\"CV Maria.pdf\"; filename*=UTF-8''CV%20Mar%C3%ADa.pdf");
    return pdf;
  };
  const state = harness({ fetch: async () => response() });
  assert.equal(await state.download({ ...state.options, filename: undefined }), 'downloaded');
  assert.equal(state.link.download, 'CV María.pdf');
  assert.equal(await state.download(state.options), 'downloaded');
  assert.equal(state.link.download, 'Mi candidatura.pdf');
});

test('failed HTTP, network, body and non-PDF responses never report a download', async (context) => {
  const failures: [string, PdfDownloadDependencies['fetch']][] = [
    ['HTTP error', async () => new Response('error', { status: 500 })],
    ['network error', async () => { throw new Error('offline'); }],
    ['HTML error with HTTP 200', async () => new Response('<html>Error</html>', { headers: { 'content-type': 'text/html' } })],
    ['empty PDF', async () => new Response(new Blob([], { type: 'application/pdf' }), { headers: { 'content-type': 'application/pdf' } })],
    ['body read error', async () => {
      const response = pdfResponse();
      response.blob = async () => { throw new Error('connection interrupted'); };
      return response;
    }],
  ];
  for (const [name, fetch] of failures) {
    await context.test(name, async () => {
      const state = harness({ fetch });
      assert.equal(await state.download(state.options), 'failed');
      assert.deepEqual(state.events, []);
      assert.equal(state.counts().downloaded, 0);
      assert.equal(state.counts().forbidden, 0);
      assert.deepEqual(state.operations, []);
    });
  }
});

test('a forbidden download keeps the guest gate without reporting success or creating a file', async () => {
  const state = harness({ fetch: async () => new Response('quota exhausted', { status: 403 }) });
  assert.equal(await state.download(state.options), 'forbidden');
  assert.equal(state.counts().forbidden, 1);
  assert.equal(state.counts().downloaded, 0);
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.operations, []);
});

test('double clicks share the in-flight guard and cannot consume quota twice', async () => {
  let resolveResponse!: (response: Response) => void;
  let requests = 0;
  const response = new Promise<Response>((resolve) => { resolveResponse = resolve; });
  const state = harness({ fetch: () => { requests += 1; return response; } });
  const first = state.download(state.options);
  const duplicate = await state.download(state.options);
  assert.equal(duplicate, 'in-flight');
  assert.equal(requests, 1);
  assert.deepEqual(state.events, []);
  resolveResponse(pdfResponse());
  assert.equal(await first, 'downloaded');
  assert.deepEqual(state.events, ['cv_downloaded']);
  assert.equal(state.counts().downloaded, 1);
  assert.equal(state.operations.filter((operation) => operation === 'click').length, 1);
});

test('a browser failure cleans the temporary file, emits nothing and permits retry', async () => {
  let fail = true;
  const state = harness();
  state.link.click = () => {
    if (fail) throw new Error('download blocked');
    state.operations.push('click');
  };
  assert.equal(await state.download(state.options), 'failed');
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.operations, ['object-url', 'append', 'remove', 'revoke']);
  fail = false;
  assert.equal(await state.download(state.options), 'downloaded');
  assert.equal(state.counts().fetched, 2);
  assert.deepEqual(state.events, ['cv_downloaded']);
});
