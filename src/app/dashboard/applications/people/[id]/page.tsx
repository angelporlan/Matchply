import { notFound, redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs } from '@/db/schema';
import { getDashboardViewer } from '@/lib/session';
import { getPerson, listThreads, personLinks } from '@/lib/people/service';
import { PeopleError } from '@/lib/people/types';
import PersonDetail from '@/components/people/PersonDetail';
export const dynamic = 'force-dynamic';
export default async function PersonPage({ params }: { params: { id: string } }) {
  const viewer = await getDashboardViewer();
  if (!viewer) redirect('/login');
  const u = viewer.user.id;
  try {
    const [person, links, threads, [job]] = await Promise.all([
      getPerson(u, params.id), personLinks(u, params.id), listThreads(u, params.id),
      db.select({ id: aiJobs.id }).from(aiJobs).where(and(eq(aiJobs.userId, u), eq(aiJobs.kind, 'networking'), sql`${aiJobs.payload}->>'personId' = ${params.id}`, sql`${aiJobs.status} in ('queued','running')`)).limit(1),
    ]);
    return <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><PersonDetail person={person} links={links} threads={threads} activeJobId={job?.id || null} /></main>;
  } catch (error) { if (error instanceof PeopleError) notFound(); throw error; }
}
