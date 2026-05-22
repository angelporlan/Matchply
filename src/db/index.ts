import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:nextprof_secure_pwd@db:5432/nextprof_db',
});

export const db = drizzle(pool, { schema });
