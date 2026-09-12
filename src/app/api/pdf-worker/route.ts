import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

let workerSource: string | null = null;

export async function GET() {
  try {
    if (!workerSource) {
      workerSource = await readFile(
        path.join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
        'utf8',
      );
    }

    return new NextResponse(workerSource, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('PDF worker not found', { status: 404 });
  }
}
