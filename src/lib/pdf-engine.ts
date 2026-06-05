import PDFDocument from 'pdfkit';
import path from 'path';

// Márgenes predeterminados
const PAGE_MARGIN = 36;
const COLORS = {
  text: '#000000',
  muted: '#555555',
  accent: '#000000',
  rule: '#000000'
};

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

interface FontSet {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
}

const FONT_FAMILIES: Record<string, FontSet> = {
  helvetica: { regular: 'Custom-Helvetica', bold: 'Custom-Helvetica-Bold', italic: 'Custom-Helvetica-Oblique', boldItalic: 'Custom-Helvetica-BoldOblique' },
  times: { regular: 'Custom-Times-Roman', bold: 'Custom-Times-Bold', italic: 'Custom-Times-Italic', boldItalic: 'Custom-Times-BoldItalic' },
  courier: { regular: 'Custom-Courier', bold: 'Custom-Courier-Bold', italic: 'Custom-Courier-Oblique', boldItalic: 'Custom-Courier-BoldOblique' }
};

interface CustomizeOptions {
  fontFamily: FontSet;
  pageMargin: number;
  accentColor: string | null;
}

function buildCustomize(options: any): CustomizeOptions {
  const fontFamily = FONT_FAMILIES[options.fontFamily] || FONT_FAMILIES.helvetica;
  const pageMargin = Number(options.pageMargin) || PAGE_MARGIN;
  const accentColor = options.accentColor || null;
  return { fontFamily, pageMargin, accentColor };
}

const BASE_LAYOUT = {
  nameSize: 20,
  contactSize: 8.5,
  sectionSize: 11,
  headingSize: 10,
  metaSize: 9,
  bodySize: 9,
  bulletSize: 9,
  lineGap: 1.5,
  sectionGap: 0.5,
  paragraphGap: 0.2,
  bulletGap: 0.15,
  entryGap: 0.4
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getFontScale(fontSize: any): number {
  const numeric = Number(fontSize);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return clamp(numeric / 12.5, 0.75, 1.8);
}

function buildLayout(scale: number) {
  const layout = { ...BASE_LAYOUT };
  for (const [key, value] of Object.entries(BASE_LAYOUT)) {
    layout[key as keyof typeof BASE_LAYOUT] = value * scale;
  }
  return layout;
}

const MODERN_CONFIG = {
  sidebarWidth: 175,
  sidebarColor: '#1a5f7a', // Petroleum Blue
  accentColor: '#1a5f7a',
  sidebarPadding: 22,
  mainPadding: 25,
  sidebarTextColor: '#ffffff',
  sidebarMutedColor: '#d1d5db',
  lineColor: '#e5e7eb'
};

const MINIMAL_CONFIG = {
  marginTop: 55,
  marginSide: 60,
  nameColor: '#2d2d2d',
  textColor: '#3a3a3a',
  mutedColor: '#888888',
  ruleColor: '#e0e0e0',
  accentColor: '#555555'
};

const CREATIVE_CONFIG = {
  sidebarWidth: 170,
  sidebarColorTop: '#6C3483',
  sidebarColorBottom: '#C2185B',
  accentColor: '#8E24AA',
  sidebarPadding: 18,
  mainPadding: 28,
  sidebarTextColor: '#ffffff',
  sidebarMutedColor: '#e0c8f0',
  mainTextColor: '#333333',
  mainMutedColor: '#777777',
  lineColor: '#eeeeee'
};

const SWISS_CONFIG = {
  sidebarWidth: 150,
  sidebarColor: '#1a1a1a',
  accentColor: '#E63946',
  sidebarPadding: 16,
  mainPadding: 28,
  sidebarTextColor: '#f0f0f0',
  sidebarMutedColor: '#aaaaaa',
  mainTextColor: '#222222',
  mainMutedColor: '#666666',
  lineColor: '#cccccc'
};

const SVG_ICONS: Record<string, string> = {
  linkedIn: 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  web: 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  email: 'M0 3v18h24v-18h-24zm6.623 7.929l-4.623 5.712v-9.458l4.623 3.746zm-4.141-5.929h19.035l-9.517 7.713-9.518-7.713zm5.694 7.188l3.824 3.099 3.83-3.104 5.612 8.817h-18.779l5.513-8.812zm9.208-1.264l4.616-3.741v9.348l-4.616-5.607z',
  phone: 'M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.75-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z',
  location: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
};

function normalizeLine(line: string): string {
  return line.replace(/\r/g, '').trimEnd();
}

function isSkillsSection(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes('skills') || t.includes('habilidades') || t.includes('aptitudes') || t.includes('competencias') || t.includes('habilidad') || t.includes('aptitud');
}

function getIconType(label: string, value: string = ''): string | null {
  const nl = label.toLowerCase();
  const nv = value.toLowerCase();
  if (nl.includes('linkedin')) return 'linkedIn';
  if (nl.includes('github')) return 'github';
  if (nl.includes('portfolio') || nl.includes('web') || nv.includes('http')) return 'web';
  if (nl.includes('phone') || nl.includes('teléfono') || /^\+?[0-9\s-]{7,}$/.test(nv)) return 'phone';
  if (nl.includes('email') || nl.includes('correo') || nv.includes('@')) return 'email';
  if (nl.includes('location') || nl.includes('ubicación')) return 'location';
  return null;
}

function getLinkUrl(value: string, label: string = ''): string | null {
  const v = value.trim();
  const l = label.toLowerCase();
  
  if (v.includes('@') || l.includes('email') || l.includes('correo')) {
    const email = v.replace(/^mailto:/i, '');
    return `mailto:${email}`;
  }
  
  if (v.startsWith('http://') || v.startsWith('https://')) {
    return v;
  }
  
  if (
    v.includes('linkedin.com') || 
    v.includes('github.com') || 
    v.includes('vercel.app') ||
    v.includes('.com') ||
    v.includes('.net') ||
    v.includes('.org') ||
    v.includes('.app') ||
    v.includes('.dev') ||
    v.includes('.es')
  ) {
    return `https://${v}`;
  }
  
  return null;
}

function drawIcon(doc: any, type: string, x: number, y: number, size: number, color: string = '#000000'): boolean {
  const p = SVG_ICONS[type];
  if (!p) return false;
  doc.save().translate(x, y).scale(size / 24).path(p).fill(color).restore();
  return true;
}

function cleanMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

function normalizeMarkdownLabel(text: string): string {
  if (/^\*\*([^*]+)\*\*/.test(text)) {
    const match = text.match(/^\*\*([^*]+)\*\*(.*)$/);
    if (match) {
      let label = match[1].trim();
      let value = match[2].trim();
      
      if (label.endsWith(':') || value.startsWith(':')) {
        if (label.endsWith(':')) {
          label = label.slice(0, -1).trim();
        }
        value = value.replace(/^[:\s]+/, '');
        return `**${label}**: ${value}`;
      }
    }
  }
  return text;
}

function drawMarkdownText(
  doc: any,
  text: string,
  startX: number | null,
  startY: number | null,
  width: number,
  cust: CustomizeOptions,
  layout: any,
  options: any = {}
) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const size = options.size || layout?.bodySize || 9;
  const color = options.color || COLORS.text;
  const align = options.align || 'left';
  const lineGap = options.lineGap ?? layout?.lineGap ?? 1.5;
  const continued = options.continued || false;

  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  const activeParts = parts.filter(part => part !== '');

  if (activeParts.length === 0) {
    return;
  }

  activeParts.forEach((part, index) => {
    let currentFont = ff.regular;
    let cleanText = part;

    if (part.startsWith('**') && part.endsWith('**')) {
      currentFont = ff.bold;
      cleanText = part.substring(2, part.length - 2);
    } else if (part.startsWith('*') && part.endsWith('*')) {
      currentFont = ff.italic;
      cleanText = part.substring(1, part.length - 1);
    }

    doc.font(currentFont).fontSize(size).fillColor(color);

    const isLastPart = index === activeParts.length - 1;
    const partContinued = !isLastPart || continued;

    const textOpts: any = {
      width,
      align,
      lineGap,
      continued: partContinued
    };

    if (startX !== null && startY !== null && index === 0) {
      doc.text(cleanText, startX, startY, textOpts);
    } else {
      doc.text(cleanText, textOpts);
    }
  });
}

function slugifyFile(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function parseCvMarkdown(content: string): CVContent {
  const lines = content.split('\n').map(normalizeLine);
  const cv: CVContent = {
    name: 'Curriculum Vitae',
    contact: [],
    sections: []
  };

  let currentSection: Section | null = null;
  let currentEntry: Entry | null = null;
  let currentParagraphs: string[] = [];

  function flushParagraphs(target: any) {
    if (!currentParagraphs.length || !target) {
      currentParagraphs = [];
      return;
    }

    const rawParagraph = currentParagraphs.join(' ').trim();
    if (!rawParagraph) {
      currentParagraphs = [];
      return;
    }

    const paragraph = normalizeMarkdownLabel(rawParagraph);

    if (!target.paragraphs) {
      target.paragraphs = [];
    }

    target.paragraphs.push(paragraph);
    currentParagraphs = [];
  }

  function ensureSection(title: string): Section {
    const sec: Section = {
      title: cleanMarkdownInline(title),
      paragraphs: [],
      entries: [],
      bullets: []
    };
    cv.sections.push(sec);
    currentEntry = null;
    currentParagraphs = [];
    return sec;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line === '---') {
      flushParagraphs(currentEntry || currentSection);
      continue;
    }

    if (line.startsWith('# ')) {
      cv.name = cleanMarkdownInline(line.slice(2)).replace(/^CV\s*--\s*/i, '').trim() || cv.name;
      continue;
    }

    if (!currentSection) {
      const parts = line.split('|');
      let isContactLine = false;
      const parsedItems: ContactInfo[] = [];
      
      for (const part of parts) {
        const match = part.trim().match(/^\*\*([^*]+):\*\*\s*(.+)$/);
        if (match) {
          isContactLine = true;
          parsedItems.push({
            label: cleanMarkdownInline(match[1]),
            value: cleanMarkdownInline(match[2])
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
      currentEntry = {
        heading: cleanMarkdownInline(line.slice(4)),
        subheading: '',
        date: '',
        paragraphs: [],
        bullets: []
      };
      if (currentSection) {
        currentSection.entries.push(currentEntry);
      }
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraphs(currentEntry || currentSection);
      const content = line.slice(2).trim();
      
      const bullet = normalizeMarkdownLabel(content);
      
      if (currentEntry) {
        currentEntry.bullets.push(bullet);
      } else if (currentSection) {
        currentSection.bullets.push(bullet);
      }
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

// ==========================================
// TEMPLATE: HARVARD (DEFAULT CLASSIC)
// ==========================================

function drawSmallCapsText(doc: any, text: string, x: number, y: number, baseSize: number, fontBold: string, color: string) {
  doc.y = y;
  doc.font(fontBold).fontSize(baseSize).fillColor(color);
  doc.text(text.toUpperCase(), x, y, { lineBreak: false });
  doc.fontSize(baseSize);
  doc.y = y + baseSize + 2;
}

function drawSectionHeading(doc: any, title: string, layout: any, cust: CustomizeOptions) {
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = 595.28 - margin * 2;
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const accent = cust.accentColor || COLORS.accent;

  doc.moveDown(layout.sectionGap);

  const startY = doc.y;
  drawSmallCapsText(doc, title, margin, startY, layout.sectionSize, ff.bold, accent);

  const ruleY = doc.y + 2.5;
  doc.moveTo(margin, ruleY)
    .lineTo(margin + cWidth, ruleY)
    .strokeColor(accent)
    .lineWidth(1.5)
    .stroke();

  doc.y = ruleY + 4.5;
}

function drawParagraph(doc: any, text: string, layout: any, options: any = {}, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = 595.28 - margin * 2;
  const size = options.size || layout.bodySize;
  const color = options.color || COLORS.text;
  const gap = options.gap ?? layout.paragraphGap;
  const align = options.align || 'left';

  drawMarkdownText(doc, text, margin, doc.y, cWidth, cust, layout, {
    size,
    color,
    align,
    lineGap: layout.lineGap
  });

  doc.moveDown(gap);
}

function drawBullet(doc: any, text: string, layout: any, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = 595.28 - margin * 2;

  const bulletX = margin + 8;
  const textX = margin + 18;
  const startY = doc.y;

  doc.font(ff.regular)
    .fontSize(layout.bulletSize)
    .fillColor(COLORS.text)
    .text('\u2022', bulletX, startY);

  drawMarkdownText(doc, text, textX, startY, cWidth - 18, cust, layout, {
    size: layout.bodySize,
    color: COLORS.text,
    align: 'left',
    lineGap: layout.lineGap
  });

  doc.moveDown(layout.bulletGap);
}

function drawEntry(doc: any, entry: Entry, layout: any, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = 595.28 - margin * 2;

  const startY = doc.y;

  doc.font(ff.bold)
    .fontSize(layout.headingSize)
    .fillColor(COLORS.text)
    .text(entry.heading, margin, startY, {
      width: cWidth * 0.7
    });

  if (entry.date) {
    doc.font(ff.regular)
      .fontSize(layout.metaSize)
      .fillColor(COLORS.muted)
      .text(entry.date, margin, startY, {
        width: cWidth,
        align: 'right'
      });
  }

  if (entry.subheading) {
    doc.y += 1;
    doc.font(ff.italic)
      .fontSize(layout.metaSize)
      .fillColor(COLORS.text)
      .text(entry.subheading, margin, doc.y, {
        width: cWidth
      });
  }

  doc.moveDown(0.15);

  for (const paragraph of entry.paragraphs || []) {
    drawParagraph(doc, paragraph, layout, { gap: layout.paragraphGap }, cust);
  }

  for (const bullet of entry.bullets || []) {
    drawBullet(doc, bullet, layout, cust);
  }

  doc.moveDown(layout.entryGap);
}

function drawContactLines(doc: any, contact: ContactInfo[], layout: any, showIcons: boolean, cust: CustomizeOptions) {
  if (!contact.length) return;

  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = 595.28 - margin * 2;
  const sep = '   ·   ';
  const iconSize = layout.contactSize * 0.9;
  const iconGap = 3;

  doc.font(ff.regular)
    .fontSize(layout.contactSize)
    .fillColor(COLORS.muted);

  const lines: { items: any[], width: number }[] = [];
  let currentLine: any[] = [];
  let currentLineWidth = 0;

  contact.forEach((item, i) => {
    const labelPart = `${item.label}: `;
    const valuePart = item.value;
    const labelWidth = doc.widthOfString(labelPart);
    const valueWidth = doc.widthOfString(valuePart);
    const textWidth = labelWidth + valueWidth;
    const iconType = showIcons ? getIconType(item.label, item.value) : null;
    const iconWidth = iconType ? iconSize + iconGap : 0;
    const sepWidth = doc.widthOfString(sep);
    const itemWidth = iconWidth + textWidth;

    const widthToAdd = currentLine.length > 0 ? sepWidth + itemWidth : itemWidth;

    if (currentLine.length > 0 && currentLineWidth + widthToAdd > cWidth) {
      lines.push({ items: currentLine, width: currentLineWidth });
      currentLine = [{ labelPart, valuePart, labelWidth, valueWidth, iconType, iconWidth, sepWidth: 0, linkUrl: getLinkUrl(valuePart, item.label) }];
      currentLineWidth = itemWidth;
    } else {
      if (currentLine.length > 0) {
        currentLine[currentLine.length - 1].sepWidth = sepWidth;
      }
      currentLine.push({ labelPart, valuePart, labelWidth, valueWidth, iconType, iconWidth, sepWidth: 0, linkUrl: getLinkUrl(valuePart, item.label) });
      currentLineWidth += widthToAdd;
    }
  });

  if (currentLine.length > 0) {
    lines.push({ items: currentLine, width: currentLineWidth });
  }

  let currentY = doc.y;
  lines.forEach(line => {
    let currentX = margin + (cWidth - line.width) / 2;
    line.items.forEach((data) => {
      if (data.iconType) {
        drawIcon(doc, data.iconType, currentX, currentY - 0.5, iconSize, COLORS.muted);
        currentX += data.iconWidth;
      }
      
      doc.text(data.labelPart, currentX, currentY, { lineBreak: false });
      currentX += data.labelWidth;
      
      const textOpts: any = { lineBreak: false };
      doc.text(data.valuePart, currentX, currentY, textOpts);
      
      if (data.linkUrl) {
        doc.link(currentX, currentY, data.valueWidth, layout.contactSize, data.linkUrl);
      }
      currentX += data.valueWidth;
      
      if (data.sepWidth > 0) {
        doc.text(sep, currentX, currentY, { lineBreak: false });
        currentX += data.sepWidth;
      }
    });
    currentY += layout.contactSize + 2.5;
  });

  doc.y = currentY - 2.5;
}

function drawSkillsSection(doc: any, section: Section, layout: any, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = 595.28 - margin * 2;
  const accent = cust.accentColor || COLORS.accent;

  drawSectionHeading(doc, section.title, layout, cust);

  const items = [...(section.paragraphs || []), ...(section.bullets || [])];
  if (!items.length) return;

  for (const item of items) {
    const colonIdx = item.indexOf(':');
    if (colonIdx !== -1) {
      const label = item.substring(0, colonIdx).trim();
      const value = item.substring(colonIdx + 1).trim();
      const cleanLabel = cleanMarkdownInline(label);
      const startY = doc.y;

      doc.font(ff.bold)
        .fontSize(layout.bodySize)
        .fillColor(accent)
        .text(cleanLabel + ': ', margin + 6, startY, {
          continued: true,
          width: cWidth - 6
        });

      drawMarkdownText(doc, value, null, null, cWidth - 6, cust, layout, {
        size: layout.bodySize,
        color: COLORS.text,
        lineGap: layout.lineGap
      });

      doc.moveDown(0.08);
    } else {
      drawMarkdownText(doc, item, margin + 6, doc.y, cWidth - 6, cust, layout, {
        size: layout.bodySize,
        color: COLORS.text,
        lineGap: layout.lineGap
      });
      doc.moveDown(0.08);
    }
  }
}

function renderCvPdf(doc: any, cv: CVContent, layout: any, showIcons: boolean, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = 595.28 - margin * 2;
  const accent = cust.accentColor || COLORS.accent;

  doc.info.Title = `CV - ${cv.name}`;
  doc.info.Author = cv.name;
  doc.info.Subject = 'Curriculum Vitae';

  doc.font(ff.bold)
    .fontSize(layout.nameSize)
    .fillColor(COLORS.text)
    .text(cv.name.toUpperCase(), margin, margin || PAGE_MARGIN, {
      width: cWidth,
      align: 'center',
      characterSpacing: 1.2
    });

  doc.moveDown(0.2);
  drawContactLines(doc, cv.contact, layout, showIcons, cust);

  const headerRuleY = doc.y + 12;
  doc.moveTo(margin, headerRuleY)
    .lineTo(margin + cWidth, headerRuleY)
    .strokeColor(accent)
    .lineWidth(0.8)
    .stroke();

  doc.y = headerRuleY + 10;

  for (const section of cv.sections) {
    if (isSkillsSection(section.title)) {
      drawSkillsSection(doc, section, layout, cust);
    } else {
      drawSectionHeading(doc, section.title, layout, cust);

      for (const paragraph of section.paragraphs || []) {
        drawParagraph(doc, paragraph, layout, {}, cust);
      }

      for (const entry of section.entries || []) {
        drawEntry(doc, entry, layout, cust);
      }

      for (const bullet of section.bullets || []) {
        drawBullet(doc, bullet, layout, cust);
      }
    }
    doc.moveDown(layout.sectionGap);
  }
}

// ==========================================
// TEMPLATE: MODERN (PETROLEUM BLUE SIDEBAR)
// ==========================================

function renderModernCvPdf(doc: any, cv: CVContent, scale: number, showIcons: boolean, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const customAccent = cust.accentColor || MODERN_CONFIG.accentColor;
  const { sidebarWidth, sidebarColor, sidebarPadding, mainPadding, sidebarTextColor, sidebarMutedColor, lineColor } = MODERN_CONFIG;
  const accentColor = customAccent;
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;

  // 1. Draw Sidebar Background
  doc.rect(0, 0, sidebarWidth, pageHeight).fill(sidebarColor);

  // 2. Split Content
  const sidebarSections: Section[] = [];
  const mainSections: Section[] = [];
  const sidebarKeywords = ['skills', 'habilidades', 'idiomas', 'languages', 'aptitudes', 'contact', 'contacto', 'competencias', 'habilidad', 'aptitud'];

  for (const section of cv.sections) {
    const t = section.title.toLowerCase();
    const isSidebar = sidebarKeywords.some(kw => t.includes(kw));
    if (isSidebar) {
      sidebarSections.push(section);
    } else {
      mainSections.push(section);
    }
  }

  // 3. Draw Sidebar Content
  let currentY = 40;

  const drawSidebarHeading = (title: string) => {
    doc.font(ff.bold)
      .fontSize(11 * scale)
      .fillColor(sidebarTextColor)
      .text(title.toUpperCase(), sidebarPadding, currentY, { characterSpacing: 1 });
    currentY += 15;
    doc.moveTo(sidebarPadding, currentY)
      .lineTo(sidebarWidth - sidebarPadding, currentY)
      .strokeColor(sidebarMutedColor)
      .lineWidth(0.5)
      .stroke();
    currentY += 10;
  };

  // Contact
  if (cv.contact && cv.contact.length > 0) {
    drawSidebarHeading('Contacto');
    doc.font(ff.regular).fontSize(8.5 * scale).fillColor(sidebarTextColor);
    for (const info of cv.contact) {
      const label = info.label || '';
      const value = info.value || '';
      const iconType = showIcons ? getIconType(label, value) : null;
      const iconSize = 8.5 * scale;
      
      let textX = sidebarPadding;
      if (iconType) {
        drawIcon(doc, iconType, sidebarPadding, currentY + 1, iconSize, sidebarTextColor);
        textX += iconSize + 5;
      }
      
      const linkUrl = getLinkUrl(value, label);
      const textOpts: any = { 
        width: sidebarWidth - sidebarPadding - textX + sidebarPadding, 
        lineGap: 2 
      };
      if (linkUrl) {
        textOpts.link = linkUrl;
      }
      
      const contactText = `${label}: ${value}`;
      doc.text(contactText, textX, currentY, textOpts);
      currentY = doc.y + 4;
    }
    currentY += 15;
  }

  // Sidebar Sections
  for (const section of sidebarSections) {
    drawSidebarHeading(section.title);
    const items = [...(section.paragraphs || []), ...(section.bullets || [])];
    for (const item of items) {
      const colonIdx = item.indexOf(':');
      if (colonIdx !== -1) {
        const label = item.substring(0, colonIdx).trim();
        const value = item.substring(colonIdx + 1).trim();
        const cleanLabel = cleanMarkdownInline(label);
        doc.font(ff.bold).fontSize(9 * scale).fillColor(accentColor)
          .text('• ' + cleanLabel + ': ', sidebarPadding + 2, currentY, { continued: true, width: sidebarWidth - sidebarPadding * 2 - 2 });
        drawMarkdownText(doc, value, null, null, sidebarWidth - sidebarPadding * 2 - 2, cust, null, {
          size: 9 * scale,
          color: sidebarTextColor,
          lineGap: 2.5
        });
      } else {
        drawMarkdownText(doc, '• ' + item, sidebarPadding + 2, currentY, sidebarWidth - sidebarPadding * 2 - 2, cust, null, {
          size: 9 * scale,
          color: sidebarTextColor,
          lineGap: 2.5
        });
      }
      currentY = doc.y + 3;
    }
    currentY += 15;
  }

  // 4. Draw Main Content
  const mainX = sidebarWidth + mainPadding;
  const mainWidth = pageWidth - sidebarWidth - mainPadding * 2;
  currentY = 40;
  const fs = (size: number) => size * scale;

  // Draw Name Header
  doc.font(ff.bold)
    .fontSize(fs(28))
    .fillColor('#333333')
    .text(cv.name, mainX, currentY);
  
  currentY = doc.y + 20;

  const drawMainHeading = (title: string) => {
    const startY = currentY;
    drawSmallCapsText(doc, title, mainX, startY, fs(12), ff.bold, accentColor);
    
    currentY = doc.y + 3;
    doc.moveTo(mainX, currentY)
      .lineTo(mainX + mainWidth, currentY)
      .strokeColor(accentColor)
      .lineWidth(1.5)
      .stroke();
    currentY += 10;
  };

  for (const section of mainSections) {
    drawMainHeading(section.title);

    // Paragraphs
    for (const p of section.paragraphs || []) {
      drawMarkdownText(doc, p, mainX, currentY, mainWidth, cust, null, {
        size: fs(9.5),
        color: '#444444',
        lineGap: 2,
        align: 'justify'
      });
      currentY = doc.y + 8;
    }

    // Entries
    for (const entry of section.entries || []) {
      const entryY = currentY;
      doc.font(ff.bold).fontSize(fs(10)).fillColor('#333333').text(entry.heading, mainX, entryY, { width: mainWidth - 80 });
      if (entry.date) {
        doc.font(ff.bold).fontSize(fs(9)).fillColor('#666666').text(entry.date, mainX, entryY, { align: 'right', width: mainWidth });
      }
      currentY = doc.y + 2;

      if (entry.subheading) {
        doc.font(ff.boldItalic).fontSize(fs(9)).fillColor('#555555').text(entry.subheading, mainX, currentY);
        currentY = doc.y + 4;
      }

      for (const p of entry.paragraphs || []) {
        drawMarkdownText(doc, p, mainX, currentY, mainWidth, cust, null, {
          size: fs(9),
          color: '#444444',
          lineGap: 1.5
        });
        currentY = doc.y + 4;
      }

      for (const b of entry.bullets || []) {
        drawMarkdownText(doc, '• ' + b, mainX + 10, currentY, mainWidth - 10, cust, null, {
          size: fs(9),
          color: '#444444',
          lineGap: 1.5
        });
        currentY = doc.y + 2;
      }
      currentY += 8;
    }

    // General Bullets
    for (const b of section.bullets || []) {
      drawMarkdownText(doc, '• ' + b, mainX + 10, currentY, mainWidth - 10, cust, null, {
        size: fs(9.5),
        color: '#444444',
        lineGap: 2
      });
      currentY = doc.y + 4;
    }
    currentY += 15;
  }
}

// ==========================================
// TEMPLATE: MINIMAL (FINE GRYS & CLEAN)
// ==========================================

function renderMinimalCvPdf(doc: any, cv: CVContent, scale: number, showIcons: boolean, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const customAccent = cust.accentColor || MINIMAL_CONFIG.accentColor;
  const customMargin = cust.pageMargin || MINIMAL_CONFIG.marginSide;
  const cfg = { ...MINIMAL_CONFIG, accentColor: customAccent, marginSide: customMargin };
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - cfg.marginSide * 2;
  const fs = (size: number) => size * scale;
  let y = cfg.marginTop;

  doc.info.Title = `CV - ${cv.name}`;
  doc.info.Author = cv.name;

  // Name
  doc.font(ff.regular).fontSize(fs(22)).fillColor(cfg.nameColor)
    .text(cv.name, cfg.marginSide, y, { width: contentWidth, align: 'center' });
  y = doc.y + 8;

  // Contact
  if (cv.contact.length) {
    const sep = '  |  ';
    doc.font(ff.regular).fontSize(fs(8.5)).fillColor(cfg.mutedColor);
    
    // Calculate total width and parts
    const itemsData: any[] = [];
    let totalWidth = 0;
    const sepWidth = doc.widthOfString(sep);
    const iconSize = fs(8);
    const iconGap = 3;
    
    cv.contact.forEach((c, idx) => {
      const labelPart = `${c.label}: `;
      const valuePart = c.value;
      const labelWidth = doc.widthOfString(labelPart);
      const valueWidth = doc.widthOfString(valuePart);
      const iconType = showIcons ? getIconType(c.label, c.value) : null;
      const iconWidth = iconType ? iconSize + iconGap : 0;
      
      const itemWidth = iconWidth + labelWidth + valueWidth;
      totalWidth += itemWidth;
      if (idx > 0) totalWidth += sepWidth;
      
      itemsData.push({
        labelPart,
        valuePart,
        labelWidth,
        valueWidth,
        iconType,
        iconWidth,
        linkUrl: getLinkUrl(c.value, c.label)
      });
    });
    
    let currentX = cfg.marginSide + (contentWidth - totalWidth) / 2;
    itemsData.forEach((data, idx) => {
      if (idx > 0) {
        doc.text(sep, currentX, y, { lineBreak: false });
        currentX += sepWidth;
      }
      
      if (data.iconType) {
        drawIcon(doc, data.iconType, currentX, y - 0.5, iconSize, cfg.mutedColor);
        currentX += data.iconWidth;
      }
      
      doc.text(data.labelPart, currentX, y, { lineBreak: false });
      currentX += data.labelWidth;
      
      const textOpts: any = { lineBreak: false };
      doc.text(data.valuePart, currentX, y, textOpts);
      
      if (data.linkUrl) {
        doc.link(currentX, y, data.valueWidth, fs(8.5), data.linkUrl);
      }
      currentX += data.valueWidth;
    });
    
    y = y + fs(8.5) + 6;
  }

  y += 10;
  doc.moveTo(cfg.marginSide + contentWidth * 0.3, y)
    .lineTo(cfg.marginSide + contentWidth * 0.7, y)
    .strokeColor(cfg.ruleColor).lineWidth(0.5).stroke();
  y += 18;

  // Sections
  for (const section of cv.sections) {
    const startY = y;
    drawSmallCapsText(doc, section.title, cfg.marginSide, startY, fs(10), ff.bold, cfg.accentColor);
    y = doc.y + 3;
    doc.moveTo(cfg.marginSide, y).lineTo(cfg.marginSide + contentWidth, y)
      .strokeColor(cfg.accentColor).lineWidth(1.5).stroke();
    y += 8;

    for (const p of section.paragraphs || []) {
      drawMarkdownText(doc, p, cfg.marginSide, y, contentWidth, cust, null, {
        size: fs(9),
        color: cfg.textColor,
        lineGap: 2,
        align: 'justify'
      });
      y = doc.y + 5;
    }

    for (const entry of section.entries || []) {
      const entryY = y;
      doc.font(ff.bold).fontSize(fs(9.5)).fillColor(cfg.nameColor)
        .text(entry.heading, cfg.marginSide, entryY, { width: contentWidth * 0.7 });
      if (entry.date) {
        doc.font(ff.regular).fontSize(fs(8.5)).fillColor(cfg.mutedColor)
          .text(entry.date, cfg.marginSide, entryY, { width: contentWidth, align: 'right' });
      }
      y = doc.y + 1;

      if (entry.subheading) {
        doc.font(ff.italic).fontSize(fs(8.5)).fillColor(cfg.textColor)
          .text(entry.subheading, cfg.marginSide, y);
        y = doc.y + 2;
      }

      for (const p of entry.paragraphs || []) {
        drawMarkdownText(doc, p, cfg.marginSide, y, contentWidth, cust, null, {
          size: fs(9),
          color: cfg.textColor,
          lineGap: 1.5
        });
        y = doc.y + 3;
      }

      for (const b of entry.bullets || []) {
        drawMarkdownText(doc, '–  ' + b, cfg.marginSide + 12, y, contentWidth - 12, cust, null, {
          size: fs(8.5),
          color: cfg.textColor,
          lineGap: 1.5
        });
        y = doc.y + 2;
      }
      y += 6;
    }

    const isSkills = isSkillsSection(section.title);
    if (isSkills) {
      const items = [...(section.paragraphs || []), ...(section.bullets || [])];
      for (const item of items) {
        const colonIdx = item.indexOf(':');
        if (colonIdx !== -1) {
          const label = item.substring(0, colonIdx).trim();
          const value = item.substring(colonIdx + 1).trim();
          const cleanLabel = cleanMarkdownInline(label);
          doc.font(ff.bold).fontSize(fs(8.5)).fillColor(cfg.accentColor)
            .text(cleanLabel + ': ', cfg.marginSide, y, { continued: true, width: contentWidth });
          drawMarkdownText(doc, value, null, null, contentWidth, cust, null, {
            size: fs(8.5),
            color: cfg.textColor,
            lineGap: 1.5
          });
        } else {
          drawMarkdownText(doc, item, cfg.marginSide, y, contentWidth, cust, null, {
            size: fs(8.5),
            color: cfg.textColor,
            lineGap: 1.5
          });
        }
        y = doc.y + 2;
      }
    }

    if (!isSkills) {
      for (const b of section.bullets || []) {
        drawMarkdownText(doc, '–  ' + b, cfg.marginSide + 12, y, contentWidth - 12, cust, null, {
          size: fs(8.5),
          color: cfg.textColor,
          lineGap: 1.5
        });
        y = doc.y + 2;
      }
    }
    y += 10;
  }
}

// ==========================================
// TEMPLATE: CREATIVE (DEGRADADO PÚRPURA)
// ==========================================

function renderCreativeCvPdf(doc: any, cv: CVContent, scale: number, showIcons: boolean, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const customAccent = cust.accentColor || CREATIVE_CONFIG.accentColor;
  const cfg = { ...CREATIVE_CONFIG, accentColor: customAccent };
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const mainX = cfg.mainPadding;
  const mainWidth = pageWidth - cfg.sidebarWidth - cfg.mainPadding * 2;
  const sideX = pageWidth - cfg.sidebarWidth;
  const sideContentX = sideX + cfg.sidebarPadding;
  const sideContentWidth = cfg.sidebarWidth - cfg.sidebarPadding * 2;
  const fs = (size: number) => size * scale;

  doc.info.Title = `CV - ${cv.name}`;
  doc.info.Author = cv.name;

  // Sidebar Gradient Background
  const gradient = doc.linearGradient(sideX, 0, sideX, pageHeight);
  gradient.stop(0, cfg.sidebarColorTop).stop(1, cfg.sidebarColorBottom);
  doc.rect(sideX, 0, cfg.sidebarWidth, pageHeight).fill(gradient);

  // Sidebar content
  let sideY = 40;

  const drawSidebarHeading = (title: string) => {
    doc.font(ff.bold).fontSize(fs(10)).fillColor(cfg.sidebarTextColor)
      .text(title.toUpperCase(), sideContentX, sideY, { width: sideContentWidth, characterSpacing: 0.8 });
    sideY = doc.y + 4;
    doc.moveTo(sideContentX, sideY)
      .lineTo(sideContentX + sideContentWidth, sideY)
      .strokeColor('rgba(255,255,255,0.3)').lineWidth(0.5).stroke();
    sideY += 8;
  };

  // Contact in Sidebar
  if (cv.contact && cv.contact.length) {
    drawSidebarHeading('Contacto');
    doc.font(ff.regular).fontSize(fs(8)).fillColor(cfg.sidebarTextColor);
    for (const info of cv.contact) {
      const iconType = showIcons ? getIconType(info.label, info.value) : null;
      const iconSize = fs(8);
      let textX = sideContentX;
      if (iconType) {
        drawIcon(doc, iconType, sideContentX, sideY + 1, iconSize, cfg.sidebarTextColor);
        textX += iconSize + 5;
      }
      
      const linkUrl = getLinkUrl(info.value, info.label);
      const textOpts: any = {
        width: sideContentWidth - (textX - sideContentX),
        lineGap: 2
      };
      if (linkUrl) {
        textOpts.link = linkUrl;
      }
      
      doc.text(`${info.label}: ${info.value}`, textX, sideY, textOpts);
      sideY = doc.y + 4;
    }
    sideY += 12;
  }

  // Sidebar sections
  const sidebarSections: Section[] = [];
  const mainSections: Section[] = [];
  const sidebarKeywords = ['skills', 'habilidades', 'idiomas', 'languages', 'aptitudes', 'competencias', 'habilidad', 'aptitud'];
  for (const section of cv.sections) {
    const t = section.title.toLowerCase();
    const isSidebar = sidebarKeywords.some(kw => t.includes(kw));
    if (isSidebar) {
      sidebarSections.push(section);
    } else {
      mainSections.push(section);
    }
  }

  for (const section of sidebarSections) {
    drawSidebarHeading(section.title);
    const items = [...(section.paragraphs || []), ...(section.bullets || [])];
    for (const item of items) {
      const colonIdx = item.indexOf(':');
      if (colonIdx !== -1) {
        const label = item.substring(0, colonIdx).trim();
        const value = item.substring(colonIdx + 1).trim();
        const cleanLabel = cleanMarkdownInline(label);
        doc.font(ff.bold).fontSize(fs(8)).fillColor(cfg.accentColor)
          .text('● ' + cleanLabel + ': ', sideContentX + 2, sideY, { continued: true, width: sideContentWidth - 4 });
        drawMarkdownText(doc, value, null, null, sideContentWidth - 4, cust, null, {
          size: fs(8),
          color: cfg.sidebarTextColor,
          lineGap: 2
        });
      } else {
        drawMarkdownText(doc, '● ' + item, sideContentX + 2, sideY, sideContentWidth - 4, cust, null, {
          size: fs(8),
          color: cfg.sidebarTextColor,
          lineGap: 2
        });
      }
      sideY = doc.y + 3;
    }
    sideY += 12;
  }

  // Main Content
  let y = 40;

  doc.font(ff.bold).fontSize(fs(26)).fillColor(cfg.accentColor)
    .text(cv.name, mainX, y, { width: mainWidth });
  y = doc.y + 4;

  doc.rect(mainX, y, 50, 3).fill(cfg.accentColor);
  y += 18;

  // Main sections
  for (const section of mainSections) {
    const startY = y;
    drawSmallCapsText(doc, section.title, mainX, startY, fs(11), ff.bold, cfg.accentColor);
    y = doc.y + 4;
    doc.moveTo(mainX, y).lineTo(mainX + mainWidth, y)
      .strokeColor(cfg.accentColor).lineWidth(1.5).stroke();
    y += 8;

    for (const p of section.paragraphs || []) {
      drawMarkdownText(doc, p, mainX, y, mainWidth, cust, null, {
        size: fs(9),
        color: cfg.mainTextColor,
        lineGap: 2,
        align: 'justify'
      });
      y = doc.y + 6;
    }

    for (const entry of section.entries || []) {
      const entryY = y;
      doc.font(ff.bold).fontSize(fs(10)).fillColor(cfg.mainTextColor)
        .text(entry.heading, mainX, entryY, { width: mainWidth - 80 });
      if (entry.date) {
        doc.font(ff.bold).fontSize(fs(8.5)).fillColor(cfg.accentColor)
          .text(entry.date, mainX, entryY, { width: mainWidth, align: 'right' });
      }
      y = doc.y + 2;

      if (entry.subheading) {
        doc.font(ff.boldItalic).fontSize(fs(8.5)).fillColor(cfg.mainMutedColor)
          .text(entry.subheading, mainX, y);
        y = doc.y + 3;
      }

      for (const p of entry.paragraphs || []) {
        drawMarkdownText(doc, p, mainX, y, mainWidth, cust, null, {
          size: fs(9),
          color: cfg.mainTextColor,
          lineGap: 1.5
        });
        y = doc.y + 3;
      }

      for (const b of entry.bullets || []) {
        doc.font(ff.regular).fontSize(fs(8.5)).fillColor(cfg.mainTextColor)
          .text('● ', mainX + 8, y, { continued: true });
        drawMarkdownText(doc, b, null, null, mainWidth - 20, cust, null, {
          size: fs(8.5),
          color: cfg.mainTextColor,
          lineGap: 1.5
        });
        y = doc.y + 2;
      }
      y += 7;
    }

    for (const b of section.bullets || []) {
      drawMarkdownText(doc, '● ' + b, mainX + 8, y, mainWidth - 8, cust, null, {
        size: fs(9),
        color: cfg.mainTextColor,
        lineGap: 1.5
      });
      y = doc.y + 3;
    }
    y += 12;
  }
}

// ==========================================
// TEMPLATE: SWISS (BOLD RED STYLE)
// ==========================================

function renderSwissCvPdf(doc: any, cv: CVContent, scale: number, showIcons: boolean, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const customAccent = cust.accentColor || SWISS_CONFIG.accentColor;
  const cfg = { ...SWISS_CONFIG, accentColor: customAccent };
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const mainX = cfg.sidebarWidth + cfg.mainPadding;
  const mainWidth = pageWidth - cfg.sidebarWidth - cfg.mainPadding * 2;
  const sideContentX = cfg.sidebarPadding;
  const sideContentWidth = cfg.sidebarWidth - cfg.sidebarPadding * 2;
  const fs = (size: number) => size * scale;

  doc.info.Title = `CV - ${cv.name}`;
  doc.info.Author = cv.name;

  // Sidebar background
  doc.rect(0, 0, cfg.sidebarWidth, pageHeight).fill(cfg.sidebarColor);
  doc.rect(0, 0, cfg.sidebarWidth, 5).fill(cfg.accentColor);

  // Sidebar content
  let sideY = 30;

  // Name in sidebar
  doc.font(ff.bold).fontSize(fs(13)).fillColor(cfg.sidebarTextColor)
    .text(cv.name.split(' ')[0] || cv.name, sideContentX, sideY, { width: sideContentWidth });
  sideY = doc.y;
  if (cv.name.split(' ').length > 1) {
    doc.font(ff.regular).fontSize(fs(13)).fillColor(cfg.accentColor)
      .text(cv.name.split(' ').slice(1).join(' '), sideContentX, sideY, { width: sideContentWidth });
    sideY = doc.y;
  }
  sideY += 16;

  const drawSwissSidebarHeading = (title: string) => {
    doc.font(ff.bold).fontSize(fs(8.5)).fillColor(cfg.accentColor)
      .text(title.toUpperCase(), sideContentX, sideY, {
        width: sideContentWidth, characterSpacing: 1.5
      });
    sideY = doc.y + 4;
    doc.moveTo(sideContentX, sideY)
      .lineTo(sideContentX + sideContentWidth, sideY)
      .strokeColor(cfg.accentColor).lineWidth(0.3).stroke();
    sideY += 8;
  };

  // Contact
  if (cv.contact && cv.contact.length) {
    drawSwissSidebarHeading('Contacto');
    for (const info of cv.contact) {
      const iconType = showIcons ? getIconType(info.label, info.value) : null;
      const iconSize = fs(7.5);
      let textX = sideContentX;
      if (iconType) {
        drawIcon(doc, iconType, sideContentX, sideY + 1, iconSize, cfg.sidebarTextColor);
        textX += iconSize + 4;
      }
      doc.font(ff.regular).fontSize(fs(7.5)).fillColor(cfg.sidebarMutedColor)
        .text(info.label, textX, sideY, { width: sideContentWidth - (textX - sideContentX) });
      sideY = doc.y;
      
      const linkUrl = getLinkUrl(info.value, info.label);
      const textOpts: any = {
        width: sideContentWidth - (textX - sideContentX),
        lineGap: 1.5
      };
      if (linkUrl) {
        textOpts.link = linkUrl;
      }
      
      doc.font(ff.regular).fontSize(fs(7.5)).fillColor(cfg.sidebarTextColor)
        .text(info.value, textX, sideY, textOpts);
      sideY = doc.y + 6;
    }
    sideY += 8;
  }

  // Sidebar Sections
  const sidebarSections: Section[] = [];
  const mainSections: Section[] = [];
  const sidebarKeywords = ['skills', 'habilidades', 'idiomas', 'languages', 'aptitudes', 'competencias', 'habilidad', 'aptitud'];
  for (const section of cv.sections) {
    const t = section.title.toLowerCase();
    const isSidebar = sidebarKeywords.some(kw => t.includes(kw));
    if (isSidebar) {
      sidebarSections.push(section);
    } else {
      mainSections.push(section);
    }
  }

  for (const section of sidebarSections) {
    drawSwissSidebarHeading(section.title);
    const items = [...(section.paragraphs || []), ...(section.bullets || [])];
    for (const item of items) {
      const colonIdx = item.indexOf(':');
      if (colonIdx !== -1) {
        const label = item.substring(0, colonIdx).trim();
        const value = item.substring(colonIdx + 1).trim();
        const cleanLabel = cleanMarkdownInline(label);
        doc.font(ff.bold).fontSize(fs(7.5)).fillColor(cfg.accentColor)
          .text(cleanLabel, sideContentX, sideY, { width: sideContentWidth });
        sideY = doc.y;
        drawMarkdownText(doc, value, sideContentX, sideY, sideContentWidth, cust, null, {
          size: fs(7.5),
          color: cfg.sidebarTextColor,
          lineGap: 1.5
        });
      } else {
        drawMarkdownText(doc, '▸ ' + item, sideContentX, sideY, sideContentWidth, cust, null, {
          size: fs(7.5),
          color: cfg.sidebarTextColor,
          lineGap: 1.5
        });
      }
      sideY = doc.y + 4;
    }
    sideY += 8;
  }

  // Main Content
  let y = 30;

  doc.font(ff.bold).fontSize(fs(28)).fillColor(cfg.mainTextColor)
    .text(cv.name.toUpperCase(), mainX, y, { width: mainWidth, characterSpacing: 1.5 });
  y = doc.y + 2;

  doc.rect(mainX, y, 40, 2.5).fill(cfg.accentColor);
  y += 18;

  // Main Sections
  for (const section of mainSections) {
    const startY = y;
    drawSmallCapsText(doc, section.title, mainX, startY, fs(11), ff.bold, cfg.accentColor);
    y = doc.y + 2;
    doc.moveTo(mainX, y).lineTo(mainX + mainWidth, y)
      .strokeColor(cfg.accentColor).lineWidth(1.5).stroke();
    y += 8;

    for (const p of section.paragraphs || []) {
      drawMarkdownText(doc, p, mainX, y, mainWidth, cust, null, {
        size: fs(9),
        color: cfg.mainTextColor,
        lineGap: 2,
        align: 'justify'
      });
      y = doc.y + 6;
    }

    for (const entry of section.entries || []) {
      const entryY = y;
      doc.font(ff.bold).fontSize(fs(10)).fillColor(cfg.mainTextColor)
        .text(entry.heading, mainX, entryY, { width: mainWidth - 90 });
      if (entry.date) {
        doc.font(ff.bold).fontSize(fs(8.5)).fillColor(cfg.accentColor)
          .text(entry.date, mainX, entryY, { width: mainWidth, align: 'right' });
      }
      y = doc.y + 1;

      if (entry.subheading) {
        doc.font(ff.italic).fontSize(fs(9)).fillColor(cfg.mainMutedColor)
          .text(entry.subheading, mainX, y);
        y = doc.y + 3;
      }

      for (const p of entry.paragraphs || []) {
        drawMarkdownText(doc, p, mainX, y, mainWidth, cust, null, {
          size: fs(9),
          color: cfg.mainTextColor,
          lineGap: 1.5
        });
        y = doc.y + 3;
      }

      for (const b of entry.bullets || []) {
        drawMarkdownText(doc, '▸ ' + b, mainX + 8, y, mainWidth - 8, cust, null, {
          size: fs(8.5),
          color: cfg.mainTextColor,
          lineGap: 1.5
        });
        y = doc.y + 2;
      }
      y += 7;
    }

    for (const b of section.bullets || []) {
      drawMarkdownText(doc, '▸ ' + b, mainX + 8, y, mainWidth - 8, cust, null, {
        size: fs(9),
        color: cfg.mainTextColor,
        lineGap: 1.5
      });
      y = doc.y + 3;
    }
    y += 12;
  }
}

// ==========================================
// INTEGRATED GENERATOR
// ==========================================

export function generatePdfBuffer(markdown: string, options: any = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const cv = parseCvMarkdown(markdown);
      const templateType = options.template || 'harvard';
      const fontScale = getFontScale(options.fontSize || 12.5);
      const layout = buildLayout(fontScale);
      const customize = buildCustomize(options);

      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        },
        bufferPages: true
      });

      // Register standard-compatible TrueType fonts to bypass dynamic AFM file lookup issues in Next.js
      const fontsDir = path.join(process.cwd(), 'src/assets/fonts');
      doc.registerFont('Custom-Helvetica', path.join(fontsDir, 'LiberationSans-Regular.ttf'));
      doc.registerFont('Custom-Helvetica-Bold', path.join(fontsDir, 'LiberationSans-Bold.ttf'));
      doc.registerFont('Custom-Helvetica-Oblique', path.join(fontsDir, 'LiberationSans-Italic.ttf'));
      doc.registerFont('Custom-Helvetica-BoldOblique', path.join(fontsDir, 'LiberationSans-BoldItalic.ttf'));
      
      doc.registerFont('Custom-Times-Roman', path.join(fontsDir, 'LiberationSerif-Regular.ttf'));
      doc.registerFont('Custom-Times-Bold', path.join(fontsDir, 'LiberationSerif-Bold.ttf'));
      doc.registerFont('Custom-Times-Italic', path.join(fontsDir, 'LiberationSerif-Italic.ttf'));
      doc.registerFont('Custom-Times-BoldItalic', path.join(fontsDir, 'LiberationSerif-BoldItalic.ttf'));
      
      doc.registerFont('Custom-Courier', path.join(fontsDir, 'LiberationMono-Regular.ttf'));
      doc.registerFont('Custom-Courier-Bold', path.join(fontsDir, 'LiberationMono-Bold.ttf'));
      doc.registerFont('Custom-Courier-Oblique', path.join(fontsDir, 'LiberationMono-Italic.ttf'));
      doc.registerFont('Custom-Courier-BoldOblique', path.join(fontsDir, 'LiberationMono-BoldItalic.ttf'));


      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      if (templateType === 'modern') {
        renderModernCvPdf(doc, cv, fontScale, options.showIcons !== false, customize);
      } else if (templateType === 'minimal') {
        renderMinimalCvPdf(doc, cv, fontScale, options.showIcons !== false, customize);
      } else if (templateType === 'creative') {
        renderCreativeCvPdf(doc, cv, fontScale, options.showIcons !== false, customize);
      } else if (templateType === 'swiss') {
        renderSwissCvPdf(doc, cv, fontScale, options.showIcons !== false, customize);
      } else {
        renderCvPdf(doc, cv, layout, options.showIcons !== false, customize);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
