import { NextResponse } from 'next/server';
import { getOrCreateGuestActor } from '@/lib/actor';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get('redirect') || '/try';

  // Esto crea el actor y setea la cookie correctamente en un Route Handler
  await getOrCreateGuestActor();

  // Redirigir de vuelta utilizando el host correcto para producción/desarrollo
  const host = request.headers.get('host') || 'matchply.com';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const redirectUrl = new URL(redirectTo, `${protocol}://${host}`);

  return NextResponse.redirect(redirectUrl);
}
