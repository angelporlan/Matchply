'use client';

import { stopImpersonationAction } from '@/app/admin/impersonation/actions';
import { Button } from '@/components/ui/Button';

export default function ImpersonationBanner({
  targetName,
  targetEmail,
  expiresAt,
}: {
  targetName: string | null;
  targetEmail: string;
  expiresAt: string;
}) {
  const expires = new Date(expiresAt);
  return (
    <div className="sticky top-0 z-50 border-b border-control bg-warning-surface text-warning-text">
      <div className="mx-auto flex min-h-[44px] max-w-7xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          Sesión de soporte: operas como <strong>{targetName || targetEmail}</strong>
          {' · '}vence {expires.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}
        </p>
        <form action={stopImpersonationAction}>
          <Button type="submit" variant="secondary" size="sm">Volver a administración</Button>
        </form>
      </div>
    </div>
  );
}
