'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil } from 'lucide-react';
import { optimizeAvatar } from '@/lib/people/optimize-avatar';
import PersonAvatar from './PersonAvatar';
import { usePeopleText } from './ui';

export default function PersonPhoto({ id, name, hash, onError }: { id: string; name: string; hash: string | null; onError: (code: string) => void }) {
  const tx = usePeopleText(), router = useRouter(), input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [uploadedHash, setUploadedHash] = useState<string>();
  useEffect(() => { setUploadedHash(undefined); }, [hash]);
  const label = uploadedHash || hash ? tx('Cambiar foto', 'Change photo') : tx('Subir foto', 'Upload photo');
  const helpId = `person-photo-help-${id}`;
  async function upload(file: File) {
    setBusy(true); onError(''); setSaved(false);
    try {
      const avatar = await optimizeAvatar(file);
      const response = await fetch(`/api/people/${id}/avatar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar }), signal: AbortSignal.timeout(30000) });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 429 ? 'PEOPLE_PHOTO_RATE_LIMIT' : result.error || 'PEOPLE_ACTION_FAILED');
      setUploadedHash(result.avatarHash); setSaved(true); router.refresh();
    } catch (e) { onError(e instanceof Error ? e.message : 'PEOPLE_ACTION_FAILED'); }
    finally { setBusy(false); }
  }
  return <div className="shrink-0">
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} aria-label={tx('Seleccionar foto de perfil', 'Select profile photo')} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file && !busy) void upload(file); }} />
    <button type="button" aria-label={busy ? tx('Optimizando y guardando foto', 'Optimizing and saving photo') : label} aria-describedby={helpId} aria-busy={busy || undefined} title={label} disabled={busy} onClick={() => input.current?.click()} className="group relative block h-14 w-14 rounded-full cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
      <PersonAvatar id={id} name={name} hash={uploadedHash || hash} size="lg" />
      <span aria-hidden="true" className={`absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white transition-opacity motion-reduce:transition-none ${busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <Pencil className="h-5 w-5" />}
      </span>
      {!busy && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 hidden h-5 w-5 place-items-center rounded-full border border-control bg-surface text-text [@media(hover:none)]:grid"><Pencil className="h-3 w-3" /></span>}
    </button>
    <p id={helpId} className="sr-only">{tx('JPG, PNG o WebP, hasta 10 MB. Recorte cuadrado y compresión automáticos.', 'JPG, PNG or WebP, up to 10 MB. Automatic square crop and compression.')}</p>
    {(busy || saved) && <p role="status" className="sr-only">{busy ? tx('Optimizando y guardando foto…', 'Optimizing and saving photo…') : tx('Foto optimizada y guardada.', 'Photo optimized and saved.')}</p>}
  </div>;
}
