import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Preflight is read-only. Never mark an unknown production schema as migrated.
const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')).entries;
const migrations = journal.map(entry => {
  const sql = readFileSync(`drizzle/${entry.tag}.sql`, 'utf8');
  return { ...entry, hash: createHash('sha256').update(sql).digest('hex'),
    destructive: /\bDROP\s+(?:COLUMN|TABLE|TYPE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i.test(sql) };
});
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const exists = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS name");
  const applied = exists.rows[0].name
    ? (await client.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows : [];
  const known = new Set(migrations.map(m => m.hash));
  if (applied.some(row => !known.has(row.hash))) throw new Error('Unknown or modified applied migration; reconcile the history before deploying.');
  const hashes = new Set(applied.map(row => row.hash));
  const last = Math.max(0, ...applied.map(row => Number(row.created_at)));
  const missing = migrations.filter(m => !hashes.has(m.hash));
  if (missing.some(m => m.when <= last)) throw new Error('Unapplied migration older than the database journal; automatic migration would skip it.');
  console.log(JSON.stringify({ applied: applied.length, pending: missing.map(({ tag, hash, destructive }) => ({ tag, hash, destructive })) }));
} catch (error) {
  // Driver errors can include connection details; never print the URL.
  console.error(error instanceof Error && error.message.startsWith('Unknown') || error?.message?.startsWith('Unapplied')
    ? error.message : 'Migration preflight failed; inspect database connectivity and schema with the VPS skill.');
  process.exitCode = 1;
} finally { await client.end(); }
