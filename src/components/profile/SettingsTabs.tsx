'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Terminal, UserCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { replaceUrlQuery } from '@/lib/client-url';
import { loadSettingsTabAction } from '@/app/dashboard/settings-actions';
import dynamic from 'next/dynamic';
import { ProfileTabsSkeleton } from '@/components/skeletons';

const CareerProfileForm = dynamic(() => import('@/components/profile/CareerProfileForm'), {
  ssr: false,
  loading: () => <ProfileTabsSkeleton />,
});
const AccountSettings = dynamic(() => import('@/components/profile/AccountSettings'));
const IntegrationsPanel = dynamic(() => import('@/components/subscription/IntegrationsPanel'));
import type {
  AccountSettingsPayload,
  IntegrationsSettingsPayload,
  ProfileSettingsPayload,
  SettingsTabPayload,
} from '@/lib/settings-data';

export type SettingsTab = 'profile' | 'integrations' | 'account';

const VALID_TABS: SettingsTab[] = ['profile', 'integrations', 'account'];

interface SettingsTabsProps {
  defaultTab?: SettingsTab;
  hideSensitiveTabs?: boolean;
  initialProfile?: ProfileSettingsPayload | null;
  initialIntegrations?: IntegrationsSettingsPayload | null;
  initialAccount?: AccountSettingsPayload | null;
}

export default function SettingsTabs({
  defaultTab = 'profile',
  hideSensitiveTabs = false,
  initialProfile = null,
  initialIntegrations = null,
  initialAccount = null,
}: SettingsTabsProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const readTab = (value: string | null): SettingsTab | null =>
    value && (VALID_TABS as string[]).includes(value) ? (value as SettingsTab) : null;

  const [activeTab, setActiveTab] = useState<SettingsTab>(readTab(searchParams.get('tab')) || defaultTab);
  const [profile, setProfile] = useState<ProfileSettingsPayload | null>(initialProfile);
  const [integrations, setIntegrations] = useState<IntegrationsSettingsPayload | null>(initialIntegrations);
  const [account, setAccount] = useState<AccountSettingsPayload | null>(initialAccount);
  const [loadingTab, setLoadingTab] = useState<SettingsTab | null>(null);

  useEffect(() => {
    const fromUrl = readTab(searchParams.get('tab'));
    if (fromUrl && fromUrl !== activeTab) {
      setActiveTab(fromUrl);
      void ensureTab(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const applyPayload = (payload: SettingsTabPayload) => {
    if (payload.tab === 'profile') setProfile(payload);
    if (payload.tab === 'integrations') setIntegrations(payload);
    if (payload.tab === 'account') setAccount(payload);
  };

  const cached = (tab: SettingsTab) => {
    if (tab === 'profile') return profile;
    if (tab === 'integrations') return integrations;
    return account;
  };

  const ensureTab = async (tab: SettingsTab) => {
    if (cached(tab) || loadingTab === tab) return;
    setLoadingTab(tab);
    const result = await loadSettingsTabAction(tab);
    if (!('error' in result)) applyPayload(result.data);
    setLoadingTab((current) => (current === tab ? null : current));
  };

  const selectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    replaceUrlQuery(pathname, params);
    void ensureTab(tab);
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'profile',
      label: t('settings.tabs.profile'),
      icon: <SlidersHorizontal className="w-4 h-4 stroke-[1.75]" />,
    },
    ...(!hideSensitiveTabs ? [
      {
        id: 'integrations' as const,
        label: t('settings.tabs.integrations'),
        icon: <Terminal className="w-4 h-4 stroke-[1.75]" />,
      },
      {
        id: 'account' as const,
        label: t('settings.tabs.account'),
        icon: <UserCircle className="w-4 h-4 stroke-[1.75]" />,
      },
    ] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b border-subtle pb-px gap-1 overflow-x-auto scrollbar-none" role="tablist">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              aria-selected={active}
              role="tab"
              className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all outline-none whitespace-nowrap font-display ${
                active
                  ? 'border-text dark:border-white text-text'
                  : 'border-transparent text-text-muted hover:text-text dark:hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        <section hidden={activeTab !== 'profile'} aria-hidden={activeTab !== 'profile'}>
          {profile ? (
            <CareerProfileForm
              initialProfile={profile.careerProfile as any}
              userCvs={profile.userCvs}
              baseCvContent={profile.baseCvContent}
            />
          ) : activeTab === 'profile' && loadingTab === 'profile' ? (
            <ProfileTabsSkeleton />
          ) : null}
        </section>
        {!hideSensitiveTabs && (
          <>
            <section hidden={activeTab !== 'integrations'} aria-hidden={activeTab !== 'integrations'}>
              {integrations ? (
                <IntegrationsPanel
                  isPremium={integrations.isPremium}
                  initialInstallations={integrations.installations}
                  initialQuota={integrations.quota}
                />
              ) : activeTab === 'integrations' && loadingTab === 'integrations' ? (
                <p className="text-sm text-text-muted font-sans" aria-busy="true">{t('settings.loadingTab')}</p>
              ) : null}
            </section>
            <section hidden={activeTab !== 'account'} aria-hidden={activeTab !== 'account'}>
              {account ? (
                <AccountSettings
                  user={account.user}
                  isPremium={account.isPremium}
                  memberSince={account.memberSince}
                />
              ) : activeTab === 'account' && loadingTab === 'account' ? (
                <p className="text-sm text-text-muted font-sans" aria-busy="true">{t('settings.loadingTab')}</p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
