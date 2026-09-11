import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    log({ event: 'health_check_failed', level: 'error', route: '/api/health', error });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
