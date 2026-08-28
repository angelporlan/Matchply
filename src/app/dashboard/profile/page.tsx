import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { users, cvs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import CareerProfileForm from '@/components/profile/CareerProfileForm';
import { Sparkles } from 'lucide-react';

export default async function ProfilePreferencesPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const userCvs = await db
    .select({
      id: cvs.id,
      title: cvs.title,
      isBase: cvs.isBase,
      isPrincipal: cvs.isPrincipal,
      content: cvs.content,
    })
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.createdAt));

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background ambient glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        {/* Cabecera de Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e1b4b]/10 dark:border-white/10 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] text-xs font-bold font-sans">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fuente de la Verdad para la IA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] dark:text-white font-display">
              Mi Perfil & Criterios de Búsqueda
            </h1>
            <p className="text-xs sm:text-sm text-[#1e1b4b]/60 dark:text-slate-400 font-sans max-w-2xl">
              Configura tu experiencia técnica, proyectos estrella y reglas de puntuación para que la IA evalúe ofertas de LinkedIn y adapte tus currículums con máxima precisión.
            </p>
          </div>
        </div>

        {/* Formulario de Perfil */}
        <CareerProfileForm
          initialProfile={dbUser?.mcpProfile as any}
          userCvs={userCvs}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
