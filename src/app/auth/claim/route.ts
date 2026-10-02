import { auth } from '@/auth';
import { claimGuestDataForUser } from '@/lib/actor';
import { resolveClaimRedirect } from '@/lib/claim-destination';
import { buildAuthPath, getAuthIntent, safeInternalPath } from '@/lib/auth-intent';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth();
  const intent = getAuthIntent(req.nextUrl.searchParams);
  const nextPath = safeInternalPath(intent.next);
  const baseUrl = process.env.NEXTAUTH_URL || req.url;

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(buildAuthPath(intent, '/login'), baseUrl));
  }

  const claim = await claimGuestDataForUser(session.user.id);
  const destination = resolveClaimRedirect({
    claimed: claim.claimed,
    cvId: claim.cvId,
    nextPath,
  });
  return NextResponse.redirect(new URL(destination, baseUrl));
}

export const dynamic = 'force-dynamic';
