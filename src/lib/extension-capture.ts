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
