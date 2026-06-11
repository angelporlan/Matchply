import { db } from '@/db';
import { cvs, users, jobOffers, prompts } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { Sparkles, FileText, CreditCard, Crown } from 'lucide-react';
import DashboardClient from '@/app/dashboard/DashboardClient';
import Sidebar from '@/app/dashboard/Sidebar';
import { getOrCreateGuestActor } from '@/lib/actor';
import Link from 'next/link';

export default async function TryPage() {
  const actor = await getOrCreateGuestActor();
  const userId = actor.userId;

  // 1. Obtener lista de currículums del usuario invitado
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt));

  // 2. Obtener prompts no archivados para optimización de CV
  const availablePrompts = await db
    .select({
      id: prompts.id,
      name: prompts.name,
      nameEn: prompts.nameEn,
      isActive: prompts.isActive,
      description: prompts.description,
      descriptionEn: prompts.descriptionEn,
      color: prompts.color,
    })
    .from(prompts)
    .where(
      and(
        eq(prompts.key, 'optimize_cv'),
        eq(prompts.isArchived, false)
      )
    )
    .orderBy(prompts.name);

  const user = {
    name: 'Invitado',
    email: 'Prueba sin registro',
    role: 'user',
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0b0f19] flex flex-col md:flex-row transition-colors duration-300 text-[#1e1b4b] dark:text-[#f3f4f6] font-sans">
      <Sidebar user={user} isPremium={false} isGuest={true} />
      <div className="flex-1 min-h-screen relative z-10 overflow-y-auto">
        {/* Background blur */}
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          {/* Banner calling for registration */}
          <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-[12px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-[8px] bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b]/70 dark:text-slate-300 border border-[#1e1b4b]/5 dark:border-white/5">
                <Sparkles className="w-6 h-6 stroke-[1.75] text-[#8b5cf6]" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-2">
                  Prueba sin registro activa
                </h2>
                <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs mt-1 font-light leading-relaxed max-w-xl font-sans">
                  Estás usando Matchply en modo invitado. Puedes importar tu CV con IA, optimizarlo y editarlo gratis. Regístrate para descargarlo y guardar tus cambios de forma permanente.
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className="w-full md:w-auto bg-[#2ecc71] hover:bg-[#29b765] text-white font-bold px-6 py-3 rounded-[8px] text-sm transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 font-display text-center"
            >
              Guardar mi CV
            </Link>
          </div>

          <DashboardClient 
            initialCvs={userCvs} 
            isPremium={false} 
            availablePrompts={availablePrompts || []} 
          />
        </main>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
