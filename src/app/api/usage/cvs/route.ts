import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { selectActiveCvs } from '@/lib/cv-access';
import { UsageError } from '@/lib/usage';
import { revalidatePath } from 'next/cache';
import { isTrustedBillingOrigin } from '@/lib/billing-policy';
export async function POST(req: NextRequest) {
  if (!isTrustedBillingOrigin(req.headers.get('origin'))) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const actor = await getActor({ allowGuest: true });
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!(body.baseCvId === null || typeof body.baseCvId === 'string') || !Array.isArray(body.adaptedCvIds) || body.adaptedCvIds.some((id: unknown) => typeof id !== 'string')) return NextResponse.json({ error: 'Invalid selection' }, { status: 400 });
    const access = await selectActiveCvs(actor.userId, body.baseCvId, body.adaptedCvIds);
    revalidatePath('/dashboard');
    return NextResponse.json(access);
  } catch (error) { return NextResponse.json(error instanceof UsageError ? error.toJSON() : { error: 'Selection failed' }, { status: error instanceof UsageError ? error.status : 500 }); }
}
