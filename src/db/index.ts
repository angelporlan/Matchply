import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  // Next.js evaluates server modules during `next build` before runtime env is injected.
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV !== 'production') {
    return 'postgresql://127.0.0.1:1/unused';
  }
  throw new Error('DATABASE_URL is required');
}

const statementTimeoutMs = Math.max(
  1_000,
  Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 15_000),
);

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  max: Math.max(1, Number(process.env.DATABASE_POOL_MAX || 8)),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  options: `-c statement_timeout=${statementTimeoutMs}`,
});

export const db = drizzle(pool, { schema });
