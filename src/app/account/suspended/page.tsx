import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/request-context';
import { ButtonLink } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default async function SuspendedAccountPage() {
  const ctx = await getRequestContext();
  if (!ctx.realUser) redirect('/login');
  if (ctx.impersonation) redirect('/dashboard');
  if (ctx.realUser.accountStatus !== 'suspended') redirect('/dashboard');

  return (
    <main className="min-h-screen bg-canvas text-text flex items-center justify-center p-6">
      <div className="max-w-lg rounded-[12px] border border-subtle bg-surface p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold">Cuenta suspendida</h1>
        <p className="text-sm text-text-muted">
          Esta cuenta no puede usar el producto ni la extensión mientras esté suspendida.
          Puedes gestionar tu suscripción o cerrar sesión.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/api/stripe/portal">Gestionar suscripción</ButtonLink>
          <Link href="/logout" className="min-h-[44px] inline-flex items-center px-4 text-sm font-semibold underline">Cerrar sesión</Link>
        </div>
      </div>
    </main>
  );
}
