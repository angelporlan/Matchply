import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, jobOffers, prompts } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { Sparkles, Kanban, CreditCard, CheckCircle2, Crown, LogOut, Shield, FileText, PartyPopper } from 'lucide-react';
import { isProSubscription } from '@/lib/subscription';
import { stripe } from '@/lib/stripe';
import { syncStripeSubscription } from '@/lib/stripe-subscription-sync';
import DashboardClient from './DashboardClient';

interface DashboardPageProps {
  searchParams?: {
    checkout?: string;
    session_id?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  if (searchParams?.checkout === 'success' && searchParams.session_id) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(searchParams.session_id);
    if (
      checkoutSession.metadata?.userId === userId &&
      typeof checkoutSession.subscription === 'string'
    ) {
      const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription);
      await syncStripeSubscription(subscription);
    }
  }

  // 1. Obtener información actualizada del usuario de la base de datos
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 2. Obtener lista de currículums del usuario (Principal primero, luego más recientes)
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt));

  // 3. Contar candidaturas
  const offers = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId));

  const totalOffers = offers.length;
  const interviewOffers = offers.filter(o => o.status === 'interview').length;
  const successfulOffers = offers.filter(o => o.status === 'offer').length;

  // 4. Obtener prompts no archivados para optimización de CV
  const availablePrompts = await db
    .select({
      id: prompts.id,
      name: prompts.name,
      isActive: prompts.isActive,
    })
    .from(prompts)
    .where(
      and(
        eq(prompts.key, 'optimize_cv'),
        eq(prompts.isArchived, false)
      )
    )
    .orderBy(prompts.name);

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {!isPremium && (
          <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-[12px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-[8px] bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b]/70 dark:text-slate-300 border border-[#1e1b4b]/5 dark:border-white/5">
                <CreditCard className="w-6 h-6 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-2">
                  Hola, {session.user.name || 'Candidato'}
                </h2>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs mt-1 font-light leading-relaxed max-w-xl font-sans">
                  Estás en el Plan Gratuito. El motor de IA gratuito usa OpenRouter. Desbloquea plantillas profesionales e integraciones de IA avanzadas actualizando tu cuenta.
                </p>
              </div>
            </div>
            <a
              href="/api/stripe/checkout"
              className="w-full md:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold px-6 py-3 rounded-[8px] text-sm transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 font-display"
            >
              <Crown className="w-4 h-4" />
              Actualizar a Pro (10 €/mes)
            </a>
          </div>
        )}

        {/* Panel de Estadísticas Rápidas */}
        {isPremium && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 animate-fadeIn">
            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium font-sans">Postulaciones Activas</span>
                <h3 className="text-3xl font-bold font-display text-[#1e1b4b] dark:text-white mt-1">{totalOffers}</h3>
              </div>
              <div className="p-3 bg-[#8b5cf6]/10 text-[#8b5cf6] rounded-xl border border-[#8b5cf6]/10">
                <FileText className="w-5 h-5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium font-sans">En Proceso de Entrevista</span>
                <h3 className="text-3xl font-bold font-display text-amber-500 dark:text-amber-400 mt-1">{interviewOffers}</h3>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/10">
                <Sparkles className="w-5 h-5 stroke-[1.75]" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-medium font-sans flex items-center gap-1.5">
                  Ofertas Conseguidas <PartyPopper className="w-3.5 h-3.5 text-[#2ecc71]" />
                </span>
                <h3 className="text-3xl font-bold font-display text-[#2ecc71] mt-1">{successfulOffers}</h3>
              </div>
              <div className="p-3 bg-[#2ecc71]/10 text-[#2ecc71] rounded-xl border border-[#2ecc71]/10">
                <CheckCircle2 className="w-5 h-5 stroke-[1.75]" />
              </div>
            </div>
          </div>
        )}

        {/* Sección de Currículums */}
        <DashboardClient 
          initialCvs={userCvs} 
          isPremium={isPremium} 
          availablePrompts={availablePrompts || []} 
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
