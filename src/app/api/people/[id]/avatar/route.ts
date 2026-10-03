import { NextResponse } from 'next/server';
import { requireProductContext } from '@/lib/request-context';
import { getPersonAvatar } from '@/lib/people/avatar';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireProductContext({ feature: 'networking' });
    const avatar = await getPersonAvatar(ctx.effectiveUser!.id, params.id);
    const version = new URL(request.url).searchParams.get('v');
    if (!avatar || (version && version !== avatar.avatarHash)) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new NextResponse(Buffer.from(avatar.bytes, 'base64'), { headers: {
      'Content-Type': avatar.mime, 'Content-Length': String(avatar.byteSize),
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'", 'Vary': 'Cookie',
    } });
  } catch {
    return new NextResponse(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
}
