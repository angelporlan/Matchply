import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';

const database = process.env.INPUT_SAFETY_TEST_DATABASE_URL, baseUrl = process.env.INPUT_SAFETY_TEST_APP_URL;
test('guest PDF and pasted text endpoints reject invalid input and accept an actual PDF', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!, baseUrl!].every(url => ['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db'); const { users } = await import('@/db/schema'); const { eq } = await import('drizzle-orm');
  let userId: string | undefined;
  try {
    const guest = await fetch(new URL('/api/guest?redirect=/try', baseUrl), { redirect: 'manual', headers: { 'X-Real-IP': '198.18.202.19' } });
    assert.equal(guest.status, 307);
    const cookie = guest.headers.getSetCookie().find(v => v.startsWith('matchply_guest='))!.split(';')[0];
    const token = cookie.slice('matchply_guest='.length);
    const [user] = await db.select({id: users.id}).from(users).where(eq(users.guestTokenHash, createHash('sha256').update(token).digest('hex'))).limit(1);
    assert.ok(user); userId = user.id;
    const send = (path: string, body: BodyInit, contentType?: string) => fetch(new URL(path, baseUrl), { method:'POST', headers: { Cookie: cookie, 'X-Real-IP': '198.18.202.19', ...(contentType ? {'Content-Type': contentType} : {}) }, body });
    const file = (bytes: BlobPart, type: string) => { const form = new FormData(); form.set('file', new Blob([bytes], { type }), 'cv.pdf'); return form; };
    for (const path of ['/api/cv/parse-pdf', '/api/cv/import', '/api/ai/profile/extract']) {
      assert.equal((await send(path, file('not a pdf', 'application/pdf'))).status, 400, path);
      assert.equal((await send(path, file(new Uint8Array(10 * 1024 * 1024 + 1), 'application/pdf'))).status, 413, path);
    }
    assert.equal((await send('/api/ai/profile/extract', JSON.stringify({ text: 'a'.repeat(120001) }), 'application/json')).status, 413);
    assert.equal((await send('/api/ai/optimize', JSON.stringify({baseCvId: randomUUID(), jobDescription: 'a'.repeat(120001)}), 'application/json')).status, 413);
    const chunks: Buffer[] = []; const doc = new PDFDocument(); doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>(resolve => doc.on('end', resolve)); doc.text('Experiencia profesional de prueba'); doc.end(); await finished;
    const result = await send('/api/cv/parse-pdf', file(Buffer.concat(chunks), 'application/pdf'));
    assert.equal(result.status, 200); assert.match((await result.json()).text, /Experiencia profesional de prueba/);
  } finally { if (userId) await db.delete(users).where(eq(users.id, userId)); await pool.end(); }
});
