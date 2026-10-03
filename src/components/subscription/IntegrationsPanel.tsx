'use client';

import { Lock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ButtonLink } from '@/components/ui/Button';
import type { ApiTokenView } from '@/lib/agent-api/scopes';
import ApiKeysSettingsCard from './ApiKeysSettingsCard';
import LinkedInExtensionConsole from './LinkedInExtensionConsole';

type Installation = {
  id: string;
  tokenPrefix: string;
  extensionVersion: string | null;
  status: string;
  lastSeenAt: Date | null;
  lastCaptureAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

interface IntegrationsPanelProps {
  isPremium: boolean;
  initialInstallations: Installation[];
  initialQuota: { used: number; limit: number };
  initialApiTokens: ApiTokenView[];
}

export default function IntegrationsPanel({
  isPremium,
  initialInstallations,
  initialQuota,
  initialApiTokens,
}: IntegrationsPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <LinkedInExtensionConsole initialInstallations={initialInstallations} initialQuota={initialQuota} />
      {isPremium ? <ApiKeysSettingsCard initialTokens={initialApiTokens} /> : (
        <div className="bg-surface border border-subtle rounded-[12px] p-6 flex flex-wrap items-center gap-4">
          <Lock className="w-5 h-5 text-text-muted" />
          <p className="flex-1 text-sm text-text-muted">{t('subscription.integrations.badgePro')}: API</p>
          <ButtonLink href="/api/stripe/checkout" size="sm">{t('settings.account.upgrade')}</ButtonLink>
        </div>
      )}
    </div>
  );
}
