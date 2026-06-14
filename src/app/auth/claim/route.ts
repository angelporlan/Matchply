import { auth } from '@/auth';
import { claimGuestDataForUser } from '@/lib/actor';
import { NextRequest, NextResponse } from 'next/server';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  return value;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const nextPath = safeNextPath(req.nextUrl.searchParams.get('next'));
  const baseUrl = process.env.NEXTAUTH_URL || req.url;

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, baseUrl));
  }

  await claimGuestDataForUser(session.user.id);
  return NextResponse.redirect(new URL(nextPath, baseUrl));
}

export const dynamic = 'force-dynamic';
