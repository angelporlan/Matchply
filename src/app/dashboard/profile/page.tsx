import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/request-context';
import { getServerTranslations } from '@/lib/i18n/server';
import SettingsTabs, { type SettingsTab } from '@/components/profile/SettingsTabs';
import { Sparkles } from 'lucide-react';
import { timed } from '@/lib/logger';
import {
  loadAccountSettings,
  loadIntegrationsSettings,
  loadProfileSettings,
} from '@/lib/settings-data';

const VALID_TABS: SettingsTab[] = ['profile', 'integrations', 'account'];

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const ctx = await getRequestContext();
  const sessionUser = ctx.effectiveUser;
  if (!sessionUser) {
    redirect('/login');
  }
  if (ctx.impersonation && (searchParams?.tab === 'account' || searchParams?.tab === 'integrations')) {
    redirect('/dashboard/profile?tab=profile');
  }

  const requested = searchParams?.tab;
  const tab: SettingsTab = requested && (VALID_TABS as string[]).includes(requested)
    ? requested as SettingsTab
    : 'profile';
  const { t } = getServerTranslations();

  const initial = await timed('nav_queries', { route: '/dashboard/profile', tab }, async () => {
    if (tab === 'account' && !ctx.impersonation) {
      return { account: await loadAccountSettings(sessionUser), profile: null, integrations: null };
    }
    if (tab === 'integrations' && !ctx.impersonation) {
      return { integrations: await loadIntegrationsSettings(sessionUser), profile: null, account: null };
    }
    return { profile: await loadProfileSettings(sessionUser.id), account: null, integrations: null };
  });

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
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

        <SettingsTabs
          defaultTab={tab}
          hideSensitiveTabs={Boolean(ctx.impersonation)}
          initialProfile={initial.profile}
          initialIntegrations={initial.integrations}
          initialAccount={initial.account}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
