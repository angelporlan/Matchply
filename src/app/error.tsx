'use client';
import { useEffect, useState } from 'react';
import { reportClientError } from '@/lib/client-diagnostics';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { language } = useLanguage();
  const [reference, setReference] = useState('');
  useEffect(() => { setReference(reportClientError(error, 'page')); }, [error]);
  return <main className="mx-auto max-w-xl space-y-4 px-6 py-16 text-text">
    <h1 className="font-display text-xl font-semibold">{language === 'es' ? 'No se pudo abrir esta página' : 'We could not open this page'}</h1>
    <p className="text-sm text-text-muted">{language === 'es' ? 'Vuelve a intentarlo. Si continúa, comparte esta referencia con soporte.' : 'Try again. If this continues, share this reference with support.'}</p>
    {reference && <p className="break-all font-mono text-xs">ID: {reference}</p>}
    <button onClick={reset} className="min-h-11 rounded-lg bg-action px-4 py-2 font-semibold text-on-action">{language === 'es' ? 'Reintentar' : 'Retry'}</button>
  </main>;
}
