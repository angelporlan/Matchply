import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { ExternalAuthError, resolveExternalUser } from '@/lib/external-auth';
import {
  createApplicationCvFromMarkdown,
  listExternalApplications,
  optimizeApplicationCv,
  upsertExternalApplication,
} from '@/lib/application-service';
import { revalidatePath } from 'next/cache';

function errorResponse(error: unknown) {
  if (error instanceof ExternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return NextResponse.json({ error: message }, { status: 500 });
}

function publicOffer(offer: any, req: NextRequest) {
  const origin = new URL(req.url).origin;
  return {
    ...offer,
    editorUrl: offer.cvId ? `${origin}/editor/${offer.cvId}` : null,
    offerUrl: `${origin}/dashboard/kanban/offer/${offer.id}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveExternalUser(req);
    const url = new URL(req.url);
    const applications = await listExternalApplications(user.id, {
      externalSource: url.searchParams.get('externalSource') || undefined,
      updatedSince: url.searchParams.get('updatedSince') || undefined,
    });
    return NextResponse.json({ applications: applications.map(item => publicOffer(item, req)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await resolveExternalUser(req, body.userEmail);
    if (!body.title || !body.company) {
      return NextResponse.json({ error: 'Missing required fields: title or company' }, { status: 400 });
    }

    const { offer, created } = await upsertExternalApplication(user.id, body);
    let finalOffer = offer;
    let cvWarning: string | null = null;
    try {
      if (typeof body.cvMarkdownTailored === 'string' && body.cvMarkdownTailored.trim()) {
        const cvResult = await createApplicationCvFromMarkdown(
          user.id,
          offer.id,
          body.cvMarkdownTailored,
        );
        finalOffer = cvResult.offer;
      } else if (body.optimizeCv === true) {
        const cvResult = await optimizeApplicationCv(user.id, offer.id, false);
        finalOffer = cvResult.offer;
      }
    } catch (error) {
      // Compatibilidad histórica: la candidatura se conserva aunque falle el CV.
      cvWarning = error instanceof Error ? error.message : 'CV optimization failed';
    }
    await createAuditLog(
      created ? 'job_offer_sync_create' : 'job_offer_sync_update',
      user.id,
      user.email,
      {
        offerId: offer.id,
        title: offer.title,
        company: offer.company,
        externalSource: offer.externalSource,
        externalId: offer.externalId,
      },
    );
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/kanban');
    return NextResponse.json({
      success: true,
      created,
      application: publicOffer(finalOffer, req),
      offerId: finalOffer.id,
      cvId: finalOffer.cvId,
      cvWarning,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
