import type { ReactNode } from 'react';

function safeHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : null;
}

function inlineMarkdown(value: string): ReactNode[] {
  const tokenPattern = /(\[[^\]]+\]\(https?:\/\/[^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  const parts = value.split(tokenPattern);
  return parts.filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/i);
    if (link) {
      const href = safeHref(link[2]);
      return href ? (
        <a key={index} href={href} target="_blank" rel="noreferrer" className="underline text-info-text hover:text-text">
          {link[1]}
        </a>
      ) : part;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function tableCells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function checkboxItem(value: string) {
  const match = value.match(/^\[([ xX])\]\s+(.*)$/);
  if (!match) return <>{inlineMarkdown(value)}</>;
  const checked = match[1].toLowerCase() === 'x';
  return (
    <span className="inline-flex items-start gap-2">
      <span
        role="checkbox"
        aria-checked={checked}
        className={`mt-1 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[10px] leading-none ${
          checked ? 'border-success-text bg-success-surface text-success-text' : 'border-control'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span>{inlineMarkdown(match[2])}</span>
    </span>
  );
}

export default function GtmMarkdownPreview({ content, kind }: { content: string; kind: 'markdown' | 'json' | 'text' }) {
  if (kind === 'json') {
    let formatted = content;
    try {
      formatted = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // Show malformed JSON as source instead of attempting to interpret it.
    }
    return <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[8px] bg-surface-muted p-4 font-mono text-xs leading-6">{formatted}</pre>;
  }

  if (kind === 'text') {
    return <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[8px] bg-surface-muted p-4 font-mono text-sm leading-6">{content}</pre>;
  }

  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const language = fence[1].trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <div key={`code-${index}`} className="space-y-1">
          {language && <p className="text-[11px] uppercase tracking-wider text-text-muted">{language}</p>}
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[8px] bg-surface-muted p-4 font-mono text-xs leading-6">{code.join('\n')}</pre>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const Heading = (`h${Math.min(level, 4)}`) as keyof JSX.IntrinsicElements;
      blocks.push(<Heading key={`heading-${index}`} className={`${level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-base'} font-display font-semibold text-text`}>{inlineMarkdown(heading[2])}</Heading>);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes('|') && isTableSeparator(lines[index + 1])) {
      const headerCells = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="overflow-x-auto rounded-[8px] border border-subtle">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>{headerCells.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-subtle px-3 py-2 font-semibold">{inlineMarkdown(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-surface/60">
                  {headerCells.map((_, cellIndex) => <td key={cellIndex} className="border-b border-subtle px-3 py-2 align-top">{inlineMarkdown(row[cellIndex] || '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(orderedList ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      const List = orderedList ? 'ol' : 'ul';
      blocks.push(
        <List key={`list-${index}`} className={`${orderedList ? 'list-decimal' : 'list-disc'} space-y-1 pl-6`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{checkboxItem(item)}</li>)}
        </List>,
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`} className="border-l-2 border-ai pl-4 text-text-muted">{quoteLines.map((quoteLine, quoteIndex) => <p key={quoteIndex}>{inlineMarkdown(quoteLine)}</p>)}</blockquote>);
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      if (/^\s*(#{1,6})\s+/.test(lines[index]) || /^\s*```/.test(lines[index]) || /^\s*[-*+]\s+/.test(lines[index]) || /^\s*\d+[.)]\s+/.test(lines[index])) break;
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`} className="whitespace-pre-wrap leading-7">{inlineMarkdown(paragraph.join('\n'))}</p>);
  }

  return <div className="space-y-5 break-words text-sm text-text">{blocks.length ? blocks : <p className="text-text-muted">El archivo está vacío.</p>}</div>;
}
