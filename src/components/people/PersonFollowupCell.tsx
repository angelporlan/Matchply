'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { schedulePersonFollowupAction } from '@/app/dashboard/applications/people/actions';
import { errorLabel } from './ui';

export default function PersonFollowupCell({ id, name, date, en }: { id: string; name: string; date: string | null; en: boolean }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [scheduled, setScheduled] = useState<string | null>(null), busyRef = useRef(false);
  const link = useRef<HTMLAnchorElement>(null);
  const followup = date || scheduled;
  useEffect(() => { if (scheduled) link.current?.focus(); }, [scheduled]);

  async function schedule() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await schedulePersonFollowupAction(id);
      if ('error' in result) { setError(errorLabel(result.error!, en)); return; }
      if (result.data?.nextFollowupAt) setScheduled(new Date(result.data.nextFollowupAt).toISOString());
      router.refresh();
    } catch { setError(errorLabel('PEOPLE_ACTION_FAILED', en)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <div onClick={event => event.stopPropagation()} className="max-w-[16rem]">
    {followup ? <Link ref={link} href={`/dashboard/applications/people/${id}`} aria-label={`${en ? 'Edit follow-up' : 'Editar seguimiento'}: ${name}`} className="inline-flex min-h-11 items-center whitespace-nowrap text-sm text-text-muted underline decoration-dotted underline-offset-4 focus-visible:ring-2 focus-visible:ring-focus"><time dateTime={new Date(followup).toISOString()} title={new Date(followup).toLocaleString(en ? 'en-GB' : 'es-ES')}>{new Date(followup).toLocaleDateString(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</time></Link> :
      <button type="button" onClick={() => void schedule()} disabled={busy} aria-busy={busy} aria-label={`${en ? 'Follow up in 7 days' : 'Seguimiento en 7 días'}: ${name}`} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-info-text hover:bg-info-surface focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarPlus className="h-4 w-4" aria-hidden="true" />}{en ? 'In 7 days' : 'En 7 días'}</button>}
    {scheduled && <span role="status" className="sr-only">{en ? `Follow-up scheduled for ${name}.` : `Seguimiento programado para ${name}.`}</span>}
    {error && <p role="alert" className="mt-1 text-xs text-danger-text">{error}</p>}
  </div>;
}
