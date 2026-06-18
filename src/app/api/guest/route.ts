import { NextResponse } from 'next/server';
import { getOrCreateGuestActor } from '@/lib/actor';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get('redirect') || '/try';

  // Esto crea el actor y setea la cookie correctamente en un Route Handler
  await getOrCreateGuestActor();

  // Redirigir de vuelta
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
