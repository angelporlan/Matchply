export type TryGate =
  | { kind: 'redirect'; href: '/api/guest?redirect=/try' | '/dashboard' }
  | { kind: 'entry' };

/** Guests with no draft stay on the single adapt screen. Anyone with a CV or candidacy goes to the dashboard. */
export function resolveTryGate(input: {
  hasViewer: boolean;
  cvCount: number;
  offerCount: number;
}): TryGate {
  if (!input.hasViewer) return { kind: 'redirect', href: '/api/guest?redirect=/try' };
  if (input.cvCount > 0 || input.offerCount > 0) return { kind: 'redirect', href: '/dashboard' };
  return { kind: 'entry' };
}

/** A direct /register with no account and no guest draft starts activation instead of an empty dashboard. */
export function coldRegisterDestination(input: {
  hasSession: boolean;
  hasGuestCookie: boolean;
}): '/try' | null {
  if (input.hasSession || input.hasGuestCookie) return null;
  return '/try';
}

const DEFAULT_UNTITLED_SECTION = 'Currículum';

function lettersOf(line: string): string {
  return line.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
}

function isHeadingLine(line: string): boolean {
  const letters = lettersOf(line);
  return letters.length >= 3
    && letters === letters.toLocaleUpperCase('es')
    && line.length <= 60
    && !line.includes('@');
}

function headingTitle(line: string): string {
  const lower = line.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
}

function isDateLine(line: string): boolean {
  return line.length <= 40 && /\b(19|20)\d{2}\b/.test(line);
}

function isBulletLine(line: string): boolean {
  return /^[-•·]\s*\S/.test(line);
}

function bulletText(line: string): string {
  return line.replace(/^[-•·]\s*/, '').trim();
}

/** A contact row the Harvard parser keeps above the first section. */
function contactMarkdown(line: string): string | null {
  const parts = line.split(/\s*[·|]\s*/).map((part) => part.trim()).filter(Boolean);
  const looksLikeContact = parts.length >= 2 || /@|linkedin|github|tel[eé]fono|email|ubicaci[oó]n|location/i.test(line);
  if (!looksLikeContact) return null;
  const items: string[] = [];
  for (const part of parts) {
    const match = part.match(/^([^:]{2,40}):\s*(.+)$/);
    if (!match) return null;
    items.push(`**${match[1].trim()}:** ${match[2].trim()}`);
  }
  return items.length ? items.join(' | ') : null;
}

function isShortOrg(line: string): boolean {
  return line.length > 0
    && line.length <= 60
    && !/[.!?]$/.test(line)
    && !isHeadingLine(line)
    && !isDateLine(line)
    && !isBulletLine(line);
}

type TrialBlock =
  | { kind: 'section'; title: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'entry'; role: string; org: string; date: string }
  | { kind: 'bullet'; text: string };

function nextContent(lines: string[], from: number): { line: string; index: number } | null {
  for (let index = from; index < lines.length; index += 1) {
    if (lines[index]) return { line: lines[index], index };
  }
  return null;
}

/**
 * Plain text and PDF extracts become template markdown.
 * A heading of "# CV" plus loose lines is dropped by the PDF parser, so the base looked empty.
 */
export function trialCvMarkdown(rawText: string, untitledSection = DEFAULT_UNTITLED_SECTION): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('#')) return trimmed;

  const lines = trimmed.split(/\n/).map((line) => line.trim());
  const first = lines.findIndex((line) => line.length > 0);
  if (first < 0) return '';

  const name = lines[first];
  let index = first + 1;
  const contacts: string[] = [];
  while (index < lines.length) {
    if (!lines[index]) break;
    const contact = contactMarkdown(lines[index]);
    if (!contact) break;
    contacts.push(contact);
    index += 1;
  }

  const blocks: TrialBlock[] = [];
  let paragraphOpen = false;

  const pushParagraph = (text: string) => {
    const last = blocks[blocks.length - 1];
    if (paragraphOpen && last?.kind === 'paragraph') last.text = `${last.text} ${text}`;
    else blocks.push({ kind: 'paragraph', text });
    paragraphOpen = true;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line) {
      paragraphOpen = false;
      index += 1;
      continue;
    }

    if (isHeadingLine(line)) {
      blocks.push({ kind: 'section', title: headingTitle(line) });
      paragraphOpen = false;
      index += 1;
      continue;
    }

    if (isBulletLine(line)) {
      blocks.push({ kind: 'bullet', text: bulletText(line) });
      paragraphOpen = false;
      index += 1;
      continue;
    }

    const last = blocks[blocks.length - 1];
    if (last?.kind === 'bullet' && /^[a-záéíóúüñ(]/.test(line)) {
      last.text = `${last.text} ${line}`;
      index += 1;
      continue;
    }

    const upcoming = nextContent(lines, index + 1);
    if (upcoming && isDateLine(upcoming.line) && !isDateLine(line)) {
      const afterDate = nextContent(lines, upcoming.index + 1);
      const org = afterDate && isShortOrg(afterDate.line) ? afterDate.line : '';
      blocks.push({ kind: 'entry', role: line, org, date: upcoming.line });
      paragraphOpen = false;
      index = (org && afterDate ? afterDate.index : upcoming.index) + 1;
      continue;
    }

    const skill = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (skill && line.length <= 200) {
      blocks.push({ kind: 'bullet', text: `**${skill[1].trim()}:** ${skill[2].trim()}` });
      paragraphOpen = false;
      index += 1;
      continue;
    }

    pushParagraph(line);
    index += 1;
  }

  if (!blocks.some((block) => block.kind === 'section')) {
    blocks.unshift({ kind: 'section', title: untitledSection.trim() || DEFAULT_UNTITLED_SECTION });
  }

  const out: string[] = [`# ${name}`, ''];
  if (contacts.length) out.push(contacts.join('\n'), '');
  for (const block of blocks) {
    if (block.kind === 'section') out.push(`## ${block.title}`, '');
    else if (block.kind === 'paragraph') out.push(block.text, '');
    else if (block.kind === 'entry') {
      out.push(`### ${block.role}`);
      out.push(block.org ? `**${block.org}** | *${block.date}*` : block.date, '');
    } else out.push(`- ${block.text}`);
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
