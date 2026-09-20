import { NextResponse } from 'next/server';
import { requireProductContext } from '@/lib/request-context';
import { getCompanyIcon } from '@/lib/company-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireProductContext({ feature: 'applications' });
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const icon = await getCompanyIcon(params.id);
  if (!icon) {
    return new NextResponse(null, { status: 404 });
  }

  const requested = new URL(request.url).searchParams.get('v');
  if (requested && icon.iconHash && requested !== icon.iconHash) {
    return new NextResponse(null, { status: 404 });
  }

  const headers = new Headers({
    'Content-Type': icon.mime,
    'Content-Length': String(icon.byteSize),
    'Cache-Control': 'private, max-age=604800, immutable',
  });
  if (icon.iconHash) headers.set('ETag', `"${icon.iconHash}"`);

  return new NextResponse(Buffer.from(icon.bytes, 'base64'), { status: 200, headers });
}
