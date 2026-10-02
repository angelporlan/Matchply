/** Local resume checks. Reads Markdown only; it does not score hireability. */

export const SUMMARY_WORD_GUIDE = 30;
export const SUMMARY_WORD_LIMIT = 45;

export type CvSectionChip = {
  id: string;
  kind: 'contact' | 'section';
  /** Plain section title. Empty for the contact preamble. */
  title: string;
};

export type CvReviewCode =
  | 'contact_ok'
  | 'contact_missing_email'
  | 'contact_missing_phone'
  | 'summary_ok'
  | 'summary_long'
  | 'summary_missing'
  | 'entry_no_bullets'
  | 'entry_date';

export type CvReviewIssue = {
  id: string;
  tone: 'ok' | 'warn';
  code: CvReviewCode;
  section?: string;
  entry?: string;
  words?: number;
};

type ParsedEntry = {
  heading: string;
  bullets: number;
  date: string | null;
};

type ParsedSection = {
  title: string;
  body: string[];
  entries: ParsedEntry[];
};

const SUMMARY_TITLE = /^(perfil( profesional)?|resumen( profesional)?|summary|professional summary|about( me)?|sobre mi|extracto)$/;
const EXPERIENCE_TITLE = /(experiencia|experience|proyecto|project)/;

function stripInline(value: string): string {
  return value.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '').trim();
}

function fold(value: string): string {
  return stripInline(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text: string): number {
  const plain = text.replace(/[*_`#[\]]/g, ' ').trim();
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

export function looksLikeDateRange(raw: string): boolean {
  const text = fold(raw);
  if (!text) return false;
  const years = text.match(/\b(19|20)\d{2}\b/g) ?? [];
  if (years.length === 0) return false;
  if (years.length >= 2) return true;
  const hasPresent = /\b(presente|actualidad|actual|present|current|now|hoy|ongoing)\b/.test(text);
  const hasSep = /[-–—/]|\bto\b|\bhasta\b|\buntil\b|\ba\b/.test(text);
  return hasPresent || hasSep;
}

function hasEmail(text: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

function hasPhone(text: string): boolean {
  const lines = text.split('\n');
  const labeled = lines.filter((line) => /(telefono|phone|movil|mobile|\btel\b)/.test(fold(line)));
  if (labeled.some((line) => (line.match(/\d/g) ?? []).length >= 6)) return true;
  const chunks = text.match(/(?:\+|00)\d[\d\s().-]{7,}\d|\d[\d\s().-]{8,}\d/g) ?? [];
  return chunks.some((chunk) => (chunk.match(/\d/g) ?? []).length >= 9);
}

function parseCv(markdown: string): { preamble: string; sections: ParsedSection[] } {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const preamble: string[] = [];
  const sections: ParsedSection[] = [];
  let section: ParsedSection | null = null;
  let entry: ParsedEntry | null = null;
  let inFence = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (trimmed.startsWith('# ')) continue;

    if (trimmed.startsWith('## ')) {
      section = { title: stripInline(trimmed.slice(3)), body: [], entries: [] };
      sections.push(section);
      entry = null;
      continue;
    }

    if (!section) {
      if (trimmed) preamble.push(rawLine);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      entry = { heading: stripInline(trimmed.slice(4)), bullets: 0, date: null };
      section.entries.push(entry);
      continue;
    }

    if (!trimmed || trimmed === '---') continue;

    if (/^[-*–]\s+/.test(trimmed)) {
      if (entry) entry.bullets += 1;
      else section.body.push(trimmed);
      continue;
    }

    if (entry) {
      if (entry.date === null && trimmed.includes('|')) {
        entry.date = stripInline(trimmed.split('|').slice(1).join('|'));
      } else if (entry.date === null && /\b(19|20)\d{2}\b/.test(trimmed)) {
        entry.date = stripInline(trimmed);
      }
      continue;
    }

    section.body.push(trimmed);
  }

  return { preamble: preamble.join('\n'), sections };
}

export function cvSectionChips(markdown: string): CvSectionChip[] {
  const { sections } = parseCv(markdown);
  return [
    { id: 'contact', kind: 'contact', title: '' },
    ...sections.map((section, index) => ({
      id: `section-${index}`,
      kind: 'section' as const,
      title: section.title || '—',
    })),
  ];
}

export function reviewCvMarkdown(markdown: string): CvReviewIssue[] {
  const { preamble, sections } = parseCv(markdown);
  const issues: CvReviewIssue[] = [];

  if (hasEmail(preamble)) {
    // email present; phone checked below
  } else {
    issues.push({ id: 'contact-email', tone: 'warn', code: 'contact_missing_email' });
  }
  if (!hasPhone(preamble)) {
    issues.push({ id: 'contact-phone', tone: 'warn', code: 'contact_missing_phone' });
  }
  if (hasEmail(preamble) && hasPhone(preamble)) {
    issues.push({ id: 'contact-ok', tone: 'ok', code: 'contact_ok' });
  }

  const summary = sections.find((section) => SUMMARY_TITLE.test(fold(section.title)));
  if (!summary) {
    issues.push({ id: 'summary-missing', tone: 'warn', code: 'summary_missing' });
  } else {
    const words = wordCount([...summary.body, ...summary.entries.flatMap((entry) => [entry.heading, entry.date ?? ''])].join(' '));
    if (words > SUMMARY_WORD_LIMIT) {
      issues.push({
        id: 'summary-long',
        tone: 'warn',
        code: 'summary_long',
        section: summary.title,
        words,
      });
    } else {
      issues.push({
        id: 'summary-ok',
        tone: 'ok',
        code: 'summary_ok',
        section: summary.title,
        words,
      });
    }
  }

  sections.forEach((section, sectionIndex) => {
    if (!EXPERIENCE_TITLE.test(fold(section.title))) return;
    if (SUMMARY_TITLE.test(fold(section.title))) return;
    section.entries.forEach((entry, entryIndex) => {
      const entryLabel = entry.heading || '—';
      if (entry.bullets === 0) {
        issues.push({
          id: `entry-bullets-${sectionIndex}-${entryIndex}`,
          tone: 'warn',
          code: 'entry_no_bullets',
          section: section.title,
          entry: entryLabel,
        });
      }
      if (!entry.date || !looksLikeDateRange(entry.date)) {
        issues.push({
          id: `entry-date-${sectionIndex}-${entryIndex}`,
          tone: 'warn',
          code: 'entry_date',
          section: section.title,
          entry: entryLabel,
        });
      }
    });
  });

  return issues;
}
