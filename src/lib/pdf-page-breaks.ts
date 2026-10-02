/** Where the downloaded PDF starts each page after the first, in the unpaginated flow. */

import { A4_HEIGHT_PT, CSS_PX_PER_PT } from '@/lib/cv-layout';

/** Gray gap between sheet pages in the editor. Not part of the PDF. */
export const SHEET_PAGE_GAP_PX = 36;

export function sheetPagePx(): number {
  return A4_HEIGHT_PT * CSS_PX_PER_PT;
}

export function cssPxFromPt(points: number): number {
  return points * CSS_PX_PER_PT;
}

export type PagePush = { lineIndex: number; pushPx: number };

/**
 * How far to push each line so it starts at the top of the next editor page.
 * `lineTopsPx` and `breakPts` are both measured on the continuous, unpaginated flow.
 */
export function planPagePushes(
  lineTopsPx: number[],
  breakPts: number[],
  pagePx: number,
  gapPx: number,
): PagePush[] {
  const pushes: PagePush[] = [];
  const shifted = (index: number) => lineTopsPx[index] + pushes.reduce((sum, push) => (
    push.lineIndex <= index ? sum + push.pushPx : sum
  ), 0);

  breakPts.forEach((breakPt, pageIndex) => {
    if (!Number.isFinite(breakPt) || breakPt <= 0) return;
    const target = cssPxFromPt(breakPt);
    let lineIndex = -1;
    let best = Infinity;
    lineTopsPx.forEach((top, index) => {
      const distance = Math.abs(top - target);
      if (distance < best) {
        best = distance;
        lineIndex = index;
      }
    });
    if (lineIndex < 0) return;
    const destination = (pageIndex + 1) * (pagePx + gapPx);
    const pushPx = destination - shifted(lineIndex);
    if (pushPx > 0.5) pushes.push({ lineIndex, pushPx });
  });
  return pushes;
}

export function formatPdfBreakHeader(breaks: number[]): string {
  return breaks.filter((value) => Number.isFinite(value) && value > 0).map((value) => value.toFixed(2)).join(',');
}

export function parsePdfBreakHeader(header: string | null): number[] {
  if (!header) return [];
  return header.split(',').map((part) => Number(part)).filter((value) => Number.isFinite(value) && value > 0);
}
