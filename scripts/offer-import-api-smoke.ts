/** Explicit local HTTP/worker integration check. Creates and deletes its own guest fixtures. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const base = 'http://localhost:3000';
  const cookies: string[] = [];
  const testIp = `2001:db8:${randomUUID().slice(0, 4)}::1`;
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  databaseUrl.hostname = '127.0.0.1'; databaseUrl.port = '5433';
  process.env.DATABASE_URL = databaseUrl.toString();
  const { db, pool } = await import('@/db');
  const { users, cvs, jobOffers, userCompanies } = await import('@/db/schema');
  const { eq, inArray, and } = await import('drizzle-orm');
  const fixtureHashes = () => cookies.map(cookie => createHash('sha256').update(cookie.slice('matchply_guest='.length)).digest('hex'));
  const post = (cookie: string, requestId: string, url = 'https://www.linkedin.com/jobs/view/4465816694/', origin = base) =>
    fetch(`${base}/api/ai/offers/import`, { method: 'POST', headers: {
      Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-Forwarded-For': testIp,
    }, body: JSON.stringify({ requestId, url }) });
  try {
    assert.equal((await post('', randomUUID())).status, 401);
    for (let i = 0; i < 2; i++) {
      const response = await fetch(`${base}/api/guest`, { redirect: 'manual' });
      const cookie = response.headers.get('set-cookie')?.match(/matchply_guest=[^;]+/)?.[0];
      assert.ok(cookie);
      cookies.push(cookie);
    }
    assert.equal((await post(cookies[0], randomUUID(), 'http://127.0.0.1/private')).status, 400);
    assert.equal((await post(cookies[0], randomUUID(), undefined, 'https://unrelated.example')).status, 403);
    const proxied = await fetch(`${base}/api/ai/offers/import`, { method: 'POST', headers: {
      Cookie: cookies[0], Host: 'matchply.com', Origin: 'https://matchply.com',
      'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'matchply.com', 'Content-Type': 'application/json',
    }, body: '{}' });
    assert.equal(proxied.status, 400, 'An HTTPS reverse proxy must pass the origin check before payload validation');
    const requestId = randomUUID();
    const [a, b] = await Promise.all([post(cookies[0], requestId), post(cookies[0], requestId)]);
    assert.equal(a.status, 202); assert.equal(b.status, 202);
    const jobId = (await a.json()).jobId;
    assert.equal((await b.json()).jobId, jobId);
    assert.equal((await fetch(`${base}/api/ai/jobs/${jobId}`, { headers: { Cookie: cookies[1] } })).status, 404);
    assert.equal((await post(cookies[0], requestId, 'https://www.linkedin.com/jobs/view/999/')).status, 409);
    for (let i = 0; i < 5; i++) assert.equal((await post(cookies[0], requestId)).status, 202);
    assert.equal((await post(cookies[0], requestId)).status, 429, 'Actor limit is eight requests');
    assert.equal((await post(cookies[1], randomUUID())).status, 429, 'A new guest cannot bypass the same IP limit');
    const deadline = Date.now() + 8 * 60_000;
    let completed = false;
    while (Date.now() < deadline) {
      const response = await fetch(`${base}/api/ai/jobs/${jobId}`, { headers: { Cookie: cookies[0] } });
      assert.equal(response.status, 200);
      const job = await response.json();
      assert.notEqual(job.status, 'failed', job.lastError);
      if (job.status === 'completed') {
        assert.equal(job.result.platform, 'linkedin');
        assert.ok(job.result.jobDescription.length >= 80);
        process.stdout.write(JSON.stringify({ check: 'api_worker', success: true, method: job.result.sourceMethod,
          jobTitle: job.result.jobTitle, company: job.result.company, descriptionLength: job.result.jobDescription.length }) + '\n');
        completed = true; break;
      }
      await new Promise(resolve => setTimeout(resolve, 1_500));
    }
    assert.ok(completed, 'Worker must finish the import');
    // Use only local fixture ownership; do not delete existing browser actors or accounts.
    const hashes = fixtureHashes();
    const fixtures = await db.select({ id: users.id }).from(users).where(and(eq(users.isGuest, true), inArray(users.guestTokenHash, hashes)));
    for (const fixture of fixtures) {
      assert.equal((await db.select({ id: cvs.id }).from(cvs).where(eq(cvs.userId, fixture.id))).length, 0);
      assert.equal((await db.select({ id: jobOffers.id }).from(jobOffers).where(eq(jobOffers.userId, fixture.id))).length, 0);
      assert.equal((await db.select({ userId: userCompanies.userId }).from(userCompanies).where(eq(userCompanies.userId, fixture.id))).length, 0);
    }
    process.stdout.write('Ownership, deduplication, URL/origin guards and zero product entities verified.\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'unknown' }) + '\n');
    process.exitCode = 1;
  } finally {
    if (cookies.length) await db.delete(users).where(and(eq(users.isGuest, true), inArray(users.guestTokenHash, fixtureHashes())));
    await pool.end();
    process.stdout.write('Guest fixtures removed.\n');
  }
}
main();
