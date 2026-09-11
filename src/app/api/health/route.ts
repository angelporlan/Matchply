import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[health] database check failed:', error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
