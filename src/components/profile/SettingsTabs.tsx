'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Terminal, UserCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export type SettingsTab = 'profile' | 'integrations' | 'account';

const VALID_TABS: SettingsTab[] = ['profile', 'integrations', 'account'];

interface SettingsTabsProps {
  defaultTab?: SettingsTab;
  profile: React.ReactNode;
  integrations: React.ReactNode;
  account: React.ReactNode;
}

export default function SettingsTabs({
  defaultTab = 'profile',
  profile,
  integrations,
  account,
}: SettingsTabsProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const readTab = (value: string | null): SettingsTab | null =>
    value && (VALID_TABS as string[]).includes(value) ? (value as SettingsTab) : null;

  const [activeTab, setActiveTab] = useState<SettingsTab>(readTab(searchParams.get('tab')) || defaultTab);

  useEffect(() => {
    const fromUrl = readTab(searchParams.get('tab'));
    if (fromUrl && fromUrl !== activeTab) {
      setActiveTab(fromUrl);
    }
  }, [searchParams]);

  const selectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'profile',
      label: t('settings.tabs.profile'),
      icon: <SlidersHorizontal className="w-4 h-4 stroke-[1.75]" />,
    },
    {
      id: 'integrations',
      label: t('settings.tabs.integrations'),
      icon: <Terminal className="w-4 h-4 stroke-[1.75]" />,
    },
    {
      id: 'account',
      label: t('settings.tabs.account'),
      icon: <UserCircle className="w-4 h-4 stroke-[1.75]" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Selector de pestañas */}
      <div className="flex border-b border-[#1e1b4b]/10 dark:border-white/5 pb-px gap-1 overflow-x-auto scrollbar-none">
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
                  ? 'border-[#1e1b4b] dark:border-white text-[#1e1b4b] dark:text-white'
                  : 'border-transparent text-[#1e1b4b]/45 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <div>
        {activeTab === 'profile' && profile}
        {activeTab === 'integrations' && integrations}
        {activeTab === 'account' && account}
      </div>
    </div>
  );
}
