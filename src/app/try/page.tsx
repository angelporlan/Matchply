import { db } from '@/db';
import { cvs, users, jobOffers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Sparkles, FileText, CreditCard, Crown } from 'lucide-react';
import DashboardClient from '@/app/dashboard/DashboardClient';
import Sidebar from '@/app/dashboard/Sidebar';
import { getActor } from '@/lib/actor';
import { AccountSuspendedError } from '@/lib/request-errors';
import { publicOptimizeModes } from '@/lib/optimize-modes';
import { guestHasPdfDownloadRemaining } from '@/lib/guest-pdf';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function TryPage() {
  let actor;
  try {
    actor = await getActor({ allowGuest: true });
  } catch (error) {
    if (error instanceof AccountSuspendedError) redirect('/account/suspended');
    throw error;
  }
  if (!actor) {
    redirect('/api/guest?redirect=/try');
  }
  const userId = actor.userId;
  const guestCanDownloadPdf = await guestHasPdfDownloadRemaining(userId);

  // 1. Obtener lista de currículums del usuario invitado
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt));

  const availablePrompts = publicOptimizeModes();

  const user = {
    name: 'Invitado',
    email: 'Prueba sin registro',
    role: 'user',
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={user} isPremium={false} isGuest={true} />
      <div className="flex-1 min-h-screen relative z-10 overflow-y-auto">
        {/* Background blur */}
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          {/* Banner calling for registration */}
          <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-[12px] bg-surface border border-subtle shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-[8px] bg-canvas text-text-muted dark:text-slate-300 border border-subtle">
                <Sparkles className="w-6 h-6 stroke-[1.75] text-ai" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display text-text flex items-center gap-2">
                  Prueba sin registro activa
                </h2>
                <p className="text-text-muted text-xs mt-1 font-light leading-relaxed max-w-xl font-sans">
                  Estás usando Matchply en modo invitado. Puedes importar tu CV, optimizarlo y descargar 1 PDF. Crea una cuenta para guardar la prueba y seguir descargando.
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className="w-full md:w-auto bg-action hover:bg-action-hover text-on-action font-bold px-6 py-3 rounded-[8px] text-sm transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 font-display text-center"
            >
              Guardar mi CV
            </Link>
          </div>

          <DashboardClient 
            initialCvs={userCvs} 
            cvTargets={[]} 
            isPremium={false} 
            isGuest={true} 
            guestCanDownloadPdf={guestCanDownloadPdf}
            availablePrompts={availablePrompts || []} 
          />
        </main>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
