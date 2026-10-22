'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { optimizeAvatarImage } from '@/lib/avatar/optimize';
import { PROFILE_PHOTO_LIMITS } from '@/lib/avatar/profile-limits';
import type { CvPhotoState } from '@/lib/cv-photo-types';

export function useCvPhoto(cvId: string, initial: CvPhotoState, disabled: boolean) {
  const { t } = useLanguage();
  const [photo, setPhoto] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const request = async (method: string, body?: object) => {
    const response = await fetch(`/api/cv/${cvId}/photo`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.code || result.error || 'PHOTO_SAVE_FAILED');
    setPhoto(result);
  };
  const act = async (fn: () => Promise<void>) => {
    if (disabled || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await fn(); }
    catch (error) {
      const code = error instanceof Error ? error.message : '';
      const key = ({ PHOTO_MISSING: 'missing', PHOTO_FORMAT: 'formatError', PHOTO_SIZE: 'sizeError', PHOTO_DIMENSIONS: 'dimensionsError', PHOTO_INVALID: 'invalidError', PHOTO_RATE_LIMIT: 'rateLimitError' } as Record<string, string>)[code];
      setError(key === 'missing' ? t('cvPhoto.missing') : key ? t(`accountPhoto.${key}`) : t('cvPhoto.saveError'));
    } finally { pending.current = false; setBusy(false); }
  };
  return {
    photo, busy, error, input, disabled,
    choose: () => { if (!disabled && !pending.current) input.current?.click(); },
    toggle: (enabled: boolean) => act(() => request('PATCH', { enabled })),
    reset: () => act(() => request('DELETE')),
    upload: (file: File) => act(async () => { const avatar = await optimizeAvatarImage(file, PROFILE_PHOTO_LIMITS); await request('POST', { avatar }); }),
  };
}

export function CvPhotoControl({ control }: { control: ReturnType<typeof useCvPhoto> }) {
  const { t } = useLanguage();
  return <div className="flex flex-wrap items-center gap-2 text-xs text-text">
    <input ref={control.input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={control.busy} aria-label={t('cvPhoto.select')}
      onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void control.upload(file); }} />
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-control/50 bg-canvas px-2.5 font-medium">
      <input type="checkbox" checked={control.photo.enabled} disabled={control.busy || control.disabled} onChange={event => void control.toggle(event.target.checked)} className="h-4 w-4 accent-text" aria-describedby={control.error ? 'cv-photo-error' : undefined} />
      {t('cvPhoto.include')}
    </label>
    <button type="button" onClick={control.choose} disabled={control.busy || control.disabled} className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" aria-busy={control.busy || undefined}>
      {control.busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Camera className="h-4 w-4" strokeWidth={1.75} />}
      {t(control.busy ? 'cvPhoto.saving' : control.photo.url ? 'cvPhoto.change' : 'cvPhoto.upload')}
    </button>
    {control.photo.source === 'custom' && <button type="button" disabled={control.busy || control.disabled} onClick={() => void control.reset()} className="min-h-11 rounded-md px-2 text-text-muted underline underline-offset-4 hover:text-text">{t('cvPhoto.useAccount')}</button>}
    {control.error && <p id="cv-photo-error" role="alert" className="w-full text-xs text-danger-text">{control.error}</p>}
  </div>;
}
