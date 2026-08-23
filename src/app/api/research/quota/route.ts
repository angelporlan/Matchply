import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getResearchQuota } from '@/lib/research/queue';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  return NextResponse.json({ quota: await getResearchQuota(session.user.id) }, { headers: { 'Cache-Control': 'no-store' } });
}
