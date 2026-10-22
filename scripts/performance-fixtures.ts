import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';

const database = process.env.INTEGRATION_TEST_DATABASE_URL;
if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('An explicit isolated local test DB is required');
process.env.DATABASE_URL = database;
const id = (value: string) => { const h = createHash('sha256').update(`matchply-perf:${value}`).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
const profiles = [{ name: 'small', offers: 10, cvs: 1 }, { name: 'medium', offers: 500, cvs: 20 }, { name: 'large', offers: 5000, cvs: 100 }];
const cv = '# Performance Candidate\n\n**Email:** synthetic@example.test\n\n## Perfil Profesional\nDesarrollo APIs con Python.\n\n## Experiencia Profesional\n### Desarrolladora\n**Acme** | *2022 – Presente*\n- Desarrollo APIs con Python.\n\n## Habilidades\n- **Backend:** Python\n';

async function main() {
  const { db, pool } = await import('@/db');
  const s = await import('@/db/schema');
  const result = [];
  try {
    for (const profile of profiles) {
      const userId = id(profile.name), companyCount = Math.min(profile.offers, 500);
      const companyIds = Array.from({ length: companyCount }, (_, n) => id(`${profile.name}:company:${n}`));
      await db.delete(s.users).where(eq(s.users.id, userId));
      await db.delete(s.companies).where(inArray(s.companies.id, companyIds));
      await db.insert(s.users).values({ id: userId, email: `perf-${profile.name}@example.test`, name: 'Performance Candidate', subscriptionStatus: 'active', passwordHash: bcrypt.hashSync('Performance-test-only-123', 4) });
      await db.insert(s.companies).values(companyIds.map((companyId, n) => ({ id: companyId, name: `Perf ${profile.name} company ${n}`, nameNormalized: `perf-${profile.name}-${n}` })));
      await db.insert(s.userCompanies).values(companyIds.map(companyId => ({ userId, companyId })));
      const cvIds = Array.from({ length: profile.cvs }, (_, n) => id(`${profile.name}:cv:${n}`));
      await db.insert(s.cvs).values(cvIds.map((cvId, n) => ({ id: cvId, userId, title: `Perf CV ${n}`, content: cv, isBase: n === 0, isPrincipal: n === 0 })));
      for (let start = 0; start < profile.offers; start += 250) {
        const positions = Array.from({ length: Math.min(250, profile.offers - start) }, (_, n) => start + n);
        await db.insert(s.jobOffers).values(positions.map(n => ({ userId, title: `Perf role ${n}`, company: `Perf ${profile.name} company ${n % companyCount}`, companyId: companyIds[n % companyCount], cvId: cvIds[n % cvIds.length], status: n % 5 === 0 ? 'archived:interested' : 'interested', description: 'HEAVY_DESCRIPTION_SENTINEL'.repeat(100), rawReport: 'HEAVY_REPORT_SENTINEL'.repeat(100) })));
        const people = positions.map(n => ({ id: id(`${profile.name}:person:${n}`), userId, name: `Perf contact ${n}`, role: 'Recruiter' }));
        await db.insert(s.people).values(people);
        await db.insert(s.personCompanies).values(people.map((person, n) => ({ personId: person.id, userId, companyId: companyIds[(start + n) % companyCount], relation: 'works_at' })));
      }
      result.push({ ...profile, userId, cvId: cvIds[0], adaptedCvId: cvIds[1] ?? cvIds[0], email: `perf-${profile.name}@example.test` });
    }
    console.log(JSON.stringify(result, null, 2));
  } finally { await pool.end(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
