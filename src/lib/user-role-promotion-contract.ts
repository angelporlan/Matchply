export type UserRolePromotionPayload = {
  email: string;
  role: 'admin';
  reason: string;
};

export class UserRolePromotionError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'UserRolePromotionError';
  }
}

export function normalizeUserRolePromotionPayload(input: unknown): UserRolePromotionPayload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new UserRolePromotionError(400, 'Invalid payload');
  }

  const value = input as Record<string, unknown>;
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  const reason = typeof value.reason === 'string' ? value.reason.trim() : '';
  if (!email || email.length > 320 || !email.includes('@')) {
    throw new UserRolePromotionError(400, 'A valid email is required');
  }
  if (value.role !== 'admin') {
    throw new UserRolePromotionError(400, 'Only promotion to admin is supported');
  }
  if (reason.length < 8 || reason.length > 500) {
    throw new UserRolePromotionError(400, 'A reason between 8 and 500 characters is required');
  }

  return { email, role: 'admin', reason };
}
