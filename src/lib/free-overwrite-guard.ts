export const OVERWRITE_UPGRADE_HREF = '/api/stripe/checkout?source=overwrite-guard';

export type OverwriteDecision =
  | { action: 'create' }
  | { action: 'confirm'; replacesBase: boolean }
  | { action: 'reuse' };

/**
 * Free accounts keep a single CV. Reuse is allowed only after an explicit confirm.
 * Guests and anyone who can still create a CV are not asked.
 */
export function decideFreeOverwrite(input: {
  isGuest: boolean;
  canCreate: boolean;
  replacesBase: boolean;
  confirmed: boolean;
}): OverwriteDecision {
  if (input.isGuest || input.canCreate) return { action: 'create' };
  if (!input.confirmed) return { action: 'confirm', replacesBase: input.replacesBase };
  return { action: 'reuse' };
}
