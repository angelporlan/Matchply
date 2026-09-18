import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, cvs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import { getSessionUser } from '@/lib/session';
import { getResearchQuota } from '@/lib/research/queue';
import { listExtensionInstallations } from '@/lib/extension-auth';
import { getServerTranslations } from '@/lib/i18n/server';
import CareerProfileForm from '@/components/profile/CareerProfileForm';
import SettingsTabs from '@/components/profile/SettingsTabs';
import AccountSettings from '@/components/profile/AccountSettings';
import IntegrationsPanel from '@/components/subscription/IntegrationsPanel';
import { Sparkles } from 'lucide-react';

export default async function ProfileSettingsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }

  const userId = sessionUser.id;
  const { t } = getServerTranslations();
  const isPremium = isProSubscription(sessionUser.subscriptionStatus);

  // careerProfile (JSONB) y createdAt solo se necesitan en esta página.
  const [[profileRow], userCvs, [initialInstallations, initialQuota]] = await Promise.all([
    db
      .select({ careerProfile: users.careerProfile, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        id: cvs.id,
        title: cvs.title,
        isBase: cvs.isBase,
        isPrincipal: cvs.isPrincipal,
        content: cvs.content,
      })
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.createdAt)),
    isPremium
      ? Promise.all([listExtensionInstallations(userId), getResearchQuota(userId)])
      : Promise.resolve<[Awaited<ReturnType<typeof listExtensionInstallations>>, Awaited<ReturnType<typeof getResearchQuota>>]>(
        [[], { used: 0, limit: 10, periodStart: new Date() }],
      ),
  ]);

  const dbUser = { ...sessionUser, ...profileRow };

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background ambient glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        {/* Cabecera de Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ai/10 text-ai text-xs font-bold font-sans">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('settings.badge')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display">
              {t('settings.title')}
            </h1>
            <p className="text-xs sm:text-sm text-text-muted font-sans max-w-2xl">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>

        {/* Pestañas unificadas: Perfil & Criterios · Integraciones · Cuenta */}
        <Suspense
          fallback={
            <div className="h-24 rounded-[12px] border border-dashed border-subtle" />
          }
        >
          <SettingsTabs
            defaultTab="profile"
            profile={
              <CareerProfileForm
                initialProfile={dbUser?.careerProfile as any}
                userCvs={userCvs}
              />
            }
            integrations={
              <IntegrationsPanel
                isPremium={isPremium}
                initialInstallations={initialInstallations}
                initialQuota={initialQuota}
              />
            }
            account={
              <AccountSettings
                user={{
                  name: dbUser.name || '',
                  email: dbUser.email || '',
                  image: dbUser.image,
                }}
                isPremium={isPremium}
                memberSince={dbUser?.createdAt ? dbUser.createdAt.toISOString() : null}
              />
            }
          />
        </Suspense>
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
