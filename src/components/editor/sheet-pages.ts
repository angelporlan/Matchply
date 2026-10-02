import { planPagePushes, SHEET_PAGE_GAP_PX, sheetPagePx } from '@/lib/pdf-page-breaks';

export type FlowPushMap = Record<string, number>;

export type LineSpan = {
  flowId: string;
  offset: number;
  pushPx: number;
};

export type SheetPagePlan = {
  flows: FlowPushMap;
  spans: LineSpan[];
};

type FlowLine = {
  node: Text;
  start: number;
  top: number;
};

function unscaledTop(element: HTMLElement, articleTop: number, factor: number): number {
  return (element.getBoundingClientRect().top - articleTop) / factor;
}

function charTop(node: Text, index: number, articleTop: number, factor: number): number | null {
  const length = node.textContent?.length ?? 0;
  if (index < 0 || index >= length) return null;
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  const rect = range.getClientRects()[0];
  if (!rect || rect.height === 0) return null;
  return (rect.top - articleTop) / factor;
}

function collectLines(article: HTMLElement, factor: number): FlowLine[] {
  const articleTop = article.getBoundingClientRect().top;
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent || !node.textContent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('.cv-chrome, [data-page-break], [data-page-gap]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const lines: FlowLine[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const length = node.textContent?.length ?? 0;
    let offset = 0;
    while (offset < length) {
      const top = charTop(node, offset, articleTop, factor);
      if (top == null) {
        offset += 1;
        continue;
      }
      let low = offset;
      let high = length - 1;
      let last = offset;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const midTop = charTop(node, mid, articleTop, factor);
        if (midTop != null && Math.abs(midTop - top) < 0.75) {
          last = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      lines.push({ node, start: offset, top });
      offset = last + 1;
    }
  }
  return lines;
}

function isFirstText(element: HTMLElement, node: Text, start: number): boolean {
  if (start !== 0) return false;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (!text.textContent) continue;
    if (text.parentElement?.closest('.cv-chrome, [data-page-break]')) continue;
    return text === node;
  }
  return false;
}

/** Outermost flowed block that starts on this line, so a push keeps the date with the role. */
function carrierForLine(line: FlowLine, article: HTMLElement, factor: number): HTMLElement | null {
  const articleTop = article.getBoundingClientRect().top;
  let best: HTMLElement | null = null;
  let element: HTMLElement | null = line.node.parentElement;
  while (element && element !== article) {
    if (element.dataset.flow) {
      const top = unscaledTop(element, articleTop, factor);
      const first = isFirstText(element, line.node, line.start);
      const close = Math.abs(top - line.top) <= 8;
      const startsHere = first && line.top >= top - 1 && line.top - top < 24;
      if (close || startsHere) best = element;
      else break;
    }
    element = element.parentElement;
  }
  return best;
}

function fieldOffset(field: HTMLElement, node: Text, nodeOffset: number): number {
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let count = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (text.parentElement?.closest('[data-page-break]')) continue;
    if (text === node) return count + nodeOffset;
    count += text.textContent?.length ?? 0;
  }
  return count;
}

export function clearPageSpans(article: HTMLElement) {
  article.querySelectorAll('[data-page-break]').forEach((node) => node.remove());
}

export function measureSheetPages(article: HTMLElement, factor: number, breakPts: number[]): SheetPagePlan {
  const lines = collectLines(article, factor);
  const planned = planPagePushes(
    lines.map((line) => line.top),
    breakPts,
    sheetPagePx(),
    SHEET_PAGE_GAP_PX,
  );
  const flows: FlowPushMap = {};
  const spans: LineSpan[] = [];
  for (const push of planned) {
    const line = lines[push.lineIndex];
    if (!line) continue;
    const carrier = carrierForLine(line, article, factor);
    const flowId = carrier?.dataset.flow;
    if (carrier && flowId) {
      flows[flowId] = (flows[flowId] || 0) + push.pushPx;
      continue;
    }
    const field = line.node.parentElement?.closest('.cv-field');
    if (!(field instanceof HTMLElement) || !field.dataset.flow) continue;
    spans.push({
      flowId: field.dataset.flow,
      offset: fieldOffset(field, line.node, line.start),
      pushPx: push.pushPx,
    });
  }
  return { flows, spans };
}

function insertSpan(field: HTMLElement, offset: number, pushPx: number) {
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let target: Text | null = null;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (text.parentElement?.closest('[data-page-break]')) continue;
    const length = text.textContent?.length ?? 0;
    if (remaining <= length) {
      target = text;
      break;
    }
    remaining -= length;
  }
  if (!target) return;
  const span = document.createElement('span');
  span.dataset.pageBreak = '';
  span.contentEditable = 'false';
  span.setAttribute('aria-hidden', 'true');
  span.style.display = 'block';
  span.style.height = `${pushPx}px`;
  span.style.margin = '0';
  span.style.padding = '0';
  span.style.lineHeight = '0';
  span.style.fontSize = '0';
  const range = document.createRange();
  range.setStart(target, Math.min(remaining, target.length));
  range.collapse(true);
  range.insertNode(span);
}

type SavedCaret = { field: HTMLElement; start: number; end: number };

function caretOffset(field: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(field);
  range.setEnd(node, offset);
  return range.toString().length;
}

function saveCaret(article: HTMLElement): SavedCaret | null {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !article.contains(selection.anchorNode)) return null;
  const anchor = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode.parentElement;
  const field = anchor?.closest('.cv-field');
  if (!(field instanceof HTMLElement) || !selection.focusNode) return null;
  return {
    field,
    start: caretOffset(field, selection.anchorNode, selection.anchorOffset),
    end: caretOffset(field, selection.focusNode, selection.focusOffset),
  };
}

function placeCaret(field: HTMLElement, offset: number): Range | null {
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (text.parentElement?.closest('[data-page-break]')) continue;
    const length = text.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(text, remaining);
      range.collapse(true);
      return range;
    }
    remaining -= length;
  }
  return null;
}

function restoreCaret(saved: SavedCaret) {
  if (!saved.field.isConnected) return;
  const start = placeCaret(saved.field, Math.min(saved.start, saved.end));
  const end = placeCaret(saved.field, Math.max(saved.start, saved.end));
  if (!start || !end) return;
  const range = document.createRange();
  range.setStart(start.startContainer, start.startOffset);
  range.setEnd(end.startContainer, end.startOffset);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function applyLineSpans(article: HTMLElement, spans: LineSpan[]) {
  const caret = saveCaret(article);
  clearPageSpans(article);
  for (const span of spans) {
    const field = article.querySelector(`[data-flow="${CSS.escape(span.flowId)}"]`);
    if (field instanceof HTMLElement) insertSpan(field, span.offset, span.pushPx);
  }
  if (caret) restoreCaret(caret);
}
