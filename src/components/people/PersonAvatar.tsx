'use client';
import { useState } from 'react';
import Image from 'next/image';
import { initials } from './ui';

export default function PersonAvatar({ id, name, hash, size = 'sm' }: { id: string; name: string; hash?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState('');
  const pixels = size === 'lg' ? 56 : size === 'md' ? 40 : 36;
  return <span className={`relative grid rounded-full bg-surface-muted text-text-muted place-items-center shrink-0 overflow-hidden ${size === 'lg' ? 'h-14 w-14 font-display text-lg' : size === 'md' ? 'h-10 w-10' : 'h-9 w-9'}`} aria-hidden="true">
    {hash && failed !== hash ? <Image unoptimized src={`/api/people/${id}/avatar?v=${hash}`} alt="" width={pixels} height={pixels} className="h-full w-full object-cover" onError={() => setFailed(hash)} /> : initials(name)}
  </span>;
}
