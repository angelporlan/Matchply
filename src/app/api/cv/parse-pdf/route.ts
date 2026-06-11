import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
// @ts-ignore
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await pdf(buffer);

    return NextResponse.json({
      success: true,
      text: parsed.text || ''
    });
  } catch (error: any) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
