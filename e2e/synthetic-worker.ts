/** Test-only worker: exercises the real queue and persistence with synthetic model output. */
import { cv, analysis } from './full-flow-fixture';

async function main() {
  const jobId = process.argv[2];
  if (!/^[\da-f-]{36}$/i.test(jobId || '')) throw new Error('A synthetic job ID is required');
  const database = process.env.DATABASE_URL;
  if (!database || !['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('An isolated database is required');
  const { pool } = await import('@/db');
  try {
    const queue = await import('@/lib/ai-jobs/queue');
    const service = await import('@/lib/cv-optimization/service');
    const job = await queue.claimAiJobById(jobId);
    if (!job) throw new Error('Could not claim synthetic job');
    await service.processCvOptimization(job, new AbortController().signal, async (_ref, _system, _user, _temperature, _signal, mode) => mode.startsWith('analysis') ? JSON.stringify(analysis) : cv);
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
