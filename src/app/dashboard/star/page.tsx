import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, prompts } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import StarClientPage from '@/components/star/StarClientPage';

export default async function StarMethodPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // 1. Obtener información del usuario para la suscripción
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 2. Obtener la lista de currículums del usuario (Principal primero)
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isPrincipal), desc(cvs.createdAt));

  // 3. Obtener los prompts de optimización STAR activos y no archivados
  const starPrompts = await db
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
        eq(prompts.key, 'star_optimize'),
        eq(prompts.isArchived, false)
      )
    )
    .orderBy(prompts.name);

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Glow backgrounds */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <StarClientPage 
          initialCvs={userCvs} 
          isPremium={isPremium} 
          availablePrompts={starPrompts || []}
          user={{
            name: session.user.name,
            email: session.user.email,
            role: dbUser?.role || 'user'
          }}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
