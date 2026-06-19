import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { users, cvs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import IntegrationsTabs from '@/components/subscription/IntegrationsTabs';

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Obtener información del usuario
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // Obtener CVs del usuario para la selección en el MCP
  const userCvs = await db
    .select({
      id: cvs.id,
      title: cvs.title,
      isBase: cvs.isBase,
      isPrincipal: cvs.isPrincipal,
    })
    .from(cvs)
    .where(eq(cvs.userId, userId));

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <IntegrationsTabs
          isPremium={isPremium}
          initialApiKey={dbUser?.apiKey || null}
          userCvs={userCvs}
          initialMcpCvId={dbUser?.mcpCvId || null}
          initialMcpProfile={dbUser?.mcpProfile as any}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';

