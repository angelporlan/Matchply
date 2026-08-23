import { NextResponse } from 'next/server';

/** Headers mínimos para que el service worker de la extensión pueda llamar a Matchply. */
export function extensionJson<T>(body: T, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function extensionOptions() {
  return extensionJson({ success: true });
}
