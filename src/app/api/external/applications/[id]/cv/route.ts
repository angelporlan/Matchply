import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { ExternalAuthError, resolveExternalUser } from '@/lib/external-auth';
import { ApplicationNotFoundError, optimizeApplicationCv } from '@/lib/application-service';
import { revalidatePath } from 'next/cache';
import { SubscriptionAccessError } from '@/lib/permissions';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = await resolveExternalUser(req, body.userEmail);
    const result = await optimizeApplicationCv(user.id, params.id, body.regenerate === true);
    const origin = new URL(req.url).origin;
    await createAuditLog('job_offer_external_cv', user.id, user.email, {
      offerId: params.id,
      cvId: result.cvId,
      regenerated: body.regenerate === true,
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/kanban');
    return NextResponse.json({
      success: true,
      created: result.created,
      cvId: result.cvId,
      editorUrl: `${origin}/editor/${result.cvId}`,
      offerUrl: `${origin}/dashboard/kanban/offer/${params.id}`,
      application: result.offer,
    });
  } catch (error) {
    if (error instanceof ExternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SubscriptionAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ApplicationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
