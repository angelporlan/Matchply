import { cleanInputText, inputSafetyResponse, readPdfFile, readSafeForm } from '@/lib/input-safety';
import { RateLimitError } from '@/lib/rate-limit';
import { checkProductIp, consumeProductSession, rateLimitResponse } from '@/lib/product-rate-limit';
import { log } from '@/lib/logger';
import { publicErrorBody } from '@/lib/public-errors';
import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
// @ts-ignore
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  const limited = checkProductIp(req, 'parsePdf'); if (limited) return limited;
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return NextResponse.json(publicErrorBody('AUTH_REQUIRED'), { status: 401 });
    }

    consumeProductSession(actor.userId, 'parsePdf');
    const formData = await readSafeForm(req);
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, ...publicErrorBody('EMPTY_SOURCE_CV') }, { status: 400 });
    }

    const buffer = await readPdfFile(file);
    const parsed = await pdf(buffer);

    return NextResponse.json({
      success: true,
      text: cleanInputText(parsed.text || '')
    });
  } catch (error: any) {
    const inputResponse = inputSafetyResponse(error); if (inputResponse) return inputResponse;
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    log({ event: 'cv_pdf_parse_failed', level: 'error', code: 'PDF_PARSE_FAILED', error });
    return NextResponse.json({ success: false, ...publicErrorBody(error, 'PDF_PARSE_FAILED') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
