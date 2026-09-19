import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cvs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { renderPdf } from '@/lib/pdf-render';
import { createAuditLog } from '@/lib/audit';
import { getActor } from '@/lib/actor';
import { getAllowedCvTemplate } from '@/lib/subscription';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { getCachedPdf, pdfCacheKey, setCachedPdf } from '@/lib/pdf-cache';
import { log } from '@/lib/logger';
import { guestHasPdfDownloadRemaining, recordGuestPdfDownload } from '@/lib/guest-pdf';

// Only what the renderer needs; `cv` also stores markdown history-sized content,
// so we never pull columns we do not use.
const pdfCvColumns = {
  id: cvs.id,
  userId: cvs.userId,
  title: cvs.title,
  content: cvs.content,
  templateName: cvs.templateName,
  accentColor: cvs.accentColor,
  fontFamily: cvs.fontFamily,
  pageMargin: cvs.pageMargin,
  scale: cvs.scale,
};

type PdfOptions = {
  template: string;
  accentColor: string | null;
  fontFamily: string;
  pageMargin: number;
  fontSize: number;
  showIcons: boolean;
};

async function renderWithCache(content: string, pdfOptions: PdfOptions) {
  const cacheKey = pdfCacheKey({
    content,
    template: pdfOptions.template,
    accentColor: pdfOptions.accentColor,
    fontFamily: pdfOptions.fontFamily,
    pageMargin: pdfOptions.pageMargin,
    fontSize: pdfOptions.fontSize,
  });
  let buffer = getCachedPdf(cacheKey);
  const cacheHit = Boolean(buffer);
  if (!buffer) {
    buffer = await renderPdf(content, pdfOptions);
    setCachedPdf(cacheKey, buffer);
  }
  return { buffer, cacheKey, cacheHit };
}

function pdfResponse(buffer: Buffer, headers: Record<string, string>) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      ...headers,
    },
  });
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
      consumeRateLimit(`pdf:${actor.userId}`, 60, 60_000);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return new NextResponse(error.message, { status: 429 });
      }
      throw error;
    }

    const { searchParams } = new URL(req.url);
    const cvId = searchParams.get('cvId');

    if (!cvId) {
      return new NextResponse('Missing cvId', { status: 400 });
    }

    const [cv] = await db
      .select(pdfCvColumns)
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
      const remaining = await guestHasPdfDownloadRemaining(actor.userId);
      if (!remaining) {
        return NextResponse.json(
          { error: 'GUEST_DOWNLOAD_LIMIT' },
          { status: 403 },
        );
      }
    }

    if (isDownload && actor.kind !== 'guest') {
      await createAuditLog('cv_download_pdf', actor.userId, actor.email, {
        cvId: cv.id,
        title: cv.title
      });
    }

    const pdfOptions: PdfOptions = {
      template: getAllowedCvTemplate(actor.subscriptionStatus, cv.templateName, {
        isGuest: actor.kind === 'guest',
      }),
      accentColor: cv.accentColor || '#1a5f7a',
      fontFamily: cv.fontFamily || 'helvetica',
      pageMargin: cv.pageMargin ?? 36,
      fontSize: (cv.scale ?? 1.0) * 12.5, // back-converting scale to fontSize
      showIcons: true
    };

    const { buffer, cacheKey, cacheHit } = await renderWithCache(cv.content, pdfOptions);
    const etag = `"${cacheKey.slice(0, 32)}"`;

    // Thumbnails and the editor preview pass `v=<updatedAt>`: the URL changes whenever the CV
    // changes, so the browser may keep that exact URL for a long time. Downloads stay uncached.
    const versioned = searchParams.has('v') && !isDownload;
    const cacheControl = isDownload
      ? 'no-store, max-age=0'
      : versioned
        ? 'private, max-age=31536000, immutable'
        : 'private, no-cache';

    if (!isDownload && req.headers.get('if-none-match') === etag) {
      log({ event: 'pdf_render', route: '/api/pdf', userId: actor.userId, cacheHit, notModified: true, durationMs: Date.now() - started });
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': cacheControl } });
    }

    log({
      event: 'pdf_render',
      route: '/api/pdf',
      userId: actor.userId,
      cacheHit,
      durationMs: Date.now() - started,
    });

    const userName = actor.kind === 'guest' ? (cv.title || 'CV') : (actor.name || 'User');
    const safeName = userName.replace(/[/\\?%*:|"<>]/g, '');
    const filename = `CV ${safeName}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    if (isDownload && actor.kind === 'guest') {
      await recordGuestPdfDownload(actor.userId, actor.email, {
        cvId: cv.id,
        title: cv.title,
      });
    }

    return pdfResponse(buffer, {
      'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': cacheControl,
      ETag: etag,
      Vary: 'Cookie',
    });
  } catch (error: any) {
    log({ event: 'pdf_render', level: 'error', route: '/api/pdf', error, durationMs: Date.now() - started });
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
      consumeRateLimit(`pdf:${actor.userId}`, 60, 60_000);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return new NextResponse(error.message, { status: 429 });
      }
      throw error;
    }

    const body = await req.json();
    const { content, template, accentColor, fontFamily, pageMargin, scale } = body;

    if (!content) {
      return new NextResponse('Missing content', { status: 400 });
    }

    const pdfOptions: PdfOptions = {
      template: getAllowedCvTemplate(actor.subscriptionStatus, template, {
        isGuest: actor.kind === 'guest',
      }),
      accentColor: accentColor || null,
      fontFamily: fontFamily || 'helvetica',
      pageMargin: pageMargin || 36,
      fontSize: (scale || 1.0) * 12.5,
      showIcons: true
    };
    const { buffer, cacheHit } = await renderWithCache(content, pdfOptions);

    log({
      event: 'pdf_preview',
      route: '/api/pdf',
      userId: actor.userId,
      cacheHit,
      durationMs: Date.now() - started,
    });

    return pdfResponse(buffer, {
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Cache-Control': 'no-store, max-age=0',
    });
  } catch (error: any) {
    log({ event: 'pdf_preview', level: 'error', route: '/api/pdf', error, durationMs: Date.now() - started });
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
