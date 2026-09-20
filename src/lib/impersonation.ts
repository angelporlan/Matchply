export const SUPPORT_COOKIE_NAME = 'mp_support';
export const ACTOR_EPOCH_HEADER = 'x-mp-actor-epoch';
export const SUPPORT_SESSION_TTL_MS = 30 * 60_000;
export const MIN_SUPPORT_REASON_LENGTH = 8;

export type ImpersonationTarget = {
  id: string;
  role: string;
  isGuest: boolean;
  accountStatus: string;
};

export type ImpersonationDenial =
  | 'disabled'
  | 'nested'
  | 'self'
  | 'admin'
  | 'guest'
  | 'suspended'
  | 'missing_reason';

export function impersonationDenial(
  actor: { id: string; role: string },
  target: ImpersonationTarget | null,
  options: {
    enabled: boolean;
    alreadyImpersonating: boolean;
    reason?: string | null;
  },
): ImpersonationDenial | null {
  if (!options.enabled) return 'disabled';
  if (options.alreadyImpersonating) return 'nested';
  const reason = options.reason?.trim() || '';
  if (reason.length < MIN_SUPPORT_REASON_LENGTH) return 'missing_reason';
  if (!target) return 'guest';
  if (target.id === actor.id) return 'self';
  if (target.role === 'admin') return 'admin';
  if (target.isGuest) return 'guest';
  if (target.accountStatus === 'suspended') return 'suspended';
  return null;
}

export function impersonationDenialMessage(code: ImpersonationDenial) {
  switch (code) {
    case 'disabled':
      return 'La impersonación está desactivada en esta instalación.';
    case 'nested':
      return 'Ya hay una sesión de soporte activa. Ciérrala antes de iniciar otra.';
    case 'self':
      return 'No puedes impersonarte a ti mismo.';
    case 'admin':
      return 'No se puede impersonar a otro administrador.';
    case 'guest':
      return 'No se puede impersonar una cuenta de invitado.';
    case 'suspended':
      return 'No se puede impersonar una cuenta suspendida.';
    case 'missing_reason':
      return 'Indica un motivo de al menos 8 caracteres.';
    default:
      return 'No se puede iniciar la sesión de soporte.';
  }
}

export function isSupportSessionActive(session: {
  expiresAt: Date;
  revokedAt: Date | null;
  endedAt: Date | null;
}, now = new Date()) {
  if (session.revokedAt || session.endedAt) return false;
  return session.expiresAt.getTime() > now.getTime();
}

export function actorEpochFor(supportSessionId: string | null | undefined) {
  return supportSessionId || 'self';
}
