export class ImpersonationEndedError extends Error {
  readonly status = 409;
  readonly code = 'IMPERSONATION_ENDED';

  constructor(message = 'La sesión de soporte ha caducado o se ha revocado. Recarga la página.') {
    super(message);
    this.name = 'ImpersonationEndedError';
  }
}

export class ActorEpochMismatchError extends Error {
  readonly status = 409;
  readonly code = 'ACTOR_EPOCH_MISMATCH';

  constructor(message = 'El contexto de sesión cambió. Recarga la página.') {
    super(message);
    this.name = 'ActorEpochMismatchError';
  }
}

export class AccountSuspendedError extends Error {
  readonly status = 403;
  readonly code = 'ACCOUNT_SUSPENDED';

  constructor(message = 'Esta cuenta está suspendida.') {
    super(message);
    this.name = 'AccountSuspendedError';
  }
}

export class SupportActionBlockedError extends Error {
  readonly status = 403;
  readonly code = 'SUPPORT_ACTION_BLOCKED';

  constructor(message = 'Esta acción no está permitida durante una sesión de soporte.') {
    super(message);
    this.name = 'SupportActionBlockedError';
  }
}

export class AdminAuthorizationError extends Error {
  readonly status = 403;
  readonly code = 'ADMIN_UNAUTHORIZED';

  constructor(message = 'No autorizado. Debes ser administrador.') {
    super(message);
    this.name = 'AdminAuthorizationError';
  }
}

export class UnknownOptimizeModeError extends Error {
  readonly status = 400;
  readonly code = 'UNKNOWN_OPTIMIZE_MODE';

  constructor(message = 'El modo de optimización ya no es válido. Recarga la página para ver los modos actuales.') {
    super(message);
    this.name = 'UnknownOptimizeModeError';
  }
}

export class AiConfigConflictError extends Error {
  readonly status = 409;
  readonly code = 'AI_CONFIG_CONFLICT';

  constructor(message = 'Otro administrador ha guardado la configuración de IA. Recarga y vuelve a aplicar tus cambios.') {
    super(message);
    this.name = 'AiConfigConflictError';
  }
}
