import { NextRequest, NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/request-context';
import { isGtmViewerAvailable } from '@/lib/gtm-access';
import { searchGtmWorkspace } from '@/lib/gtm-workspace';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isGtmViewerAvailable(request.headers.get('host'))) return new NextResponse(null, { status: 404 });
  try {
    await requireAdminContext();
  } catch {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (!query) return NextResponse.json({ results: [] }, { headers: { 'Cache-Control': 'no-store' } });
  if (query.length > 120) {
    return NextResponse.json({ error: 'La búsqueda es demasiado larga.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const results = await searchGtmWorkspace(query);
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo buscar en el workspace GTM.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
