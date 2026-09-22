import { NextRequest, NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/request-context';
import { isGtmViewerAvailable } from '@/lib/gtm-access';
import { gtmFileKind, isGtmPreviewable } from '@/lib/gtm-format';
import {
  GTM_DOWNLOAD_MAX_BYTES,
  GTM_PREVIEW_MAX_BYTES,
  GtmWorkspaceError,
  readGtmFile,
} from '@/lib/gtm-workspace';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  if (!isGtmViewerAvailable(request.headers.get('host'))) return new NextResponse(null, { status: 404 });
  try {
    await requireAdminContext();
  } catch {
    return jsonError('No autorizado.', 403);
  }

  const params = request.nextUrl.searchParams;
  const source = params.get('source');
  const file = params.get('file');
  const runId = params.get('runId') || undefined;
  const download = params.get('download') === '1';
  if ((source !== 'canonical' && source !== 'run') || !file) {
    return jsonError('Referencia GTM incompleta.', 400);
  }

  try {
    const result = await readGtmFile({
      source,
      file,
      ...(runId ? { runId } : {}),
    });
    const kind = gtmFileKind(result.descriptor.path);
    if (download) {
      if (result.buffer.byteLength > GTM_DOWNLOAD_MAX_BYTES) {
        return jsonError('El archivo supera el tamaño máximo de descarga.', 413);
      }
      const safeName = result.descriptor.name.replace(/["\r\n]/g, '_');
      return new NextResponse(result.buffer, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${safeName}"`,
        },
      });
    }

    if (!isGtmPreviewable(kind) || result.buffer.byteLength > GTM_PREVIEW_MAX_BYTES) {
      return NextResponse.json({
        source: result.ref.source,
        runId: result.ref.runId || null,
        file: result.descriptor.path,
        kind,
        previewable: false,
        sizeBytes: result.descriptor.sizeBytes,
        modifiedAt: result.descriptor.modifiedAt,
        botName: result.botName,
        title: result.title,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({
      source: result.ref.source,
      runId: result.ref.runId || null,
      file: result.descriptor.path,
      kind,
      previewable: true,
      sizeBytes: result.descriptor.sizeBytes,
      modifiedAt: result.descriptor.modifiedAt,
      botName: result.botName,
      title: result.title,
      content: result.buffer.toString('utf8'),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof GtmWorkspaceError) {
      return jsonError(error.message, error.code === 'INVALID_REFERENCE' ? 400 : 404);
    }
    return jsonError('No se pudo leer el archivo GTM.', 500);
  }
}
