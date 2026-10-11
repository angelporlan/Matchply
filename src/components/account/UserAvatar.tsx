'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function UserAvatar({ image, name, email, className }: {
  image?: string | null;
  name?: string | null;
  email?: string | null;
  className: string;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : source.slice(0, 2).toUpperCase();

  return <span className={`${className} rounded-full overflow-hidden border border-subtle bg-surface-muted text-text font-bold inline-flex items-center justify-center shrink-0 select-none`}>
    {image && image !== failedImage ? <Image
      unoptimized src={image} alt={name || email || ''} width={56} height={56}
      referrerPolicy="no-referrer" className="h-full w-full object-cover"
      onError={() => setFailedImage(image)}
    /> : initials}
  </span>;
}
