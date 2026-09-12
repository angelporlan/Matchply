'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { updateUserNameAction } from '@/app/dashboard/actions';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface NameFormProps {
  initialName: string;
  onSaved?: (name: string) => void;
}

export default function NameForm({ initialName, onSaved }: NameFormProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    const result = await updateUserNameAction(value);

    if (!result || 'error' in result) {
      setError(
        result?.error === 'INVALID_NAME'
          ? t('sidebar.userMenu.nameError')
          : t('sidebar.userMenu.saveError'),
      );
      setIsSaving(false);
      return;
    }

    setName(result.name);
    setValue(result.name);
    setIsSaving(false);
    setJustSaved(true);
    onSaved?.(result.name);
    router.refresh();
    setTimeout(() => setJustSaved(false), 2500);
  };

  return (
    <div className="space-y-2">
      <label htmlFor="account-name" className="block text-[10px] font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider font-display">
        {t('settings.account.nameLabel')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="account-name"
          type="text"
          value={value}
          maxLength={60}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void save();
            }
          }}
          className="flex-1 bg-white dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/30 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-colors font-sans"
          placeholder={t('sidebar.userMenu.namePlaceholder')}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving || value.trim() === name}
          className="inline-flex items-center gap-1.5 bg-[#1e1b4b] dark:bg-white dark:text-[#0b0f19] hover:bg-[#1e1b4b]/95 dark:hover:bg-slate-100 text-white font-bold px-4 py-2.5 rounded-[8px] text-xs transition-all shadow-sm disabled:opacity-40 font-display"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5 stroke-[1.75]" />
          )}
          <span>{t('sidebar.userMenu.save')}</span>
        </button>
      </div>
      {error ? (
        <p className="text-[10px] text-rose-500 dark:text-rose-400 font-sans mt-1">{error}</p>
      ) : justSaved ? (
        <p className="text-[10px] text-emerald-500 font-sans mt-1">{t('sidebar.userMenu.saved')}</p>
      ) : null}
    </div>
  );
}
