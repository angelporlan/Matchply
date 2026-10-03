'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { deletePersonAction } from '@/app/dashboard/applications/people/actions';
import { setPeopleStatusAction } from '@/app/dashboard/applications/crm-actions';
import type { getPerson, listThreads, personLinks } from '@/lib/people/service';
import PersonForm from './PersonForm';
import PersonPhoto from './PersonPhoto';
import PersonLinks from './PersonLinks';
import Conversations from './Conversations';
import Assistant from './Assistant';
import { useNetworkingJob } from './useNetworkingJob';
import PersonStatusSelect from './PersonStatusSelect';
import { panel, errorLabel, usePeopleText } from './ui';

export default function PersonDetail({ person, threads, links, activeJobId }: { person: Awaited<ReturnType<typeof getPerson>>; threads: Awaited<ReturnType<typeof listThreads>>; links: Awaited<ReturnType<typeof personLinks>>; activeJobId: string | null }) {
  const tx = usePeopleText(), en = tx('es', 'en') === 'en', router = useRouter();
  const [tab, setTab] = useState('profile'), [threadId, setThread] = useState(threads[0]?.id || ''), [revision, setRevision] = useState(0), [deleting, setDeleting] = useState(false), [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState(person.status);
  const [statusSaving, setStatusSaving] = useState(false);
  const job = useNetworkingJob(person.id, activeJobId, () => { setRevision(v => v + 1); router.refresh(); });
  const tabs = [['profile', tx('Perfil', 'Profile')], ['conversations', tx('Conversaciones', 'Conversations')], ['assistant', tx('Asistente', 'Assistant')]];
  return <div className="space-y-6"><Link className="text-sm text-text-muted hover:text-text" href="/dashboard/applications/people">← {tx('Personas', 'People')}</Link><header className="flex flex-wrap gap-4 justify-between items-start"><div className="flex gap-4 items-center min-w-0"><PersonPhoto key={person.id} id={person.id} name={person.name} hash={person.avatarHash} onError={setError} /><div className="min-w-0"><h1 className="font-display text-2xl sm:text-3xl font-bold text-text break-words">{person.name}</h1><p className="text-sm text-text-muted mt-1 break-words">{person.role || person.headline || ''}</p><div className="flex flex-wrap items-center gap-2.5 mt-2"><PersonStatusSelect status={currentStatus} saving={statusSaving} onChange={async (newStatus) => { setStatusSaving(true); try { const r = await setPeopleStatusAction([person.id], newStatus); if ('error' in r) setError(r.error); else { setCurrentStatus(newStatus); router.refresh(); } } catch { setError('PEOPLE_ACTION_FAILED'); } finally { setStatusSaving(false); } }} />{person.nextFollowupAt ? <span className="text-xs text-text-muted">{tx('Seguimiento', 'Follow-up')}: {new Date(person.nextFollowupAt).toLocaleDateString(en ? 'en-GB' : 'es-ES')}</span> : null}</div></div></div><Button variant="danger" size="sm" loading={deleting} onClick={async () => { if (!window.confirm(tx('¿Eliminar esta persona y todos sus historiales y resultados de IA?', 'Delete this person and all conversation history and AI results?'))) return; setDeleting(true); try { const r = await deletePersonAction(person.id); if (r.error) { setError(r.error); setDeleting(false); } else { router.push('/dashboard/applications/people'); router.refresh(); } } catch { setError('PEOPLE_ACTION_FAILED'); setDeleting(false); } }}>{tx('Eliminar persona', 'Delete person')}</Button></header>
    <div role="tablist" aria-label={tx('Ficha de persona', 'Person details')} className="flex gap-2 border-b border-subtle pb-3 overflow-x-auto">{tabs.map(([key, label], i) => <button key={key} id={`tab-${key}`} role="tab" type="button" aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1} className={`px-4 py-2 rounded-[8px] text-sm font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ai ${tab === key ? 'bg-surface-muted text-text' : 'text-text-muted hover:text-text'}`} onClick={() => setTab(key)} onKeyDown={e => { let next = i; if (e.key === 'ArrowRight') next = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length; else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = tabs.length - 1; else return; e.preventDefault(); setTab(tabs[next][0]); document.getElementById(`tab-${tabs[next][0]}`)?.focus(); }}>{label}</button>)}</div>
    {job.busy && <p role="status" className="text-sm text-ai">{tx('La IA está trabajando. Puedes cambiar de pestaña; conservaremos la entrada.', 'AI is working. You can switch tabs; your input is preserved.')}</p>}{(job.error || error) && <p role="alert" className="text-sm text-danger">{errorLabel(job.error || error, en)}</p>}
    <div id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" hidden={tab !== 'profile'} className="space-y-6"><section className={panel}><PersonForm key={`${person.id}:${person.updatedAt.toISOString()}`} person={{ ...person, nextFollowupAt: person.nextFollowupAt?.toISOString().slice(0, 10) || null }} /></section><PersonLinks personId={person.id} links={links} /></div>
    <div id="panel-conversations" role="tabpanel" aria-labelledby="tab-conversations" hidden={tab !== 'conversations'}><Conversations personId={person.id} name={person.name} threads={threads} threadId={threadId} setThread={setThread} job={job} revision={revision} /></div>
    <div id="panel-assistant" role="tabpanel" aria-labelledby="tab-assistant" hidden={tab !== 'assistant'}><Assistant personId={person.id} threads={threads} links={links} threadId={threadId} setThread={setThread} job={job} revision={revision + person.updatedAt.getTime()} /></div>
  </div>;
}
