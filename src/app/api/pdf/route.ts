import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cvs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generatePdfBuffer } from '@/lib/pdf-engine';
import { createAuditLog } from '@/lib/audit';
import { getActor } from '@/lib/actor';

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cvId = searchParams.get('cvId');

    if (!cvId) {
      return new NextResponse('Missing cvId', { status: 400 });
    }

    const [cv] = await db
      .select()
      .from(cvs)
      .where(eq(cvs.id, cvId))
      .limit(1);

    if (!cv) {
      return new NextResponse('CV not found', { status: 404 });
    }

    // Comprobar propiedad
    if (cv.userId !== actor.userId) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Log de auditoría para descarga de PDF
    const isDownload = searchParams.get('download') === 'true';
    if (isDownload && actor.kind === 'guest') {
      return new NextResponse('Signup required to download', { status: 403 });
    }

    if (isDownload) {
      await createAuditLog('cv_download_pdf', actor.userId, actor.email, {
        cvId: cv.id,
        title: cv.title
      });
    }

    const buffer = await generatePdfBuffer(cv.content, {
      template: cv.templateName,
      accentColor: cv.accentColor || '#1a5f7a',
      fontFamily: cv.fontFamily || 'helvetica',
      pageMargin: cv.pageMargin ?? 36,
      fontSize: (cv.scale ?? 1.0) * 12.5, // back-converting scale to fontSize
      showIcons: true
    });

    const userName = actor.name || 'User';
    const safeName = userName.replace(/[/\\?%*:|"<>]/g, '');
    const filename = `CV ${safeName}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { content, template, accentColor, fontFamily, pageMargin, scale } = body;

    if (!content) {
      return new NextResponse('Missing content', { status: 400 });
    }

    const buffer = await generatePdfBuffer(content, {
      template: template || 'harvard',
      accentColor: accentColor || null,
      fontFamily: fontFamily || 'helvetica',
      pageMargin: pageMargin || 36,
      fontSize: (scale || 1.0) * 12.5,
      showIcons: true
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('Error generating live PDF preview:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
