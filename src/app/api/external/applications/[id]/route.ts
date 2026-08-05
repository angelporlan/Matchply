import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { ExternalAuthError, resolveExternalUser } from '@/lib/external-auth';
import {
  ApplicationConflictError,
  ApplicationNotFoundError,
  updateExternalApplication,
} from '@/lib/application-service';
import { revalidatePath } from 'next/cache';
import { SubscriptionAccessError } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const user = await resolveExternalUser(req, body.userEmail);
    const application = await updateExternalApplication(user.id, params.id, body);
    await createAuditLog('job_offer_external_update', user.id, user.email, {
      offerId: application.id,
      status: application.status,
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/kanban');
    const origin = new URL(req.url).origin;
    return NextResponse.json({
      success: true,
      application: {
        ...application,
        editorUrl: application.cvId ? `${origin}/editor/${application.cvId}` : null,
        offerUrl: `${origin}/dashboard/kanban/offer/${application.id}`,
      },
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
    if (error instanceof ApplicationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
