'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { runApplicationCommand } from '@/app/dashboard/applications/actions';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { ApplicationSummary } from '@/lib/job-offer-queries';

export default function FollowupCell({ offer }: { offer: ApplicationSummary }) {
  const { language } = useLanguage(); const es = language === 'es'; const router = useRouter();
  const [current, setCurrent] = useState(offer); const [date, setDate] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const command = useRef<{ signature: string; id: string }>();
  useEffect(() => { setCurrent(offer); }, [offer]);
  async function apply(action: 'complete' | 'postpone') {
    if (busy) return; setBusy(true); setError('');
    const signature = `${action}:${date}:${current.followupVersion}`;
    if (command.current?.signature !== signature) command.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await runApplicationCommand(offer.id, { action, version: current.followupVersion, commandId: command.current.id, ...(action === 'postpone' ? { nextFollowupDate: new Date(`${date}T12:00:00+01:00`) } : {}) });
      if ('error' in result) { setError(es ? 'Recarga y reintenta.' : 'Reload and retry.'); router.refresh(); return; }
      setCurrent(previous => ({ ...previous, ...result })); command.current = undefined; router.refresh();
    } catch { setError(es ? 'No se pudo guardar.' : 'Could not save.'); }
    finally { setBusy(false); }
  }
  if (!current.nextFollowupDate) return <span className="text-text-muted">—</span>;
  return <div className="max-w-52 space-y-1 text-xs" onClick={event => event.stopPropagation()}>
    <p className="font-medium">{new Date(current.nextFollowupDate).toLocaleDateString(es ? 'es-ES' : 'en-GB', { timeZone: 'Europe/Madrid' })}</p>
    {current.nextAction && <p className="whitespace-normal text-text-muted">{current.nextAction}</p>}
    <div className="flex flex-wrap items-start gap-x-3"><button type="button" disabled={busy} onClick={() => void apply('complete')} className="min-h-9 underline">{es ? 'Hecho' : 'Done'}</button>
      <details><summary className="flex min-h-9 cursor-pointer items-center underline">{es ? 'Posponer' : 'Postpone'}</summary><label className="block">{es ? 'Nueva fecha' : 'New date'}<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 block min-h-11 w-full rounded border border-control bg-surface px-1" /></label><button type="button" disabled={busy || !date} onClick={() => void apply('postpone')} className="min-h-11 underline">{es ? 'Guardar fecha' : 'Save date'}</button></details>
    </div>{error && <p role="alert" className="whitespace-normal text-danger-text">{error}</p>}
  </div>;
}
