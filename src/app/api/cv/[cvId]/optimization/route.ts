import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getCvOptimizationView } from '@/lib/cv-optimization/service';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: { cvId: string } }) {
  const actor = await getActor({ allowGuest: true });
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(params.cvId)) return NextResponse.json({ error: 'Invalid CV' }, { status: 400 });
  const view = await getCvOptimizationView(actor.userId, params.cvId);
  return NextResponse.json({ optimization: view }, { headers: { 'Cache-Control': 'no-store' } });
}
