import { createHash } from 'crypto';
import { CONVERSATION_MAX, PeopleError, type MessageInput, type ProposedMessage } from './types';
import { date } from './validation';

export function contentHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)).digest('hex'); }
export function conversationText(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > CONVERSATION_MAX || raw.includes('\u0000')) throw new PeopleError('PEOPLE_CONVERSATION_SIZE');
  return raw;
}
/** Keep offsets into the original, including very long lines. The model selects line numbers, not rewritten text. */
export function conversationChunks(raw: string, max = 18000) {
  const lines: Array<{ start: number; end: number; content: string }> = [];
  let cursor = 0;
  for (const part of raw.match(/[^\n]*(?:\n|$)/g) || []) {
    if (!part) continue;
    for (let offset = 0; offset < part.length; offset += max) {
      const end = Math.min(part.length, offset + max);
      lines.push({ start: cursor + offset, end: cursor + end, content: part.slice(offset, end) });
    }
    cursor += part.length;
  }
  const chunks: typeof lines[] = [];
  let chunk: typeof lines = []; let size = 0;
  for (const line of lines) {
    if ((size + line.content.length > max || chunk.length >= 500) && chunk.length) { chunks.push(chunk); chunk = []; size = 0; }
    chunk.push(line); size += line.content.length;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}
export function parseMessageRanges(raw: string, lines: ReturnType<typeof conversationChunks>[number], value: unknown): ProposedMessage[] {
  if (!Array.isArray(value) || !value.length || value.length > lines.length) throw new PeopleError('NETWORKING_INVALID_RESPONSE');
  let previousEnd = 0;
  return value.map(item => {
    if (!item || !Number.isInteger(item.startLine) || !Number.isInteger(item.endLine) || item.startLine < 1 || item.startLine <= previousEnd || item.endLine < item.startLine || item.endLine > lines.length || !['self', 'contact', 'unknown'].includes(item.author) || typeof item.uncertain !== 'boolean') throw new PeopleError('NETWORKING_INVALID_RESPONSE');
    previousEnd = item.endLine;
    const content = raw.slice(lines[item.startLine - 1].start, lines[item.endLine - 1].end).trim();
    if (!content) throw new PeopleError('NETWORKING_INVALID_RESPONSE');
    return { author: item.author, content, sentAt: date(item.sentAt)?.toISOString() || null, uncertain: item.uncertain || item.author === 'unknown' || !item.sentAt };
  });
}
function same(a: MessageInput, b: MessageInput) { return a.author === b.author && a.content === b.content && a.sentAt === b.sentAt; }
/** Mark contiguous overlaps for human review; never dedupe all messages by content. */
export function markOverlaps(existing: MessageInput[], proposed: ProposedMessage[]): ProposedMessage[] {
  const changes = new Int32Array(proposed.length + 1);
  let next = new Uint32Array(existing.length + 1);
  for (let p = proposed.length - 1; p >= 0; p--) {
    const row = new Uint32Array(existing.length + 1);
    for (let e = existing.length - 1; e >= 0; e--) {
      if (!same(existing[e], proposed[p])) continue;
      const length = row[e] = 1 + next[e + 1];
      if (length >= 2 || proposed[p].sentAt !== null) { changes[p]++; changes[p + length]--; }
    }
    next = row;
  }
  let matches = 0;
  return proposed.map((item, i) => { matches += changes[i]; return { ...item, overlap: matches > 0 }; });
}
