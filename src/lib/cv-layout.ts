/** Shared Harvard layout for the PDF and the editable sheet. No PDFKit. */

import { cleanMarkdownInline } from '@/lib/cv-document';

export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;
export const CSS_PX_PER_PT = 96 / 72;

/** (hhea ascender − descender + lineGap) / unitsPerEm. This is PDFKit's line height. */
export const FONT_LINE_RATIO = {
  helvetica: (1854 + 434 + 67) / 2048,
  times: (1825 + 443 + 87) / 2048,
  courier: (1705 + 615) / 2048,
} as const;

export type CvFontFamily = keyof typeof FONT_LINE_RATIO;

export const CV_FONT_FACE: Record<CvFontFamily, string> = {
  helvetica: 'Cv Sans',
  times: 'Cv Serif',
  courier: 'Cv Mono',
};

export const CV_FONT_STACK: Record<CvFontFamily, string> = {
  helvetica: '"Cv Sans", "Liberation Sans", Helvetica, Arial, sans-serif',
  times: '"Cv Serif", "Liberation Serif", "Times New Roman", Times, serif',
  courier: '"Cv Mono", "Liberation Mono", "Courier New", Courier, monospace',
};

export const PDF_COLORS = {
  text: '#000000',
  muted: '#555555',
} as const;

export const BASE_LAYOUT = {
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
  entryGap: 0.4,
} as const;

export type CvLayout = { -readonly [Key in keyof typeof BASE_LAYOUT]: number };

/**
 * Point gaps and moveDown factors that are not multiplied inside BASE_LAYOUT.
 * Stroke widths, icon gap and the name's character spacing stay in raw points
 * even when the type scale changes. moveDown factors here are applied once to
 * the current font's line height (PDFKit currentLineHeight).
 */
export const CV_METRICS = {
  nameCharacterSpacing: 1.2,
  nameMoveDown: 0.2,
  contactSeparator: '   ·   ',
  contactIconScale: 0.9,
  iconGap: 3,
  iconLift: 0.5,
  contactLineExtra: 2.5,
  headerRuleGap: 12,
  headerRuleWidth: 0.8,
  afterHeaderRule: 10,
  sectionTitleExtra: 2,
  sectionRuleGap: 2.5,
  sectionRuleWidth: 1.5,
  afterSectionRule: 4.5,
  bulletMark: 8,
  bulletText: 18,
  skillIndent: 6,
  entryHeadingRatio: 0.7,
  entryDateNudge: 1,
  entryPreBullet: 0.15,
  skillMoveDown: 0.08,
} as const;

export const SVG_ICONS: Record<string, string> = {
  linkedIn: 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  web: 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  email: 'M0 3v18h24v-18h-24zm6.623 7.929l-4.623 5.712v-9.458l4.623 3.746zm-4.141-5.929h19.035l-9.517 7.713-9.518-7.713zm5.694 7.188l3.824 3.099 3.83-3.104 5.612 8.817h-18.779l5.513-8.812zm9.208-1.264l4.616-3.741v9.348l-4.616-5.607z',
  phone: 'M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.75-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z',
  location: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function cvFontFamily(family: string): CvFontFamily {
  if (family === 'times' || family === 'courier') return family;
  return 'helvetica';
}

export function fontLineRatio(family: string): number {
  return FONT_LINE_RATIO[cvFontFamily(family)];
}

export function fontLine(sizePt: number, family: string): number {
  return fontLineRatio(family) * sizePt;
}

export function getFontScale(fontSize: number): number {
  const numeric = Number(fontSize);
  if (!Number.isFinite(numeric)) return 1;
  return clamp(numeric / 12.5, 0.75, 1.8);
}

export function scaleLayout(scale: number): CvLayout {
  const numeric = Number(scale);
  const factor = clamp(Number.isFinite(numeric) ? numeric : 1, 0.75, 1.8);
  return {
    nameSize: BASE_LAYOUT.nameSize * factor,
    contactSize: BASE_LAYOUT.contactSize * factor,
    sectionSize: BASE_LAYOUT.sectionSize * factor,
    headingSize: BASE_LAYOUT.headingSize * factor,
    metaSize: BASE_LAYOUT.metaSize * factor,
    bodySize: BASE_LAYOUT.bodySize * factor,
    bulletSize: BASE_LAYOUT.bulletSize * factor,
    lineGap: BASE_LAYOUT.lineGap * factor,
    sectionGap: BASE_LAYOUT.sectionGap * factor,
    paragraphGap: BASE_LAYOUT.paragraphGap * factor,
    bulletGap: BASE_LAYOUT.bulletGap * factor,
    entryGap: BASE_LAYOUT.entryGap * factor,
  };
}

/** Same scale the PDF route applies: fontSize = scale * 12.5, then clamped. */
export function layoutForScale(scale: number): CvLayout {
  return scaleLayout(getFontScale((Number(scale) || 1) * 12.5));
}

export function contentWidthPt(pageMargin: number): number {
  return A4_WIDTH_PT - 2 * pageMargin;
}

export function isSkillsSection(title: string): boolean {
  const normalized = title.toLowerCase();
  return normalized.includes('skills')
    || normalized.includes('habilidades')
    || normalized.includes('aptitudes')
    || normalized.includes('competencias')
    || normalized.includes('habilidad')
    || normalized.includes('aptitud');
}

export function getIconType(label: string, value = ''): string | null {
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

export function sanitizePdfText(content: string): string {
  return (content || '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/\u00ad/g, '');
}

export function splitSkillItem(item: string): { label: string; value: string } | null {
  const colonIdx = item.indexOf(':');
  if (colonIdx < 0) return null;
  return {
    label: cleanMarkdownInline(item.slice(0, colonIdx)),
    value: item.slice(colonIdx + 1).trim(),
  };
}

export function joinSkillItem(label: string, value: string): string {
  return `**${label.trim()}**: ${value.trim()}`;
}

export interface ContactWidth {
  textWidth: number;
  iconWidth: number;
}

/** Same line breaks as the PDF contact row. Separator width is not added on a new line. */
export function wrapContactItems(items: ContactWidth[], separatorWidth: number, contentWidth: number): number[][] {
  const lines: number[][] = [];
  let current: number[] = [];
  let used = 0;
  items.forEach((item, index) => {
    const itemWidth = item.iconWidth + item.textWidth;
    const extra = current.length > 0 ? separatorWidth + itemWidth : itemWidth;
    if (current.length > 0 && used + extra > contentWidth) {
      lines.push(current);
      current = [index];
      used = itemWidth;
    } else {
      current.push(index);
      used += extra;
    }
  });
  if (current.length) lines.push(current);
  return lines;
}
