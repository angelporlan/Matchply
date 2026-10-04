import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { AIService } from '@/lib/ai-service';
import { runWithUsage, usageInputHash } from '@/lib/usage';
import { aiRequestId, aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { effectiveSubscriptionStatus } from '@/lib/subscription';
import { log } from '@/lib/logger';
// @ts-ignore
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    let rawText = '';
    let requestId: unknown;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      requestId = formData.get('requestId');
      const file = formData.get('file') as File | null;
      const text = formData.get('text') as string | null;

      if (file) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const parsed = await pdf(buffer);
          rawText = parsed.text || '';
        } catch (err: any) {
          log({ event: 'profile_extract_pdf_failed', level: 'warn', error: err });
          return NextResponse.json({
            success: false,
            error: 'No se pudo leer el archivo PDF. Intenta pegar el texto directamente.'
          }, { status: 400 });
        }
      } else if (text) {
        rawText = text;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      rawText = body.text || body.rawText || '';
      requestId = body.requestId;
    }

    if (typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({
        success: false,
        error: 'No se ha proporcionado texto o archivo para analizar.'
      }, { status: 400 });
    }

    const extractedProfile = await runWithUsage(actor.userId, { bucket: 'general', action: 'profile:extract', requestId: aiRequestId(req, requestId), input: { textHash: usageInputHash(rawText) } }, () => AIService.extractProfileFromRawText({
      rawText, userSubscriptionStatus: effectiveSubscriptionStatus(actor),
    }));

    return NextResponse.json({
      success: true,
      profile: extractedProfile,
    });
  } catch (error: any) {
    const response = aiUsageErrorResponse(error); if (response) return response;
    log({ event: 'profile_extract_failed', level: 'error', error });
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al procesar el perfil con IA.'
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
