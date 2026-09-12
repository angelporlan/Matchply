/**
 * Utility functions to parse raw AI reports (markdown) into structured sections and elements.
 */

export interface ParsedReport {
  A?: string; // Resumen / TL;DR
  B?: string; // Match con CV / Gaps
  C?: string; // Requisitos / Stack
  D?: string; // Puntos fuertes y débiles
  E?: string; // Blueprint de personalización
  G?: string; // Preguntas de entrevista
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

/**
 * Splits rawReport markdown into A-G sections based on headers like "## A)", "### B", or "A."
 */
export function parseSections(markdown: string): ParsedReport {
  const result: ParsedReport = {};
  if (!markdown) return result;

  // Pattern matching headings like "## A)", "### B.", "## SECTION A" or "A. Title"
  const sectionPattern = /(?:^|\n)(?:##|###)?\s*([A-G])[\)\.\s:-]+([\s\S]*?)(?=\n(?:##|###)?\s*[A-G][\)\.\s:-]+|\n*$)/g;
  
  let match;
  // Reset regex lastIndex
  sectionPattern.lastIndex = 0;
  
  while ((match = sectionPattern.exec(markdown)) !== null) {
    const sectionLetter = match[1].toUpperCase() as keyof ParsedReport;
    const sectionContent = match[2].trim();
    result[sectionLetter] = sectionContent;
  }

  // Fallback: If regex fails to capture, try manual split
  if (Object.keys(result).length === 0) {
    const parts = markdown.split(/(?:^|\n)(?:##|###)?\s*([A-G])[\)\.\s:-]+/g);
    for (let i = 1; i < parts.length; i += 2) {
      const letter = parts[i].toUpperCase() as keyof ParsedReport;
      const content = parts[i + 1] ? parts[i + 1].trim() : '';
      result[letter] = content;
    }
  }

  return result;
}

/**
 * Parses markdown tables from a text block
 */
export function parseMarkdownTable(markdown: string): TableData | null {
  if (!markdown) return null;

  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l !== '');
  const tableLines = lines.filter(l => l.startsWith('|'));
  
  if (tableLines.length < 2) return null;

  try {
    // Parse headers
    const headers = tableLines[0]
      .split('|')
      .slice(1, -1)
      .map(h => h.trim());

    // Parse rows, skipping the separator line (|---|---|)
    const rows: string[][] = [];
    
    // Find where rows start (after header and separator)
    let startIndex = 1;
    if (tableLines[1].includes('---') || tableLines[1].includes('-')) {
      startIndex = 2;
    }

    for (let i = startIndex; i < tableLines.length; i++) {
      const row = tableLines[i]
        .split('|')
        .slice(1, -1)
        .map(c => c.trim());
      
      // Only add rows that have matching column count (roughly)
      if (row.length > 0) {
        rows.push(row);
      }
    }

    return { headers, rows };
  } catch (err) {
    console.error("Error parsing markdown table:", err);
    return null;
  }
}
