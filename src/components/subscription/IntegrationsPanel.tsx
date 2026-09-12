'use client';

import { ArrowRight, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
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
}

export default function IntegrationsPanel({
  isPremium,
  initialInstallations,
  initialQuota,
}: IntegrationsPanelProps) {
  const { t } = useLanguage();

  if (!isPremium) {
    return (
      <div className="relative bg-surface p-8 rounded-[12px] border border-subtle shadow-sm mt-8 overflow-hidden font-display">
        <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-ai/5 dark:bg-ai/8 rounded-full filter blur-[60px] pointer-events-none" />

        <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
          <div className="p-4 bg-ai/10 dark:bg-ai/15 border border-ai/20 rounded-2xl text-ai shrink-0">
            <Lock className="w-7 h-7 stroke-[1.75]" />
          </div>

          <div className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-ai bg-ai/10 border border-ai/35 px-2.5 py-0.5 rounded-full inline-block">
                {t('subscription.integrations.badgePro')}
              </span>
              <h3 className="text-lg font-bold text-text">
                {t('subscription.integrations.upsellTitle')}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed font-sans font-light max-w-xl">
                {t('subscription.integrations.upsellDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 font-sans font-light text-xs text-text-muted dark:text-slate-350">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ai shrink-0 stroke-[1.75]" />
                <span>{t('subscription.integrations.upsellFeature1')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ai shrink-0 stroke-[1.75]" />
                <span>{t('subscription.integrations.upsellFeature2')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ai shrink-0 stroke-[1.75]" />
                <span>{t('subscription.integrations.upsellFeature3')}</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="/api/stripe/checkout"
                className="inline-flex items-center gap-2 bg-ai-action hover:bg-ai-hover text-on-ai-action font-bold py-2.5 px-5 rounded-[8px] text-xs transition-all shadow-sm shadow-ai/10"
              >
                <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                {t('subscription.integrations.upsellCta')}
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <LinkedInExtensionConsole initialInstallations={initialInstallations} initialQuota={initialQuota} />;
}
