import { db } from '../src/db';
import { users, cvs } from '../src/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getCvAccess } from '../src/lib/cv-access';
import { baseCvForAiColumns } from '../src/lib/job-offer-queries';
import { parseMatchConstraints } from '../src/lib/curation-constraints';
import { buildCandidateEvidence } from '../src/lib/matching';
import { searchMatchingOffers } from '../src/lib/offer-discovery/search';

const USER_ID = '88d9fa60-677e-48d0-93be-5c2fdd88a468';

async function main() {
  console.log('1. Cargando perfil de candidato...');
  const access = await getCvAccess(USER_ID, db);
  const [user] = await db.select().from(users).where(eq(users.id, USER_ID)).limit(1);
  const [cv] = await db
    .select(baseCvForAiColumns)
    .from(cvs)
    .where(and(eq(cvs.userId, USER_ID), access.baseCvId ? eq(cvs.id, access.baseCvId) : sql`false`))
    .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal))
    .limit(1);

  const evidence = buildCandidateEvidence(
    user.careerProfile,
    cv?.content || '',
    parseMatchConstraints(user.careerProfile || {})
  );

  console.log('Card de candidato:\n', evidence.card);
  console.log('\n2. Buscando ofertas con OpenAI Web Search (searchMatchingOffers)...');
  const found = await searchMatchingOffers(evidence.card);
  console.log(`\nEncontradas ${found.length} ofertas:`);
  for (const o of found) {
    console.log('----------------------------------------');
    console.log('Título:', o.title);
    console.log('Empresa:', o.company);
    console.log('URL:', o.url);
    console.log('Ubicación:', o.location);
    console.log('Modalidad:', o.workplace);
    console.log('Salario:', o.salary);
    console.log('Publicado:', o.publishedAt);
    console.log('Fuentes:', o.sources);
    console.log('Descripción (preview):', o.description.slice(0, 150) + '...');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
