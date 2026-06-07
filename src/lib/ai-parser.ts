/**
 * Utility functions to parse raw AI reports (markdown) into structured sections and elements.
 */

export interface ParsedSTARStory {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection?: string;
}

export interface ParsedReport {
  A?: string; // Resumen / TL;DR
  B?: string; // Match con CV / Gaps
  C?: string; // Requisitos / Stack
  D?: string; // Puntos fuertes y débiles
  E?: string; // Blueprint de personalización
  F?: string; // Historias STAR
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

/**
 * Extracts STAR stories from section F content
 */
export function extractSTARStories(sectionFText: string): ParsedSTARStory[] {
  const stories: ParsedSTARStory[] = [];
  if (!sectionFText) return stories;

  // Split by numbered headings e.g. "### 1. Title" or "1. Title" or "**1. Title**"
  const blocks = sectionFText.split(/(?:^|\n)(?:##|###)?\s*(?:\d+[\.\s:-]+|\*\*\d+[\.\s:-]+)/g);
  
  // The first block is intro text (if any)
  const intro = blocks[0];
  const storyBlocks = blocks.slice(1);

  // If splitting didn't yield blocks, let's look for "###" or "**" blocks
  let activeBlocks = storyBlocks;
  if (storyBlocks.length === 0) {
    const altBlocks = sectionFText.split(/(?:^|\n)(?:##|###)\s*/g).slice(1);
    if (altBlocks.length > 0) {
      activeBlocks = altBlocks;
    }
  }

  for (const block of activeBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) continue;

    // First line is usually the title
    const title = lines[0].replace(/^[#\*\s\d\.\)-]+/, '').replace(/[\*]+$/, '').trim();

    let situation = '';
    let task = '';
    let action = '';
    let result = '';
    let reflection = '';

    // Join back to scan with regex for SITUACION, TAREA, ACCION, RESULTADO, REFLEXION
    const text = block;

    // Regex scanners without dotAll (s) flag, using [\s\S]*?
    const sitMatch = text.match(/(?:SITUACI[ÓO]N|SITUATION)[\s:-]+([\s\S]*?)(?=(?:TAREA|TASK|ACCI[ÓO]N|ACTION|RESULTADO|RESULT|REFLEXI[ÓO]N|REFLECTION|$))/i);
    const taskMatch = text.match(/(?:TAREA|TASK)[\s:-]+([\s\S]*?)(?=(?:SITUACI[ÓO]N|SITUATION|ACCI[ÓO]N|ACTION|RESULTADO|RESULT|REFLEXI[ÓO]N|REFLECTION|$))/i);
    const actMatch = text.match(/(?:ACCI[ÓO]N|ACTION)[\s:-]+([\s\S]*?)(?=(?:SITUACI[ÓO]N|SITUATION|TAREA|TASK|RESULTADO|RESULT|REFLEXI[ÓO]N|REFLECTION|$))/i);
    const resMatch = text.match(/(?:RESULTADO|RESULT)[\s:-]+([\s\S]*?)(?=(?:SITUACI[ÓO]N|SITUATION|TAREA|TASK|ACCI[ÓO]N|ACTION|REFLEXI[ÓO]N|REFLECTION|$))/i);
    const refMatch = text.match(/(?:REFLEXI[ÓO]N|REFLECTION)[\s:-]+([\s\S]*?)$/i);

    situation = sitMatch ? sitMatch[1].trim() : '';
    task = taskMatch ? taskMatch[1].trim() : '';
    action = actMatch ? actMatch[1].trim() : '';
    result = resMatch ? resMatch[1].trim() : '';
    reflection = refMatch ? refMatch[1].trim() : '';

    // Cleanup markdown formatting in strings
    const cleanStr = (s: string) => s.replace(/^\*\*|^\*|^\-\s\*\*|^\-\s\*/g, '').replace(/\*\*$/g, '').trim();

    if (situation || task || action || result) {
      stories.push({
        title,
        situation: cleanStr(situation),
        task: cleanStr(task),
        action: cleanStr(action),
        result: cleanStr(result),
        reflection: reflection ? cleanStr(reflection) : undefined
      });
    }
  }

  // If regex parsing failed, let's try line-by-line parsing
  if (stories.length === 0) {
    let currentStory: Partial<ParsedSTARStory> = {};
    let activeField: keyof ParsedSTARStory | null = null;

    for (const line of sectionFText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if it starts a new story
      if (trimmed.match(/^(?:##|###)?\s*\d+[\.\s]/) || (trimmed.startsWith('**') && trimmed.match(/^\*\*\d+[\.\s]/))) {
        if (currentStory.title) {
          stories.push(currentStory as ParsedSTARStory);
        }
        currentStory = {
          title: trimmed.replace(/^[#\*\s\d\.\)-]+/, '').replace(/[\*]+$/, '').trim(),
          situation: '',
          task: '',
          action: '',
          result: '',
          reflection: ''
        };
        activeField = null;
        continue;
      }

      const sitMatch = trimmed.match(/^(?:-\s*)?\*\*(?:SITUACI[ÓO]N|SITUATION)\*\*[\s:-]*(.*)/i);
      const taskMatch = trimmed.match(/^(?:-\s*)?\*\*(?:TAREA|TASK)\*\*[\s:-]*(.*)/i);
      const actMatch = trimmed.match(/^(?:-\s*)?\*\*(?:ACCI[ÓO]N|ACTION)\*\*[\s:-]*(.*)/i);
      const resMatch = trimmed.match(/^(?:-\s*)?\*\*(?:RESULTADO|RESULT)\*\*[\s:-]*(.*)/i);
      const refMatch = trimmed.match(/^(?:-\s*)?\*\*(?:REFLEXI[ÓO]N|REFLECTION)\*\*[\s:-]*(.*)/i);

      if (sitMatch) {
        currentStory.situation = sitMatch[1];
        activeField = 'situation';
      } else if (taskMatch) {
        currentStory.task = taskMatch[1];
        activeField = 'task';
      } else if (actMatch) {
        currentStory.action = actMatch[1];
        activeField = 'action';
      } else if (resMatch) {
        currentStory.result = resMatch[1];
        activeField = 'result';
      } else if (refMatch) {
        currentStory.reflection = refMatch[1];
        activeField = 'reflection';
      } else if (activeField && currentStory) {
        currentStory[activeField] += '\n' + trimmed;
      }
    }

    if (currentStory.title) {
      stories.push(currentStory as ParsedSTARStory);
    }
  }

  return stories;
}
