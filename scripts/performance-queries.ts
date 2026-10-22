import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
const database = process.env.INTEGRATION_TEST_DATABASE_URL;
if (!database || !['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('Explicit isolated local test DB required');
process.env.DATABASE_URL = database;
const fixtureId = (value: string) => { const h = createHash('sha256').update(`matchply-perf:${value}`).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
async function main() {
  const { db, pool } = await import('@/db');
  const { cvs, jobOffers, users } = await import('@/db/schema');
  const { cvListColumns, cvTargetColumns } = await import('@/lib/job-offer-queries');
  const { loadApplicationsWorkspace } = await import('@/lib/application-list-query');
  const { SYSTEM_VIEWS } = await import('@/lib/application-views');
  const { listCrmPage } = await import('@/lib/crm-list-query');
  const { defaultCrmConfig } = await import('@/lib/crm-views');
  const { getUserPlan } = await import('@/lib/plan-store');
  const { getUsageSnapshot } = await import('@/lib/usage');
  const { getCvAccess } = await import('@/lib/cv-access');
  const baseline = process.env.PERF_BUILD === 'd0dfcc2';
  const original = pool.query.bind(pool);
  const records: Array<{ text: string; values?: unknown[] }> = [];
  pool.query = ((...args: any[]) => {
    const config = typeof args[0] === 'string' ? { text: args[0], values: args[1] } : args[0];
    records.push({ text: config.text, values: config.values ?? args[1] });
    return Reflect.apply(original, pool, args);
  }) as typeof pool.query;
  const data = [];
  try {
    for (const profile of ['small','medium','large']) {
      const userId = fixtureId(profile);
      const tasks: Record<string, () => Promise<unknown>> = {
        dashboard: () => Promise.all([
          db.select(cvListColumns).from(cvs).where(eq(cvs.userId,userId)).orderBy(desc(cvs.isPrincipal),desc(cvs.updatedAt)),
          db.selectDistinctOn([jobOffers.cvId],cvTargetColumns).from(jobOffers).where(and(eq(jobOffers.userId,userId),isNotNull(jobOffers.cvId))).orderBy(jobOffers.cvId,desc(jobOffers.updatedAt)),
        ]),
        applications: () => loadApplicationsWorkspace({ userId, filters: SYSTEM_VIEWS[0].config.filters, sort: SYSTEM_VIEWS[0].config.sort, page: 1, pageSize: 25 }),
        archived: () => { const config = SYSTEM_VIEWS.find(view => view.id === 'archived')!.config; return loadApplicationsWorkspace({ userId, filters: config.filters, sort: config.sort, page: 1, pageSize: 25 }); },
        companies: () => listCrmPage(userId,'companies',defaultCrmConfig('companies')),
        people: () => listCrmPage(userId,'people',defaultCrmConfig('people')),
        usage: async () => {
          if (baseline) return Promise.all([getUsageSnapshot(userId),getCvAccess(userId),db.select({ endAt: users.stripeTrialEnd, usedAt: users.stripeTrialUsedAt, firstValueAt: users.firstValueAt, paidAt: users.stripePaidAt }).from(users).where(eq(users.id,userId)).limit(1)]);
          const context = await getUserPlan(userId);
          return Promise.all([getUsageSnapshot(userId,db,context),getCvAccess(userId,db,context)]);
        },
      };
      for (const [name, run] of Object.entries(tasks)) {
        await run(); records.length = 0;
        const measuredPool = pool as typeof pool & { acquisitionStats?: () => { count: number; totalMs: number } };
        const beforePool = measuredPool.acquisitionStats?.();
        const times: number[] = []; const counts: number[] = []; let sampleQueries: typeof records = [];
        for (let i=0;i<30;i++) {
          records.length = 0; const started = performance.now(); await run(); times.push(performance.now()-started); counts.push(records.length);
          if (i===0) sampleQueries = [...records];
        }
        const afterPool = measuredPool.acquisitionStats?.();
        const plans = [];
        for (const query of sampleQueries.filter(query => /^select /i.test(query.text)).slice(0,5)) {
          const result = await original({ text: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`, values: query.values });
          const plan = result.rows[0]['QUERY PLAN'][0];
          plans.push({ planningMs: plan['Planning Time'], executionMs: plan['Execution Time'], sharedHitBlocks: plan.Plan['Shared Hit Blocks'], sharedReadBlocks: plan.Plan['Shared Read Blocks'], plan: plan.Plan });
        }
        times.sort((a,b)=>a-b);
        data.push({ profile,name,samples:30,p50Ms:times[15],p95Ms:times[28],selects:counts[0],
          ...(beforePool && afterPool ? { meanPoolAcquireMs: (afterPool.totalMs-beforePool.totalMs) / (afterPool.count-beforePool.count) } : {}), plans });
      }
    }
    console.log(JSON.stringify({ build:process.env.PERF_BUILD,node:process.version,date:new Date().toISOString(),data },null,2));
  } finally { await pool.end(); }
}
void main().catch(error => { console.error(error); process.exitCode=1; });
