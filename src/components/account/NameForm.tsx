'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { updateUserNameAction } from '@/app/dashboard/actions';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/Button';

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
      <label htmlFor="account-name" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider font-display">
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
          className="flex-1 bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai transition-colors font-sans"
          placeholder={t('sidebar.userMenu.namePlaceholder')}
        />
        <Button
          type="button"
          variant="strong"
          size="sm"
          onClick={() => void save()}
          disabled={isSaving || value.trim() === name}
          loading={isSaving}
          className="shrink-0"
        >
          {!isSaving && <Check className="w-3.5 h-3.5 stroke-[1.75]" />}
          <span>{t('sidebar.userMenu.save')}</span>
        </Button>
      </div>
      {error ? (
        <p className="text-[10px] text-rose-500 dark:text-rose-400 font-sans mt-1">{error}</p>
      ) : justSaved ? (
        <p className="text-[10px] text-emerald-500 font-sans mt-1">{t('sidebar.userMenu.saved')}</p>
      ) : null}
    </div>
  );
}
