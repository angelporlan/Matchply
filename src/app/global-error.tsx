'use client';
import { useEffect, useState } from 'react';
import { reportClientError } from '@/lib/client-diagnostics';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reference, setReference] = useState('');
  useEffect(() => { setReference(reportClientError(error, 'page')); }, [error]);
  return <html lang="es"><body><main style={{ maxWidth: 600, margin: '10vh auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
    <h1>No se pudo abrir la aplicación</h1>
    <p>Vuelve a intentarlo. Si el problema continúa, comparte esta referencia con soporte.</p>
    {reference && <p style={{ overflowWrap: 'anywhere' }}>ID: {reference}</p>}
    <button onClick={reset} style={{ minHeight: 44, padding: '8px 16px' }}>Reintentar</button>
  </main></body></html>;
}
