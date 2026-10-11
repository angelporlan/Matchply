'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { optimizeAvatarImage } from '@/lib/avatar/optimize';
import { PROFILE_PHOTO_LIMITS } from '@/lib/avatar/profile-limits';
import UserAvatar from './UserAvatar';

export default function ProfilePhoto({ image, name, email }: { image?: string | null; name: string; email: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const uploadInProgress = useRef(false);
  const [uploadedImage, setUploadedImage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setUploadedImage(undefined); }, [image]);
  const label = t(image || uploadedImage ? 'accountPhoto.change' : 'accountPhoto.upload');

  async function upload(file: File) {
    if (uploadInProgress.current) return;
    uploadInProgress.current = true;
    setBusy(true); setSaved(false); setError('');
    try {
      const avatar = await optimizeAvatarImage(file, PROFILE_PHOTO_LIMITS);
      const response = await fetch('/api/account/avatar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar }), signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json();
      if (!response.ok || typeof result.image !== 'string') throw new Error(result.error || 'PHOTO_SAVE_FAILED');
      setUploadedImage(result.image); setSaved(true);
      router.refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      const key = ({ PHOTO_FORMAT: 'formatError', PHOTO_SIZE: 'sizeError', PHOTO_DIMENSIONS: 'dimensionsError', PHOTO_INVALID: 'invalidError', PHOTO_RATE_LIMIT: 'rateLimitError' } as Record<string, string>)[code] || 'saveError';
      setError(t(`accountPhoto.${key}`));
    } finally { uploadInProgress.current = false; setBusy(false); }
  }

  return <div className="space-y-3">
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy}
      aria-label={t('accountPhoto.select')}
      onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void upload(file); }} />
    <div className="flex items-center gap-4">
      <button type="button" disabled={busy} onClick={() => input.current?.click()} title={label}
        aria-label={busy ? t('accountPhoto.saving') : label} aria-describedby="account-photo-help" aria-busy={busy || undefined}
        className="group relative block h-14 w-14 shrink-0 rounded-full cursor-pointer disabled:cursor-wait focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-focus focus-visible:outline-offset-[3px]">
        <UserAvatar image={uploadedImage || image} name={name} email={email} className="h-14 w-14 text-lg" />
        <span aria-hidden="true" className={`absolute inset-0 grid place-items-center rounded-full bg-black/60 text-white transition-opacity duration-150 motion-reduce:transition-none ${busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <Camera className="h-5 w-5" strokeWidth={1.75} />}
        </span>
        {!busy && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 hidden h-5 w-5 place-items-center rounded-full border border-control bg-surface text-text [@media(hover:none)]:grid"><Camera className="h-3 w-3" /></span>}
      </button>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">{t('accountPhoto.title')}</p>
        <p id="account-photo-help" className="text-xs text-text-muted">{t('accountPhoto.help')}</p>
        <p className="text-xs text-text-muted">{t('accountPhoto.kept')}</p>
      </div>
    </div>
    {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}
    {(busy || saved) && <p role="status" className="text-xs text-text-muted">{t(busy ? 'accountPhoto.saving' : 'accountPhoto.saved')}</p>}
  </div>;
}
