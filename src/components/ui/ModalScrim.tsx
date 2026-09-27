'use client';

import { useEffect, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/** Full-screen dialog veil. Portaled so it covers the sidebar, which lives in its own layer. */
export function ModalScrim({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className={cn('modal-scrim', className)} {...props}>
      {children}
    </div>,
    document.body,
  );
}
