/** Count PDF page objects. Ignores the `/Pages` tree node. */
export function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g);
  return Math.max(1, matches?.length ?? 0);
}
