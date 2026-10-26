import { log } from '@/lib/logger';
import { publicErrorBody } from '@/lib/public-errors';
import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
// @ts-ignore
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return NextResponse.json(publicErrorBody('AUTH_REQUIRED'), { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, ...publicErrorBody('EMPTY_SOURCE_CV') }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await pdf(buffer);

    return NextResponse.json({
      success: true,
      text: parsed.text || ''
    });
  } catch (error: any) {
    log({ event: 'cv_pdf_parse_failed', level: 'error', code: 'PDF_PARSE_FAILED', error });
    return NextResponse.json({ success: false, ...publicErrorBody(error, 'PDF_PARSE_FAILED') }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
