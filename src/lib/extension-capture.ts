/** A middot or a lone period is a list separator, not a company name. */
export function isSeparatorLabel(value: unknown): boolean {
  const label = String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!label || label.length > 4) return false;
  return !/[0-9A-Za-z\u00C0-\u024F]/.test(label);
}

/** A saved separator company can be replaced when a later capture reads the real title and company. */
export function separatorCompanyCanTakeIdentity(
  existingCompany: string | null | undefined,
  incoming: { title?: string | null; company?: string | null },
) {
  const title = String(incoming.title || '').trim();
  const company = String(incoming.company || '').trim();
  if (!isSeparatorLabel(existingCompany)) return false;
  if (!title || !company || isSeparatorLabel(title) || isSeparatorLabel(company) || title === company) return false;
  return true;
}

/** A list capture stores the card only. A later open of that offer may fill the description. */
export function listStubCanTakeDescription(
  existing: { description?: string | null; sourceMetadata?: unknown },
  incoming: string | null,
) {
  const next = String(incoming || '').trim();
  if (next.length < 80) return false;
  const meta = existing.sourceMetadata && typeof existing.sourceMetadata === 'object' && !Array.isArray(existing.sourceMetadata)
    ? existing.sourceMetadata as Record<string, unknown>
    : {};
  if (meta.captureKind === 'list') return true;
  return !String(existing.description || '').trim();
}
