'use client';

import { useState } from 'react';
import {
  grantProAccessAction,
  reactivateUserAction,
  revokeProAccessAction,
  suspendUserAction,
  updateUserRoleAction,
} from '@/app/admin/users/actions';
import { startImpersonationAction } from '@/app/admin/impersonation/actions';
import { Button } from '@/components/ui/Button';

export default function UserAdminActions({
  userId,
  role,
  accountStatus,
  canImpersonate,
  hasGrant,
}: {
  userId: string;
  role: string;
  accountStatus: string;
  canImpersonate: boolean;
  hasGrant: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const defaultUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    const result = await fn();
    setMessage(result.success ? 'Hecho.' : result.error || 'Error');
  }

  return (
    <div className="rounded-[12px] border border-subtle bg-surface p-5 space-y-5">
      <h3 className="font-display font-semibold">Acciones de soporte</h3>
      {message && <p role="status" className="text-sm">{message}</p>}

      <form action={async (formData) => {
        const nextRole = formData.get('role') === 'admin' ? 'admin' : 'user';
        await run(() => updateUserRoleAction(userId, nextRole));
      }} className="flex flex-wrap gap-3 items-end">
        <label className="text-sm font-medium">Rol
          <select name="role" defaultValue={role} className="mt-1 min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">Cambiar rol</Button>
      </form>

      {accountStatus === 'suspended' ? (
        <form action={async (formData) => {
          await run(() => reactivateUserAction(userId, String(formData.get('reason') || '')));
        }} className="space-y-2">
          <label className="text-sm font-medium block">Motivo de reactivación
            <input name="reason" required minLength={8} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
          </label>
          <Button type="submit" variant="secondary">Reactivar</Button>
        </form>
      ) : (
        <form action={async (formData) => {
          await run(() => suspendUserAction(userId, String(formData.get('reason') || '')));
        }} className="space-y-2">
          <label className="text-sm font-medium block">Motivo de suspensión
            <input name="reason" required minLength={8} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
          </label>
          <Button type="submit" variant="danger">Suspender</Button>
        </form>
      )}

      <form action={async (formData) => {
        await run(() => grantProAccessAction(userId, String(formData.get('reason') || ''), String(formData.get('until') || '')));
      }} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Vencimiento Pro
          <input type="date" name="until" defaultValue={defaultUntil} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">Motivo de concesión
          <input name="reason" required minLength={8} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
        </label>
        <Button type="submit">Conceder Pro temporal</Button>
      </form>

      {hasGrant && (
        <form action={async (formData) => {
          await run(() => revokeProAccessAction(userId, String(formData.get('reason') || '')));
        }} className="space-y-2">
          <label className="text-sm font-medium block">Motivo para retirar concesión
            <input name="reason" required minLength={8} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
          </label>
          <Button type="submit" variant="secondary">Retirar concesión</Button>
        </form>
      )}

      <form action={async (formData) => {
        await startImpersonationAction(userId, String(formData.get('reason') || ''));
      }} className="space-y-2">
        <label className="text-sm font-medium block">Motivo de impersonación
          <input name="reason" required minLength={8} disabled={!canImpersonate} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
        </label>
        <Button type="submit" variant="secondary" disabled={!canImpersonate}>
          {canImpersonate ? 'Impersonar 30 minutos' : 'Impersonación no disponible'}
        </Button>
      </form>
    </div>
  );
}
