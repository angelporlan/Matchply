'use client';

import { Calendar, CheckCircle2, CreditCard, Crown, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NameForm from '@/components/account/NameForm';

interface AccountSettingsProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
  isPremium: boolean;
  memberSince?: string | null;
}

function Avatar({ image, name, email }: { image?: string | null; name: string; email: string }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || email}
        referrerPolicy="no-referrer"
        className="w-14 h-14 rounded-full object-cover border border-[#1e1b4b]/10 dark:border-white/10"
      />
    );
  }

  const parts = (name || email || '?').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : (name || email || '?').trim().slice(0, 2).toUpperCase();

  return (
    <span className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#1e1b4b] text-white font-bold flex items-center justify-center text-lg select-none">
      {initials}
    </span>
  );
}

export default function AccountSettings({ user, isPremium, memberSince }: AccountSettingsProps) {
  const { t, language } = useLanguage();

  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
        year: 'numeric',
        month: 'long',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Información personal */}
      <section className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-6 shadow-sm">
        <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider font-display border-b border-[#1e1b4b]/5 dark:border-white/5 pb-3 mb-5">
          {t('settings.account.personalTitle')}
        </h2>

        <div className="flex items-start gap-5">
          <Avatar image={user.image} name={user.name} email={user.email} />

          <div className="flex-1 min-w-0 space-y-5">
            <NameForm initialName={user.name} />

            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider font-display">
                {t('settings.account.emailLabel')}
              </span>
              <div className="flex items-center gap-2 bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5">
                <Mail className="w-4 h-4 text-[#1e1b4b]/40 dark:text-slate-500 stroke-[1.75] shrink-0" />
                <span className="flex-1 text-sm text-[#1e1b4b]/70 dark:text-slate-300 truncate font-sans">
                  {user.email}
                </span>
                <Lock className="w-3.5 h-3.5 text-[#1e1b4b]/30 dark:text-slate-600 stroke-[1.75] shrink-0" />
              </div>
              <p className="text-[10px] text-[#1e1b4b]/45 dark:text-slate-500 font-sans">
                {t('settings.account.emailHint')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plan */}
      <section className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 rounded-[12px] p-6 shadow-sm">
        <h2 className="text-sm font-bold text-[#1e1b4b] dark:text-white uppercase tracking-wider font-display border-b border-[#1e1b4b]/5 dark:border-white/5 pb-3 mb-5">
          {t('settings.account.planTitle')}
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 border ${
                isPremium
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                  : 'bg-[#1e1b4b]/5 dark:bg-white/5 border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/60 dark:text-slate-400'
              }`}
            >
              {isPremium ? (
                <Crown className="w-5 h-5 stroke-[1.75]" />
              ) : (
                <CreditCard className="w-5 h-5 stroke-[1.75]" />
              )}
            </span>
            <div>
              <p className="text-sm font-bold text-[#1e1b4b] dark:text-white font-display flex items-center gap-2">
                {isPremium ? t('settings.account.planPro') : t('settings.account.planFree')}
                {isPremium && (
                  <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 stroke-[1.75]" />
                    {t('settings.account.planActive')}
                  </span>
                )}
              </p>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans mt-0.5 max-w-md leading-relaxed">
                {isPremium ? t('settings.account.planProDesc') : t('settings.account.planFreeDesc')}
              </p>
              {memberSinceLabel && (
                <p className="text-[10px] text-[#1e1b4b]/45 dark:text-slate-500 font-sans mt-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 stroke-[1.75]" />
                  {t('settings.account.memberSince', { date: memberSinceLabel })}
                </p>
              )}
            </div>
          </div>

          <a
            href={isPremium ? '/api/stripe/portal' : '/dashboard/subscription'}
            className={`inline-flex items-center justify-center gap-2 font-bold px-5 py-2.5 rounded-[8px] text-xs transition-all shadow-sm font-display shrink-0 ${
              isPremium
                ? 'bg-[#1e1b4b] dark:bg-white dark:text-[#0b0f19] text-white hover:bg-[#1e1b4b]/95 dark:hover:bg-slate-100'
                : 'bg-[#2ecc71] hover:bg-[#29b765] text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 stroke-[1.75]" />
            {isPremium ? t('settings.account.manageBilling') : t('settings.account.upgrade')}
          </a>
        </div>
      </section>
    </div>
  );
}
