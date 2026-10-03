import { count, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { cvs, jobOffers } from '@/db/schema';
import { getDashboardViewer } from '@/lib/session';
import { resolveTryGate } from '@/lib/try-entry';
import TryEntry from './TryEntry';

export default async function TryPage() {
  const viewer = await getDashboardViewer();
  let cvCount = 0;
  let offerCount = 0;
  if (viewer) {
    const userId = viewer.user.id;
    const [[cvRow], [offerRow]] = await Promise.all([
      db.select({ value: count() }).from(cvs).where(eq(cvs.userId, userId)),
      db.select({ value: count() }).from(jobOffers).where(eq(jobOffers.userId, userId)),
    ]);
    cvCount = Number(cvRow?.value || 0);
    offerCount = Number(offerRow?.value || 0);
  }

  const gate = resolveTryGate({ hasViewer: Boolean(viewer), cvCount, offerCount });
  if (gate.kind === 'redirect') redirect(gate.href);
  return <TryEntry />;
}

export const dynamic = 'force-dynamic';
