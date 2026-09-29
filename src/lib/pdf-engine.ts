import PDFDocument from 'pdfkit';
import path from 'path';
import { readFileSync } from 'fs';
import { cleanMarkdownInline, parseCvDocument, type CVContent, type ContactInfo, type Entry, type Section } from '@/lib/cv-document';
import {
  CV_METRICS,
  SVG_ICONS,
  contentWidthPt,
  getFontScale,
  getIconType,
  isSkillsSection,
  sanitizePdfText,
  scaleLayout,
} from '@/lib/cv-layout';

export type { CVContent, ContactInfo, Entry, Section };

// Márgenes predeterminados
const PAGE_MARGIN = 36;
const COLORS = {
  text: '#000000',
  muted: '#555555',
  accent: '#000000',
  rule: '#000000'
};

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

// PDFKit font name -> TTF file (Liberation metrics-compatible with Helvetica/Times/Courier).
const FONT_FILES: Record<string, string> = {
  'Custom-Helvetica': 'LiberationSans-Regular.ttf',
  'Custom-Helvetica-Bold': 'LiberationSans-Bold.ttf',
  'Custom-Helvetica-Oblique': 'LiberationSans-Italic.ttf',
  'Custom-Helvetica-BoldOblique': 'LiberationSans-BoldItalic.ttf',
  'Custom-Times-Roman': 'LiberationSerif-Regular.ttf',
  'Custom-Times-Bold': 'LiberationSerif-Bold.ttf',
  'Custom-Times-Italic': 'LiberationSerif-Italic.ttf',
  'Custom-Times-BoldItalic': 'LiberationSerif-BoldItalic.ttf',
  'Custom-Courier': 'LiberationMono-Regular.ttf',
  'Custom-Courier-Bold': 'LiberationMono-Bold.ttf',
  'Custom-Courier-Oblique': 'LiberationMono-Italic.ttf',
  'Custom-Courier-BoldOblique': 'LiberationMono-BoldItalic.ttf',
};

const FONTS_DIR = process.env.PDF_FONTS_DIR || path.join(process.cwd(), 'src/assets/fonts');
const fontBufferCache = new Map<string, Buffer>();

function getFontBuffer(fontName: string): Buffer {
  const cached = fontBufferCache.get(fontName);
  if (cached) return cached;
  const file = FONT_FILES[fontName];
  if (!file) throw new Error(`Unknown PDF font: ${fontName}`);
  const buffer = readFileSync(path.join(FONTS_DIR, file));
  fontBufferCache.set(fontName, buffer);
  return buffer;
}

function registerFontFamily(doc: PDFKit.PDFDocument, family: FontSet) {
  for (const fontName of [family.regular, family.bold, family.italic, family.boldItalic]) {
    doc.registerFont(fontName, getFontBuffer(fontName));
  }
}

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

export function parseCvMarkdown(content: string): CVContent {
  const cv = parseCvDocument(sanitizePdfText(content));
  if (!cv.name.trim()) cv.name = 'Curriculum Vitae';
  return cv;
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

// ==========================================
// TEMPLATE: HARVARD (DEFAULT CLASSIC)
// ==========================================

function drawSmallCapsText(doc: any, text: string, x: number, y: number, baseSize: number, fontBold: string, color: string) {
  doc.y = y;
  doc.font(fontBold).fontSize(baseSize).fillColor(color);
  doc.text(text.toUpperCase(), x, y, { lineBreak: false });
  doc.fontSize(baseSize);
  doc.y = y + baseSize + CV_METRICS.sectionTitleExtra;
}

function drawSectionHeading(doc: any, title: string, layout: any, cust: CustomizeOptions) {
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = contentWidthPt(margin);
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const accent = cust.accentColor || COLORS.accent;

  doc.moveDown(layout.sectionGap);

  const startY = doc.y;
  drawSmallCapsText(doc, title, margin, startY, layout.sectionSize, ff.bold, accent);

  const ruleY = doc.y + CV_METRICS.sectionRuleGap;
  doc.moveTo(margin, ruleY)
    .lineTo(margin + cWidth, ruleY)
    .strokeColor(accent)
    .lineWidth(CV_METRICS.sectionRuleWidth)
    .stroke();

  doc.y = ruleY + CV_METRICS.afterSectionRule;
}

function drawParagraph(doc: any, text: string, layout: any, options: any = {}, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = contentWidthPt(margin);
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
  const cWidth = contentWidthPt(margin);

  const bulletX = margin + CV_METRICS.bulletMark;
  const textX = margin + CV_METRICS.bulletText;
  const startY = doc.y;

  doc.font(ff.regular)
    .fontSize(layout.bulletSize)
    .fillColor(COLORS.text)
    .text('\u2022', bulletX, startY);

  drawMarkdownText(doc, text, textX, startY, cWidth - CV_METRICS.bulletText, cust, layout, {
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
  const cWidth = contentWidthPt(margin);

  const startY = doc.y;

  doc.font(ff.bold)
    .fontSize(layout.headingSize)
    .fillColor(COLORS.text)
    .text(entry.heading, margin, startY, {
      width: cWidth * CV_METRICS.entryHeadingRatio
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
    doc.y += CV_METRICS.entryDateNudge;
    doc.font(ff.italic)
      .fontSize(layout.metaSize)
      .fillColor(COLORS.text)
      .text(entry.subheading, margin, doc.y, {
        width: cWidth
      });
  }

  doc.moveDown(CV_METRICS.entryPreBullet);

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
  const cWidth = contentWidthPt(margin);
  const sep = CV_METRICS.contactSeparator;
  const iconSize = layout.contactSize * CV_METRICS.contactIconScale;
  const iconGap = CV_METRICS.iconGap;

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
        drawIcon(doc, data.iconType, currentX, currentY - CV_METRICS.iconLift, iconSize, COLORS.muted);
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
    currentY += layout.contactSize + CV_METRICS.contactLineExtra;
  });

  doc.y = currentY - CV_METRICS.contactLineExtra;
}

function drawSkillsSection(doc: any, section: Section, layout: any, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = contentWidthPt(margin);
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
        .text(cleanLabel + ': ', margin + CV_METRICS.skillIndent, startY, {
          continued: true,
          width: cWidth - CV_METRICS.skillIndent
        });

      drawMarkdownText(doc, value, null, null, cWidth - CV_METRICS.skillIndent, cust, layout, {
        size: layout.bodySize,
        color: COLORS.text,
        lineGap: layout.lineGap
      });

      doc.moveDown(CV_METRICS.skillMoveDown);
    } else {
      drawMarkdownText(doc, item, margin + CV_METRICS.skillIndent, doc.y, cWidth - CV_METRICS.skillIndent, cust, layout, {
        size: layout.bodySize,
        color: COLORS.text,
        lineGap: layout.lineGap
      });
      doc.moveDown(CV_METRICS.skillMoveDown);
    }
  }
}

function renderCvPdf(doc: any, cv: CVContent, layout: any, showIcons: boolean, cust: CustomizeOptions) {
  const ff = cust.fontFamily || FONT_FAMILIES.helvetica;
  const margin = cust.pageMargin || PAGE_MARGIN;
  const cWidth = contentWidthPt(margin);
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
      characterSpacing: CV_METRICS.nameCharacterSpacing
    });

  doc.moveDown(CV_METRICS.nameMoveDown);
  drawContactLines(doc, cv.contact, layout, showIcons, cust);

  const headerRuleY = doc.y + CV_METRICS.headerRuleGap;
  doc.moveTo(margin, headerRuleY)
    .lineTo(margin + cWidth, headerRuleY)
    .strokeColor(accent)
    .lineWidth(CV_METRICS.headerRuleWidth)
    .stroke();

  doc.y = headerRuleY + CV_METRICS.afterHeaderRule;

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

// ==========================================
// INTEGRATED GENERATOR
// ==========================================

export function generatePdfBuffer(markdown: string, options: any = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const cv = parseCvMarkdown(markdown);
      const fontScale = getFontScale(options.fontSize || 12.5);
      const layout = scaleLayout(fontScale);
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

      // Register the TrueType fonts of the selected family from in-memory buffers
      // (read from disk once per process, not once per render).
      registerFontFamily(doc, customize.fontFamily);


      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      renderCvPdf(doc, cv, layout, options.showIcons !== false, customize);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
