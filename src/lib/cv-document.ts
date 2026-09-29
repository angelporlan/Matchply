/** Resume markdown shared by the editable sheet and the PDF. No PDFKit. */

export interface ContactInfo {
  label: string;
  value: string;
}

export interface Entry {
  heading: string;
  subheading: string;
  date: string;
  paragraphs: string[];
  bullets: string[];
}

export interface Section {
  title: string;
  paragraphs: string[];
  entries: Entry[];
  bullets: string[];
}

export interface CVContent {
  name: string;
  contact: ContactInfo[];
  sections: Section[];
}

export function cleanMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

function normalizeLine(line: string): string {
  return line.replace(/\r/g, '').trimEnd();
}

function normalizeMarkdownLabel(text: string): string {
  if (/^\*\*([^*]+)\*\*/.test(text)) {
    const match = text.match(/^\*\*([^*]+)\*\*(.*)$/);
    if (match) {
      let label = match[1].trim();
      let value = match[2].trim();
      if (label.endsWith(':') || value.startsWith(':')) {
        if (label.endsWith(':')) label = label.slice(0, -1).trim();
        value = value.replace(/^[:\s]+/, '');
        return `**${label}**: ${value}`;
      }
    }
  }
  return text;
}

export function emptyDocument(): CVContent {
  return { name: '', contact: [], sections: [] };
}

export function parseCvDocument(content: string): CVContent {
  const lines = (content || '').split('\n').map(normalizeLine);
  const cv: CVContent = {
    name: '',
    contact: [],
    sections: [],
  };

  let currentSection: Section | null = null;
  let currentEntry: Entry | null = null;
  let currentParagraphs: string[] = [];

  function flushParagraphs(target: Section | Entry | null) {
    if (!currentParagraphs.length || !target) {
      currentParagraphs = [];
      return;
    }
    const rawParagraph = currentParagraphs.join(' ').trim();
    currentParagraphs = [];
    if (!rawParagraph) return;
    target.paragraphs.push(normalizeMarkdownLabel(rawParagraph));
  }

  function ensureSection(title: string): Section {
    const section: Section = { title: cleanMarkdownInline(title), paragraphs: [], entries: [], bullets: [] };
    cv.sections.push(section);
    currentEntry = null;
    currentParagraphs = [];
    return section;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === '---') {
      flushParagraphs(currentEntry || currentSection);
      continue;
    }

    if (line.startsWith('# ')) {
      cv.name = cleanMarkdownInline(line.slice(2)).replace(/^CV\s*--\s*/i, '').trim();
      continue;
    }

    if (!currentSection) {
      const parts = line.split('|');
      const parsedItems: ContactInfo[] = [];
      let isContactLine = false;
      for (const part of parts) {
        const match = part.trim().match(/^\*\*([^*]+):\*\*\s*(.+)$/);
        if (match) {
          isContactLine = true;
          parsedItems.push({
            label: cleanMarkdownInline(match[1]),
            value: cleanMarkdownInline(match[2]),
          });
        }
      }
      if (isContactLine) {
        cv.contact.push(...parsedItems);
        continue;
      }
    }

    if (line.startsWith('## ')) {
      flushParagraphs(currentEntry || currentSection);
      currentSection = ensureSection(line.slice(3));
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraphs(currentEntry || currentSection);
      currentEntry = { heading: cleanMarkdownInline(line.slice(4)), subheading: '', date: '', paragraphs: [], bullets: [] };
      currentSection?.entries.push(currentEntry);
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraphs(currentEntry || currentSection);
      const bullet = normalizeMarkdownLabel(line.slice(2).trim());
      if (currentEntry) currentEntry.bullets.push(bullet);
      else if (currentSection) currentSection.bullets.push(bullet);
      continue;
    }

    if (currentEntry && !currentEntry.subheading && line.includes('|')) {
      const parts = line.split('|');
      currentEntry.subheading = cleanMarkdownInline(parts[0]);
      currentEntry.date = cleanMarkdownInline(parts.slice(1).join('|'));
      continue;
    }

    if (line.startsWith('**') && line.endsWith('**') && currentEntry && !currentEntry.subheading) {
      currentEntry.subheading = cleanMarkdownInline(line);
      continue;
    }

    if (currentEntry && !currentEntry.date && !line.startsWith('**')) {
      currentEntry.date = cleanMarkdownInline(line);
      continue;
    }

    currentParagraphs.push(line);
  }

  flushParagraphs(currentEntry || currentSection);
  return cv;
}

export function serializeCvDocument(cv: CVContent): string {
  const lines: string[] = [`# ${cv.name.trim()}`, ''];
  if (cv.contact.length) {
    lines.push(cv.contact.map((item) => `**${item.label.trim()}:** ${item.value.trim()}`).join(' | '));
    lines.push('');
  }
  for (const section of cv.sections) {
    lines.push(`## ${section.title.trim()}`, '');
    for (const paragraph of section.paragraphs) {
      const text = paragraph.trim();
      if (text) lines.push(text, '');
    }
    for (const entry of section.entries) {
      lines.push(`### ${entry.heading.trim()}`);
      const company = entry.subheading.trim();
      const date = entry.date.trim();
      if (company && date) lines.push(`**${company}** | *${date}*`);
      else if (company) lines.push(`**${company}**`);
      else if (date) lines.push(date);
      lines.push('');
      for (const paragraph of entry.paragraphs) {
        const text = paragraph.trim();
        if (text) lines.push(text, '');
      }
      for (const bullet of entry.bullets) lines.push(`- ${bullet.trim()}`);
      if (entry.bullets.length) lines.push('');
    }
    for (const bullet of section.bullets) lines.push(`- ${bullet.trim()}`);
    if (section.bullets.length) lines.push('');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function inlineMarkdownToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function htmlToInlineMarkdown(html: string): string {
  const root = html
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/div>\s*<div>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return root.replace(/\s+/g, ' ').trim();
}
